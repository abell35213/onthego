const express = require('express');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const OAuth = require('oauth-1.0a');
const { TripItTokenStore, REQUEST_TOKEN_TTL_MS } = require('./lib/tripit-token-store');

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
const TRIPIT_SESSION_COOKIE_NAME = 'onthego_tripit_session';
const TRIPIT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TRIPIT_FETCH_TIMEOUT_MS = Number.parseInt(process.env.TRIPIT_FETCH_TIMEOUT_MS, 10) || 10000;
const TRIPIT_MAX_TRIP_PAGES = Math.min(
    Math.max(Number.parseInt(process.env.TRIPIT_MAX_TRIP_PAGES, 10) || 5, 1),
    25
);
const TRIPIT_SESSION_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: TRIPIT_SESSION_TTL_MS
};

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

const tripitTokenStore = new TripItTokenStore();

const getAuthenticatedAppUserId = (req) => {
    const userId = req.get('x-onthego-user-ref') || '';
    return userId.trim();
};

const requireAuthenticatedAppUserId = (req, res) => {
    const userId = getAuthenticatedAppUserId(req);
    if (!userId) {
        res.status(401).json({ error: 'x-onthego-user-ref header is required' });
        return null;
    }

    return userId;
};

tripitTokenStore.initialize().catch((error) => {
    console.error('Failed to initialize TripIt token store:', error?.message || error);
});

const parseCookies = (cookieHeader = '') => cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
        const separatorIndex = part.indexOf('=');
        if (separatorIndex === -1) {
            return cookies;
        }

        const key = part.slice(0, separatorIndex).trim();
        const value = part.slice(separatorIndex + 1).trim();
        cookies[key] = decodeURIComponent(value);
        return cookies;
    }, {});

const getTripItCookieSessionId = (req) => {
    const cookies = parseCookies(req.headers.cookie || '');
    return cookies[TRIPIT_SESSION_COOKIE_NAME] || '';
};

const getTripItSessionId = (req) => {
    const authHeader = req.headers.authorization || '';
    const bearerSessionId = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    return bearerSessionId || getTripItCookieSessionId(req);
};

const clearTripItSession = (res) => {
    res.clearCookie(TRIPIT_SESSION_COOKIE_NAME, {
        ...TRIPIT_SESSION_COOKIE_OPTIONS,
        maxAge: undefined
    });
};

const TRIPIT_PASSTHROUGH_QUERY_PARAMS = ['past', 'modified_since', 'include_objects'];

const parsePositiveInteger = (value) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toArray = (value) => {
    if (Array.isArray(value)) {
        return value;
    }

    if (value === null || value === undefined) {
        return [];
    }

    return [value];
};

const extractTripListPayload = (payload) => {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    if (payload.Trip || payload.trip || payload.ListResults || payload.list_results) {
        return payload;
    }

    for (const value of Object.values(payload)) {
        if (!value || typeof value !== 'object') {
            continue;
        }

        if (value.Trip || value.trip || value.ListResults || value.list_results) {
            return value;
        }
    }

    return payload;
};

const extractTripPagination = (payload) => {
    const tripPayload = extractTripListPayload(payload);
    const listResults = tripPayload?.ListResults || tripPayload?.list_results || null;

    return {
        pageNum: parsePositiveInteger(listResults?.page_num ?? tripPayload?.page_num) || 1,
        maxPage: parsePositiveInteger(listResults?.max_page ?? tripPayload?.max_page) || 1,
        pageSize: parsePositiveInteger(listResults?.page_size ?? tripPayload?.page_size) || 0
    };
};

const extractTripRecords = (payload) => {
    const tripPayload = extractTripListPayload(payload);
    return toArray(
        tripPayload?.Trip
        ?? tripPayload?.trip
        ?? tripPayload?.trips
        ?? tripPayload?.ListResults?.Trip
        ?? tripPayload?.list_results?.Trip
    ).filter(Boolean);
};

