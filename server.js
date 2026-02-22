const express = require('express');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const OAuth = require('oauth-1.0a');

dotenv.config();

const app = express();
const parsedPort = parseInt(process.env.PORT, 10);
const PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000;
const YELP_API_KEY = process.env.YELP_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TRIPIT_API_KEY = process.env.TRIPIT_API_KEY;
const TRIPIT_API_SECRET = process.env.TRIPIT_API_SECRET;

// TripIt OAuth 1.0 URLs
const TRIPIT_REQUEST_TOKEN_URL = 'https://api.tripit.com/oauth/request_token';
const TRIPIT_AUTHORIZE_URL = 'https://www.tripit.com/oauth/authorize';
const TRIPIT_ACCESS_TOKEN_URL = 'https://api.tripit.com/oauth/access_token';
const TRIPIT_API_BASE_URL = 'https://api.tripit.com/v1';

// TripIt OAuth 1.0 consumer
const tripitOAuth = TRIPIT_API_KEY && TRIPIT_API_SECRET ? OAuth({
    consumer: {
        key: TRIPIT_API_KEY,
        secret: TRIPIT_API_SECRET
    },
    signature_method: 'HMAC-SHA1',
    hash_function(baseString, key) {
        return crypto.createHmac('sha1', key).update(baseString).digest('base64');
    }
}) : null;

// In-memory stores for TripIt OAuth tokens (process-local, resets on restart)
const tripitRequestTokens = new Map();
const tripitAccessTokens = new Map();

// Periodically clean up expired request tokens (10-minute TTL)
const TRIPIT_REQUEST_TOKEN_TTL_MS = 10 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of tripitRequestTokens) {
        if (now - value.createdAt > TRIPIT_REQUEST_TOKEN_TTL_MS) {
            tripitRequestTokens.delete(key);
        }
    }
}, TRIPIT_REQUEST_TOKEN_TTL_MS);
const parsedCacheTtlSeconds = parseInt(process.env.YELP_CACHE_TTL_SECONDS, 10);
const parsedCacheTtlMs = parseInt(process.env.YELP_CACHE_TTL_MS, 10);
const CACHE_TTL_MS = Number.isFinite(parsedCacheTtlSeconds) && parsedCacheTtlSeconds > 0
    ? parsedCacheTtlSeconds * 1000
    : (Number.isFinite(parsedCacheTtlMs) && parsedCacheTtlMs > 0
        ? parsedCacheTtlMs
        : 5 * 60 * 1000);
const YELP_BASE_URL = 'https://api.yelp.com/v3/businesses/search';
const OPENAI_BASE_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_SEARCH_RADIUS = 8047;
const DEFAULT_SEARCH_LIMIT = 20;
const DEFAULT_CATEGORIES = 'restaurants,bars,breweries,nightlife';
const DEFAULT_SORT_BY = 'rating';

// In-memory cache is process-local, not shared across instances, and resets on server restart.
const cache = new Map();

const buildCacheKey = (params) => params.toString();

const getCachedResponse = (cacheKey) => {
    const cached = cache.get(cacheKey);
    if (!cached) {
        return null;
    }

    if (cached.expiresAt < Date.now()) {
        cache.delete(cacheKey);
        return null;
    }

    return cached.data;
};

const setCachedResponse = (cacheKey, data) => {
    cache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        data
    });
};

app.use(express.static(path.resolve(__dirname)));
app.use(express.json());

