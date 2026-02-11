const YELP_BASE_URL = 'https://api.yelp.com/v3/businesses/search';
const DEFAULT_SEARCH_RADIUS = 8047;
const MAX_SEARCH_RADIUS_METERS = 40000;
const DEFAULT_SEARCH_LIMIT = 20;
const DEFAULT_CATEGORIES = 'restaurants';
const DEFAULT_SORT_BY = 'rating';
const DEFAULT_CACHE_TTL_SECONDS = 300;
const CACHE_TTL_MS_ENV = parseInt(process.env.YELP_CACHE_TTL_MS, 10) || 0;
const CACHE_TTL_SECONDS = Number.isFinite(CACHE_TTL_MS_ENV) && CACHE_TTL_MS_ENV > 0
    ? Math.round(CACHE_TTL_MS_ENV / 1000)
    : DEFAULT_CACHE_TTL_SECONDS;
const STALE_WHILE_REVALIDATE_SECONDS = CACHE_TTL_SECONDS * 2;

const parseRequestBody = (req) => {
    if (!req.body) {
        return {};
    }

    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        } catch (error) {
            const bodySnippet = req.body.slice(0, 200);
            console.warn(
                'Invalid JSON body received for Yelp search request.',
                error?.message || String(error),
                `bodySnippet: ${bodySnippet}`
            );
            return {};
        }
    }

    return req.body;
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const YELP_API_KEY = process.env.YELP_API_KEY;
    if (!YELP_API_KEY) {
        return res.status(500).json({
            error: 'Yelp API key not configured. Please set YELP_API_KEY in your environment.'
        });
    }

    const { latitude, longitude, radius, limit, categories, sort_by: sortBy } = parseRequestBody(req);

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

    if (hasRadius && (!Number.isFinite(radiusValue) || radiusValue <= 0 || radiusValue > MAX_SEARCH_RADIUS_METERS)) {
        return res.status(400).json({
            error: `radius must be a number between 1 and ${MAX_SEARCH_RADIUS_METERS}`
        });
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
        res.setHeader(
            'Cache-Control',
            `s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`
        );
        return res.status(200).json(data);
    } catch (error) {
        console.error('Error contacting Yelp API:', error);
        return res.status(500).json({ error: 'Failed to contact Yelp API' });
    }
};