const dedupeTrips = (trips) => {
    const uniqueTrips = [];
    const seen = new Set();

    for (const trip of trips) {
        const dedupeKey = String(
            trip?.id
            ?? trip?.trip_id
            ?? trip?.Trip?.id
            ?? JSON.stringify(trip)
        );

        if (seen.has(dedupeKey)) {
            continue;
        }

        seen.add(dedupeKey);
        uniqueTrips.push(trip);
    }

    return uniqueTrips;
};

const mergeTripPages = (pages) => {
    const firstPage = pages[0] || {};
    const mergedTrips = dedupeTrips(pages.flatMap((page) => extractTripRecords(page)));
    const pagination = extractTripPagination(pages[pages.length - 1] || firstPage);
    const tripPayload = extractTripListPayload(firstPage);
    const listResults = tripPayload?.ListResults || tripPayload?.list_results;

    if (listResults && typeof listResults === 'object') {
        return {
            ...firstPage,
            ListResults: {
                ...listResults,
                page_num: pagination.pageNum,
                max_page: pagination.maxPage,
                page_size: pagination.pageSize,
                Trip: mergedTrips
            }
        };
    }

    return {
        ...firstPage,
        page_num: pagination.pageNum,
        max_page: pagination.maxPage,
        page_size: pagination.pageSize,
        Trip: mergedTrips
    };
};

const isTripItRetryableStatus = (status) => [408, 429, 500, 502, 503, 504].includes(status);

const TRIPIT_ERROR_CODE_MAP = {
    consumer_key_unknown: {
        code: 'tripit_invalid_consumer_key',
        message: 'TripIt connection is temporarily unavailable. Please contact support.',
        logCode: 'consumer_key_unknown'
    },
    timestamp_refused: {
        code: 'tripit_timestamp_out_of_range',
        message: 'TripIt connection is temporarily unavailable. Please try again in a moment.',
        logCode: 'timestamp_refused'
    },
    token_rejected: {
        code: 'tripit_authorization_expired',
        message: 'Authorization expired, please reconnect your TripIt account.',
        logCode: 'token_rejected'
    },
    token_expired: {
        code: 'tripit_authorization_expired',
        message: 'Authorization expired, please reconnect your TripIt account.',
        logCode: 'token_expired'
    },
    permission_unknown: {
        code: 'tripit_authorization_expired',
        message: 'Authorization expired, please reconnect your TripIt account.',
        logCode: 'permission_unknown'
    },
    signature_invalid: {
        code: 'tripit_invalid_signature',
        message: 'TripIt connection is temporarily unavailable. Please try again later.',
        logCode: 'signature_invalid'
    },
    signature_method_rejected: {
        code: 'tripit_invalid_signature',
        message: 'TripIt connection is temporarily unavailable. Please try again later.',
        logCode: 'signature_method_rejected'
    }
};