app.post('/api/yelp-search', async (req, res) => {
    if (!YELP_API_KEY) {
        return res.status(500).json({
            error: 'Yelp API key not configured. Please set YELP_API_KEY in your .env file.'
        });
    }

    const { latitude, longitude, radius, limit, categories, sort_by: sortBy } = req.body || {};

    if (!latitude || !longitude) {
        return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    const latitudeValue = Number(latitude);
    const longitudeValue = Number(longitude);

    if (!Number.isFinite(latitudeValue) || !Number.isFinite(longitudeValue)) {
        return res.status(400).json({ error: 'latitude and longitude must be valid numbers' });
    }

    const hasRadius = radius !== undefined;
    const hasLimit = limit !== undefined;
    const radiusValue = hasRadius ? Number(radius) : DEFAULT_SEARCH_RADIUS;
    const limitValue = hasLimit ? Number(limit) : DEFAULT_SEARCH_LIMIT;

    if (hasRadius && (!Number.isFinite(radiusValue) || radiusValue <= 0 || radiusValue > 40000)) {
        return res.status(400).json({ error: 'radius must be a number between 1 and 40000' });
    }

    if (hasLimit && (!Number.isFinite(limitValue) || limitValue <= 0)) {
        return res.status(400).json({ error: 'limit must be a positive number' });
    }

    const normalizedCategories = categories || DEFAULT_CATEGORIES;
    const normalizedSortBy = sortBy || DEFAULT_SORT_BY;

    const params = new URLSearchParams({
        latitude: latitudeValue.toString(),
        longitude: longitudeValue.toString(),
        radius: radiusValue.toString(),
        limit: limitValue.toString(),
        categories: normalizedCategories,
        sort_by: normalizedSortBy
    });

    const cacheKey = buildCacheKey(params);
    const cachedData = getCachedResponse(cacheKey);
    if (cachedData) {
        return res.json(cachedData);
    }

    try {
        const response = await fetch(`${YELP_BASE_URL}?${params.toString()}`, {
            headers: {
                Authorization: `Bearer ${YELP_API_KEY}`,
                Accept: 'application/json'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({
                error: 'Yelp API error',
                status: response.status
            });
        }

        const data = await response.json();
        setCachedResponse(cacheKey, data);
        return res.json(data);
    } catch (error) {
        console.error('Error contacting Yelp API:', error?.message || error);
        return res.status(500).json({ error: 'Failed to contact Yelp API' });
    }
});

/**
 * AI Concierge endpoint — uses OpenAI to recommend top 3 restaurants
 * for a business meal at the specified destination.
 *
 * Body: { destination, date, mealType, partySize, preferences, restaurants? }
 * Returns: { recommendations: [...], message: string }
 */
app.post('/api/concierge', async (req, res) => {
    if (!OPENAI_API_KEY) {
        return res.status(500).json({
            error: 'OpenAI API key not configured. Please set OPENAI_API_KEY in your .env file.'
        });
    }

    const {
        destination,
        date,
        mealType,
        partySize,
        preferences,
        restaurants
    } = req.body || {};

    if (!destination) {
        return res.status(400).json({ error: 'destination is required' });
    }

    const normalizedMealType = mealType || 'business dinner';
    const normalizedPartySize = partySize || 2;
    const normalizedPreferences = preferences || 'no specific preferences';

    const systemPrompt = `You are an elite concierge assistant specializing in business dining. 
Your task is to recommend the top 3 restaurants for a ${normalizedMealType} in ${destination}.
You must respond ONLY with valid JSON in exactly this format — no extra text, no markdown:
{
  "message": "A warm, personalized 1-2 sentence introduction to your recommendations",
  "recommendations": [
    {
      "rank": 1,
      "name": "Restaurant Name",
      "cuisineType": "Cuisine type",
      "priceRange": "$$$",
      "rating": 4.5,
      "address": "Full address",
      "description": "2-3 sentence description of the restaurant",
      "whyBusinessMeal": "Why this is ideal for a business ${normalizedMealType}",
      "mustTry": "Signature dish or drink to try",
      "reservationTip": "Best time to reserve or any tips",
      "openTableUrl": "https://www.opentable.com/s?term=RESTAURANT_NAME_ENCODED",
      "resyUrl": "https://resy.com/cities/CITY_SLUG?search=RESTAURANT_NAME_ENCODED",
      "googleMapsUrl": "https://maps.google.com/?q=RESTAURANT_NAME+CITY"
    }
  ]
}`;

    const restaurantContext = restaurants && restaurants.length > 0
        ? ` Available nearby restaurants to consider: ${JSON.stringify(restaurants.slice(0, 10).map(r => ({ name: r.name, categories: r.categories, rating: r.rating, price: r.price, address: r.location })))}.`
        : '';

    const userMessage = `I need a ${normalizedMealType} recommendation in ${destination} on ${date || 'an upcoming date'} for ${normalizedPartySize} people. Preferences: ${normalizedPreferences}.${restaurantContext} Please recommend the top 3 best upscale restaurants ideal for a ${normalizedMealType}.`;

    try {
        const response = await fetch(OPENAI_BASE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.7,
                max_tokens: 1500
            })
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            console.error('OpenAI API error:', response.status, errBody);
            return res.status(response.status).json({
                error: 'OpenAI API error',
                status: response.status
            });
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        let parsed;
        try {
            const jsonStr = content.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
            parsed = JSON.parse(jsonStr);
        } catch (parseError) {
            console.error('Failed to parse OpenAI response as JSON:', content);
            return res.status(500).json({ error: 'Failed to parse AI response', raw: content });
        }

        return res.json(parsed);
    } catch (error) {
        console.error('Error contacting OpenAI API:', error?.message || error);
        return res.status(500).json({ error: 'Failed to contact OpenAI API' });
    }
});

/**
 * TripIt OAuth — Step 1: Obtain a request token and return the authorization URL.
 * The frontend opens this URL so the user can authorize the app on TripIt.
 *
 * Query: ?callback=<url>  (the URL TripIt will redirect back to after authorization)
 * Returns: { authorizeUrl: string }
 */
app.get('/api/tripit/connect', async (req, res) => {
    if (!tripitOAuth) {
        return res.status(500).json({
            error: 'TripIt API credentials not configured. Please set TRIPIT_API_KEY and TRIPIT_API_SECRET in your .env file.'
        });
    }

    const callbackUrl = req.query.callback;
    if (!callbackUrl) {
        return res.status(400).json({ error: 'callback query parameter is required' });
    }

    // Validate the callback URL originates from this server to prevent open redirects
    const requestOrigin = `${req.protocol}://${req.get('host')}`;
    try {
        const parsed = new URL(callbackUrl);
        if (parsed.origin !== requestOrigin) {
            return res.status(400).json({ error: 'callback URL must match the application origin' });
        }
    } catch {
        return res.status(400).json({ error: 'callback must be a valid URL' });
    }

    const requestData = {
        url: TRIPIT_REQUEST_TOKEN_URL,
        method: 'POST'
    };

    try {
        const response = await fetch(TRIPIT_REQUEST_TOKEN_URL, {
            method: 'POST',
            headers: {
                ...tripitOAuth.toHeader(tripitOAuth.authorize(requestData)),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (!response.ok) {
            console.error('TripIt request token error:', response.status);
            return res.status(response.status).json({
                error: 'Failed to obtain TripIt request token',
                status: response.status
            });
        }

        const body = await response.text();
        const params = new URLSearchParams(body);
        const oauthToken = params.get('oauth_token');
        const oauthTokenSecret = params.get('oauth_token_secret');

        if (!oauthToken || !oauthTokenSecret) {
            return res.status(500).json({ error: 'Invalid response from TripIt request token endpoint' });
        }

        // Store the request token secret so we can use it in the callback step
        tripitRequestTokens.set(oauthToken, {
            secret: oauthTokenSecret,
            createdAt: Date.now()
        });

        const authorizeUrl = `${TRIPIT_AUTHORIZE_URL}?oauth_token=${encodeURIComponent(oauthToken)}&oauth_callback=${encodeURIComponent(callbackUrl)}`;

        return res.json({ authorizeUrl });
    } catch (error) {
        console.error('Error obtaining TripIt request token:', error?.message || error);
        return res.status(500).json({ error: 'Failed to contact TripIt API' });
    }
});

/**
 * TripIt OAuth — Step 2: Exchange the authorized request token for an access token.
 * Called after TripIt redirects the user back to the application.
 * Serves an HTML page that stores the session token in localStorage and closes the popup.
 *
 * Query: ?oauth_token=<token>
 */
app.get('/api/tripit/callback', async (req, res) => {
    const sendCallbackPage = (success, message, token) => {
        const html = `<!DOCTYPE html><html><head><title>TripIt Authorization</title></head><body>
<p>${message}</p>
<script>
(function() {
    ${success && token ? `localStorage.setItem('onthego_tripit_token', ${JSON.stringify(token)});` : ''}
    window.close();
})();
</script>
</body></html>`;
        return res.type('html').send(html);
    };

    if (!tripitOAuth) {
        return sendCallbackPage(false, 'TripIt API credentials not configured.', null);
    }

    const oauthToken = req.query.oauth_token;
    if (!oauthToken) {
        return sendCallbackPage(false, 'Missing authorization token.', null);
    }

    const stored = tripitRequestTokens.get(oauthToken);
    if (!stored) {
        return sendCallbackPage(false, 'Unknown or expired request token.', null);
    }

    // Clean up used request token
    tripitRequestTokens.delete(oauthToken);

    const requestData = {
        url: TRIPIT_ACCESS_TOKEN_URL,
        method: 'POST'
    };

    const token = {
        key: oauthToken,
        secret: stored.secret
    };

    try {
        const response = await fetch(TRIPIT_ACCESS_TOKEN_URL, {
            method: 'POST',
            headers: {
                ...tripitOAuth.toHeader(tripitOAuth.authorize(requestData, token)),
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (!response.ok) {
            console.error('TripIt access token error:', response.status);
            return sendCallbackPage(false, 'Failed to obtain TripIt access token.', null);
        }

        const body = await response.text();
        const params = new URLSearchParams(body);
        const accessToken = params.get('oauth_token');
        const accessTokenSecret = params.get('oauth_token_secret');

        if (!accessToken || !accessTokenSecret) {
            return sendCallbackPage(false, 'Invalid response from TripIt.', null);
        }

        // Generate an opaque session id so the frontend never sees raw OAuth tokens
        const sessionId = crypto.randomBytes(32).toString('hex');
        tripitAccessTokens.set(sessionId, {
            key: accessToken,
            secret: accessTokenSecret,
            createdAt: Date.now()
        });

        return sendCallbackPage(true, 'TripIt connected! This window will close.', sessionId);
    } catch (error) {
        console.error('Error obtaining TripIt access token:', error?.message || error);
        return sendCallbackPage(false, 'Failed to contact TripIt API.', null);
    }
});

/**
 * TripIt — Fetch the authenticated user's trips.
 *
 * Headers: Authorization: Bearer <sessionId>
 * Returns: TripIt API response (list of trips)
 */
app.get('/api/tripit/trips', async (req, res) => {
    if (!tripitOAuth) {
        return res.status(500).json({
            error: 'TripIt API credentials not configured.'
        });
    }

    const authHeader = req.headers.authorization || '';
    const sessionId = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!sessionId) {
        return res.status(401).json({ error: 'Authorization header with Bearer token is required' });
    }

    const accessToken = tripitAccessTokens.get(sessionId);
    if (!accessToken) {
        return res.status(401).json({ error: 'Invalid or expired session token' });
    }

    const tripListUrl = `${TRIPIT_API_BASE_URL}/list/trip/format/json`;
    const requestData = {
        url: tripListUrl,
        method: 'GET'
    };

    const token = {
        key: accessToken.key,
        secret: accessToken.secret
    };

    try {
        const response = await fetch(tripListUrl, {
            method: 'GET',
            headers: tripitOAuth.toHeader(tripitOAuth.authorize(requestData, token))
        });

        if (!response.ok) {
            console.error('TripIt list trips error:', response.status);
            return res.status(response.status).json({
                error: 'TripIt API error',
                status: response.status
            });
        }

        const data = await response.json();
        return res.json(data);
    } catch (error) {
        console.error('Error fetching TripIt trips:', error?.message || error);
        return res.status(500).json({ error: 'Failed to contact TripIt API' });
    }
});

/**
 * TripIt — Disconnect (revoke stored access token).
 *
 * Headers: Authorization: Bearer <sessionId>
 * Returns: { success: true }
 */
app.post('/api/tripit/disconnect', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const sessionId = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (sessionId) {
        tripitAccessTokens.delete(sessionId);
    }

    return res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`OnTheGo proxy server running on http://localhost:${PORT}`);
});