const normalizeTripItErrorKey = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const safeParseJson = (value) => {
    if (!value || typeof value !== 'string') {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

const extractTripItCodeFromObject = (value) => {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const directCode = value.code || value.errorCode || value.error_code || value.oauth_problem;
    if (typeof directCode === 'string' && directCode.trim()) {
        return directCode.trim();
    }

    for (const nestedValue of Object.values(value)) {
        if (!nestedValue || typeof nestedValue !== 'object') {
            continue;
        }

        const nestedCode = extractTripItCodeFromObject(nestedValue);
        if (nestedCode) {
            return nestedCode;
        }
    }

    return null;
};

const parseTripItErrorBody = async (response) => {
    const bodyText = await response.text().catch(() => '');
    const trimmedBody = bodyText.trim();
    const parsedJson = safeParseJson(trimmedBody);
    const queryParams = new URLSearchParams(trimmedBody);
    const oauthProblem = queryParams.get('oauth_problem') || queryParams.get('error') || null;
    const oauthAdvice = queryParams.get('oauth_problem_advice') || queryParams.get('error_description') || null;
    const objectCode = extractTripItCodeFromObject(parsedJson);
    const normalizedCode = normalizeTripItErrorKey(oauthProblem || objectCode);

    return {
        rawBody: trimmedBody,
        details: parsedJson || null,
        tripitCode: normalizedCode || null,
        oauthAdvice: oauthAdvice || null
    };
};

const getTripItErrorMeta = (tripitCode) => {
    if (!tripitCode) {
        return null;
    }

    return TRIPIT_ERROR_CODE_MAP[tripitCode] || null;
};

const buildTripItErrorPayload = ({ status, defaultCode, defaultMessage, parsedError, retryAfter }) => {
    const errorMeta = getTripItErrorMeta(parsedError?.tripitCode);
    const payload = {
        error: errorMeta?.message || defaultMessage,
        code: errorMeta?.code || defaultCode
    };

    if (status) {
        payload.status = status;
    }

    if (parsedError?.tripitCode) {
        payload.tripit_code = parsedError.tripitCode;
    }

    if (retryAfter) {
        payload.retry_after = retryAfter;
    }

    return payload;
};

const logTripItError = ({ event, endpoint, httpStatus, tripitCode, message, extra = {} }) => {
    console.error(JSON.stringify({
        event,
        endpoint,
        http_status: httpStatus || null,
        tripit_code: tripitCode || null,
        message,
        ...extra
    }));
};

const fetchTripItJson = async ({ url, token }) => {
    const requestData = {
        url,
        method: 'GET'
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TRIPIT_FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                ...tripitOAuth.toHeader(tripitOAuth.authorize(requestData, token)),
                Accept: 'application/json'
            },
            signal: controller.signal
        });

        return response;
    } finally {
        clearTimeout(timeout);
    }
};

// Periodically clean up expired request tokens (10-minute TTL)
const tripitRequestTokenCleanupTimer = setInterval(() => {
    tripitTokenStore.cleanupExpiredRequestTokens().catch((error) => {
        console.error('Failed to clean up expired TripIt request tokens:', error?.message || error);
    });
}, REQUEST_TOKEN_TTL_MS);
tripitRequestTokenCleanupTimer.unref();
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

    if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
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
        } catch {
            console.error('Failed to parse OpenAI response as JSON:', content);
            return res.status(500).json({ error: 'Failed to parse AI response', raw: content });
        }

        return res.json(parsed);
    } catch (error) {
        console.error('Error contacting OpenAI API:', error?.message || error);
        return res.status(500).json({ error: 'Failed to contact OpenAI API' });
    }
});

// Apple MapKit JS credentials
const APPLE_MAPS_TEAM_ID = process.env.APPLE_MAPS_TEAM_ID || '';
const APPLE_MAPS_KEY_ID = process.env.APPLE_MAPS_KEY_ID || '';
// .p8 private key: env vars often have literal \n — convert them to real newlines
const APPLE_MAPS_PRIVATE_KEY = (process.env.APPLE_MAPS_PRIVATE_KEY || '').replace(/\\n/g, '\n');
// Optional: a pre-signed MapKit JWT supplied directly (use when you don't have the .p8 key)
const APPLE_MAPS_TOKEN = process.env.APPLE_MAPS_TOKEN || '';

/**
 * Apple MapKit JS token endpoint.
 * Precedence:
 *   1. APPLE_MAPS_TOKEN — return the pre-signed JWT directly (no private key needed).
 *   2. APPLE_MAPS_TEAM_ID + APPLE_MAPS_KEY_ID + APPLE_MAPS_PRIVATE_KEY — sign a new JWT.
 *   3. Neither configured → 503.
 * Returns: { token: string }
 */
app.get('/api/mapkit-token', (req, res) => {
    // Fast path: serve a pre-signed token directly from the environment
    if (APPLE_MAPS_TOKEN) {
        return res.json({ token: APPLE_MAPS_TOKEN });
    }

    if (!APPLE_MAPS_TEAM_ID || !APPLE_MAPS_KEY_ID || !APPLE_MAPS_PRIVATE_KEY) {
        return res.status(503).json({ error: 'Apple Maps credentials not configured.' });
    }

    try {
        const header = Buffer.from(
            JSON.stringify({ alg: 'ES256', kid: APPLE_MAPS_KEY_ID, typ: 'JWT' })
        ).toString('base64url');

        const now = Math.floor(Date.now() / 1000);
        const ttl = parseInt(process.env.MAPKIT_TOKEN_TTL_SECONDS, 10) || 1800;
        const payload = Buffer.from(
            JSON.stringify({ iss: APPLE_MAPS_TEAM_ID, iat: now, exp: now + ttl })
        ).toString('base64url');

        const message = `${header}.${payload}`;

        const sign = crypto.createSign('SHA256');
        sign.update(message);
        sign.end();
        // ES256 (ECDSA P-256) requires IEEE P1363 encoding (raw r||s), not DER
        const signature = sign
            .sign({ key: APPLE_MAPS_PRIVATE_KEY, dsaEncoding: 'ieee-p1363' })
            .toString('base64url');

        return res.json({ token: `${message}.${signature}` });
    } catch (err) {
        console.error('Error generating MapKit token:', err.message);
        return res.status(500).json({ error: 'Failed to generate MapKit token.' });
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
            error: 'TripIt API credentials not configured. Please set TRIPIT_API_KEY and TRIPIT_API_SECRET in your .env file.',
            code: 'tripit_not_configured',
            status: 500
        });
    }

    const userId = requireAuthenticatedAppUserId(req, res);
    if (!userId) {
        return;
    }

    const callbackUrl = req.query.callback;
    if (!callbackUrl) {
        return res.status(400).json({ error: 'callback query parameter is required' });
    }

    // Validate the callback URL originates from this server to prevent open redirects
    const requestOrigin = `${req.protocol}://${req.get('host')}`;
    let parsedCallbackUrl;
    try {
        parsedCallbackUrl = new URL(callbackUrl);
        if (parsedCallbackUrl.origin !== requestOrigin) {
            return res.status(400).json({ error: 'callback URL must match the application origin' });
        }
    } catch {
        return res.status(400).json({ error: 'callback must be a valid URL' });
    }

    const state = crypto.randomBytes(16).toString('hex');
    parsedCallbackUrl.searchParams.set('state', state);

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
            const parsedError = await parseTripItErrorBody(response);
            const payload = buildTripItErrorPayload({
                status: response.status,
                defaultCode: 'tripit_request_token_failed',
                defaultMessage: 'Failed to start TripIt authorization. Please try again.',
                parsedError
            });

            logTripItError({
                event: 'tripit_request_token_error',
                endpoint: '/api/tripit/connect',
                httpStatus: response.status,
                tripitCode: parsedError.tripitCode,
                message: 'TripIt request token error',
                extra: { oauth_advice: parsedError.oauthAdvice }
            });

            return res.status(response.status).json(payload);
        }

        const body = await response.text();
        const params = new URLSearchParams(body);
        const oauthToken = params.get('oauth_token');
        const oauthTokenSecret = params.get('oauth_token_secret');

        if (!oauthToken || !oauthTokenSecret) {
            return res.status(500).json({
                error: 'Invalid response from TripIt request token endpoint',
                code: 'tripit_request_token_invalid_response',
                status: 500
            });
        }

        // Persist the request token secret so we can use it in the callback step
        await tripitTokenStore.saveRequestToken({
            oauthToken,
            oauthTokenSecret,
            state,
            userId,
            callbackUrl: parsedCallbackUrl.toString()
        });

        const authorizeUrl = `${TRIPIT_AUTHORIZE_URL}?oauth_token=${encodeURIComponent(oauthToken)}&oauth_callback=${encodeURIComponent(parsedCallbackUrl.toString())}`;

        return res.json({ authorizeUrl });
    } catch (error) {
        logTripItError({
            event: 'tripit_request_token_exception',
            endpoint: '/api/tripit/connect',
            httpStatus: 500,
            message: error?.message || 'Failed to contact TripIt API'
        });
        return res.status(500).json({
            error: 'Failed to contact TripIt API',
            code: 'tripit_connect_failed',
            status: 500
        });
    }
});

/**
 * TripIt OAuth — Step 2: Exchange the authorized request token for an access token.
 * Called after TripIt redirects the user back to the application.
 * Sets a secure HttpOnly session cookie and notifies the popup opener of completion.
 *
 * Query: ?oauth_token=<token>
 */
app.get('/api/tripit/callback', async (req, res) => {
    const sendCallbackPage = (success, message, sessionId, errorCode) => {
        if (success && sessionId) {
            res.cookie(TRIPIT_SESSION_COOKIE_NAME, sessionId, TRIPIT_SESSION_COOKIE_OPTIONS);
        }

        const html = `<!DOCTYPE html><html><head><title>TripIt Authorization</title></head><body>
<p>${message}</p>
<script>
(function() {
    if (window.opener && !window.opener.closed) {
        window.opener.postMessage(${JSON.stringify({
            type: 'tripit_oauth_complete',
            success,
            errorCode: errorCode || null
        })}, window.location.origin);
    }
    window.close();
})();
</script>
</body></html>`;
        return res.type('html').send(html);
    };

    const logValidationFailure = (reason, details) => {
        console.error(JSON.stringify({
            event: 'tripit_callback_validation_failed',
            reason,
            ...details
        }));
    };

    if (!tripitOAuth) {
        return sendCallbackPage(false, 'TripIt API credentials not configured.', null, 'config_error');
    }

    const oauthToken = req.query.oauth_token;
    const state = req.query.state;
    if (!oauthToken || !state) {
        logValidationFailure('missing_callback_parameters', {
            hasOauthToken: Boolean(oauthToken),
            hasState: Boolean(state)
        });
        return sendCallbackPage(false, 'Authorization failed, please retry.', null, 'validation_failed');
    }

    const stored = await tripitTokenStore.getRequestToken(oauthToken);
    if (!stored) {
        logValidationFailure('unknown_or_expired_request_token', {
            oauthTokenPresent: true
        });
        return sendCallbackPage(false, 'Authorization failed, please retry.', null, 'validation_failed');
    }

    if (stored.state !== state) {
        await tripitTokenStore.deleteRequestToken(oauthToken);
        logValidationFailure('state_mismatch', {
            oauthTokenPresent: true
        });
        return sendCallbackPage(false, 'Authorization failed, please retry.', null, 'validation_failed');
    }

    // Clean up used request token
    await tripitTokenStore.deleteRequestToken(oauthToken);

    const requestData = {
        url: TRIPIT_ACCESS_TOKEN_URL,
        method: 'POST'
    };

    const token = {
        key: oauthToken,
        secret: stored.oauth_token_secret
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
            const parsedError = await parseTripItErrorBody(response);
            const payload = buildTripItErrorPayload({
                status: response.status,
                defaultCode: 'tripit_access_token_failed',
                defaultMessage: 'TripIt authorization could not be completed. Please try again.',
                parsedError
            });

            logTripItError({
                event: 'tripit_access_token_error',
                endpoint: '/api/tripit/callback',
                httpStatus: response.status,
                tripitCode: parsedError.tripitCode,
                message: 'TripIt access token error',
                extra: { oauth_advice: parsedError.oauthAdvice }
            });

            return sendCallbackPage(false, payload.error, null, payload.code);
        }

        const body = await response.text();
        const params = new URLSearchParams(body);
        const accessToken = params.get('oauth_token');
        const accessTokenSecret = params.get('oauth_token_secret');
        const tripitUserRef = params.get('tripit_user_ref');

        if (!accessToken || !accessTokenSecret) {
            return sendCallbackPage(false, 'TripIt authorization could not be completed. Please try again.', null, 'tripit_access_token_failed');
        }

        // Generate an opaque session id so the frontend never sees raw OAuth tokens
        const sessionId = crypto.randomBytes(32).toString('hex');
        await tripitTokenStore.saveAccessToken({
            sessionRef: sessionId,
            userId: stored.user_id,
            oauthToken: accessToken,
            oauthTokenSecret: accessTokenSecret,
            tripitUserRef
        });

        return sendCallbackPage(true, 'TripIt connected! This window will close.', sessionId, null);
    } catch (error) {
        logTripItError({
            event: 'tripit_access_token_exception',
            endpoint: '/api/tripit/callback',
            httpStatus: 500,
            message: error?.message || 'Failed to contact TripIt API'
        });
        return sendCallbackPage(false, 'Failed to contact TripIt API.', null, 'tripit_access_token_failed');
    }
});

/**
 * TripIt — Lightweight cookie-backed session status endpoint.
 *
 * Returns: { connected: boolean, lastSync: string|null, accountLabel: string|null }
 */
app.get('/api/tripit/status', async (req, res) => {
    const sessionId = getTripItCookieSessionId(req);
    const userId = getAuthenticatedAppUserId(req);

    if (!sessionId) {
        return res.json({ connected: false, lastSync: null, accountLabel: null });
    }

    const accessToken = userId
        ? await tripitTokenStore.getActiveAccessToken(sessionId, userId)
        : await tripitTokenStore.getActiveAccessTokenBySession(sessionId);

    if (!accessToken) {
        clearTripItSession(res);
        return res.json({ connected: false, lastSync: null, accountLabel: null });
    }

    return res.json({
        connected: true,
        lastSync: accessToken.last_trip_sync_at || null,
        accountLabel: accessToken.tripit_user_ref || accessToken.user_id || null
    });
});

/**
 * TripIt — Fetch the authenticated user's trips.
 *
 * Headers: x-onthego-user-ref: <appUserRef>
 * Auth: Authorization: Bearer <sessionId> or TripIt session cookie
 * Returns: TripIt API response (list of trips)
 */
app.get('/api/tripit/trips', async (req, res) => {
    if (!tripitOAuth) {
        return res.status(500).json({
            error: 'TripIt API credentials not configured.',
            code: 'tripit_not_configured',
            status: 500
        });
    }

    const userId = requireAuthenticatedAppUserId(req, res);
    if (!userId) {
        return;
    }

    const sessionId = getTripItSessionId(req);
    if (!sessionId) {
        return res.status(401).json({
            error: 'TripIt session is required',
            code: 'tripit_session_required',
            status: 401
        });
    }

    const accessToken = await tripitTokenStore.getActiveAccessToken(sessionId, userId);
    if (!accessToken) {
        return res.status(401).json({
            error: 'Authorization expired, please reconnect your TripIt account.',
            code: 'tripit_authorization_expired',
            status: 401
        });
    }

    const token = {
        key: accessToken.oauth_token,
        secret: accessToken.oauth_token_secret
    };

    try {
        const baseParams = new URLSearchParams({ format: 'json' });
        for (const key of TRIPIT_PASSTHROUGH_QUERY_PARAMS) {
            const rawValue = req.query?.[key];
            if (typeof rawValue === 'string' && rawValue.trim()) {
                baseParams.set(key, rawValue.trim());
            }
        }

        if (!baseParams.has('modified_since') && accessToken.last_trip_sync_at) {
            baseParams.set('modified_since', accessToken.last_trip_sync_at);
        }

        const pages = [];
        const requestedPages = [];

        for (let pageNum = 1; pageNum <= TRIPIT_MAX_TRIP_PAGES; pageNum += 1) {
            const pageParams = new URLSearchParams(baseParams);
            pageParams.set('page_num', String(pageNum));
            const pageUrl = `${TRIPIT_API_BASE_URL}/list/trip?${pageParams.toString()}`;
            requestedPages.push(pageNum);

            const response = await fetchTripItJson({ url: pageUrl, token });

            if (!response.ok) {
                const status = response.status;
                const retryAfter = response.headers.get('retry-after');
                const parsedError = await parseTripItErrorBody(response);
                const tripItError = buildTripItErrorPayload({
                    status,
                    defaultCode: isTripItRetryableStatus(status)
                        ? 'tripit_api_temporarily_unavailable'
                        : 'tripit_api_error',
                    defaultMessage: isTripItRetryableStatus(status)
                        ? 'TripIt API temporarily unavailable'
                        : 'TripIt API error',
                    parsedError,
                    retryAfter
                });

                logTripItError({
                    event: 'tripit_trips_error',
                    endpoint: '/api/tripit/trips',
                    httpStatus: status,
                    tripitCode: parsedError.tripitCode,
                    message: 'TripIt list trips error',
                    extra: { page: pageNum, retry_after: retryAfter }
                });

                return res.status(status).json(tripItError);
            }

            const pageData = await response.json();
            pages.push(pageData);

            const { maxPage } = extractTripPagination(pageData);
            if (pageNum >= maxPage) {
                break;
            }
        }

        const finalPagination = extractTripPagination(pages[pages.length - 1]);
        const truncated = finalPagination.maxPage > TRIPIT_MAX_TRIP_PAGES;
        const mergedData = mergeTripPages(pages);

        await tripitTokenStore.updateLastTripSyncAt({
            sessionRef: sessionId,
            userId
        });

        if (truncated) {
            res.set('x-onthego-tripit-pages-truncated', 'true');
        }

        return res.json({
            ...mergedData,
            sync_metadata: {
                requested_pages: requestedPages.length,
                max_page: finalPagination.maxPage,
                page_size: finalPagination.pageSize,
                truncated
            }
        });
    } catch (error) {
        if (error?.name === 'AbortError') {
            logTripItError({
                event: 'tripit_trips_timeout',
                endpoint: '/api/tripit/trips',
                httpStatus: 504,
                message: 'TripIt trips request timed out'
            });
            return res.status(504).json({
                error: 'TripIt API request timed out',
                code: 'tripit_request_timed_out',
                status: 504,
                timeout_ms: TRIPIT_FETCH_TIMEOUT_MS
            });
        }

        logTripItError({
            event: 'tripit_trips_exception',
            endpoint: '/api/tripit/trips',
            httpStatus: 500,
            message: error?.message || 'Failed to contact TripIt API'
        });
        return res.status(500).json({
            error: 'Failed to contact TripIt API',
            code: 'tripit_trips_failed',
            status: 500
        });
    }
});

/**
 * TripIt — Revoke the current TripIt session.
 *
 * Auth: Authorization: Bearer <sessionId> or TripIt session cookie
 * Optional header: x-onthego-user-ref: <appUserRef>
 * Returns: { success: true, connected: false, revoked: boolean }
 */
app.post('/api/tripit/disconnect', async (req, res) => {
    const userId = getAuthenticatedAppUserId(req);
    const sessionId = getTripItSessionId(req);
    const cookieSessionId = getTripItCookieSessionId(req);

    let revoked = false;
    if (sessionId) {
        if (userId) {
            revoked = await tripitTokenStore.revokeAccessToken(sessionId, userId);
        }

        if (!revoked) {
            revoked = await tripitTokenStore.revokeAccessTokenBySession(sessionId);
        }
    }

    if (cookieSessionId) {
        clearTripItSession(res);
    }

    return res.json({ success: true, connected: false, revoked });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`OnTheGo proxy server running on http://localhost:${PORT}`);
    });
}

module.exports = { app };
