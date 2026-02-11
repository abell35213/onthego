const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const parsedPort = parseInt(process.env.PORT, 10);
const PORT = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000;
const YELP_API_KEY = process.env.YELP_API_KEY;
const parsedCacheTtlSeconds = parseInt(process.env.YELP_CACHE_TTL_SECONDS, 10);
const parsedCacheTtlMs = parseInt(process.env.YELP_CACHE_TTL_MS, 10);
const CACHE_TTL_MS = Number.isFinite(parsedCacheTtlSeconds) && parsedCacheTtlSeconds > 0
    ? parsedCacheTtlSeconds * 1000
    : (Number.isFinite(parsedCacheTtlMs) && parsedCacheTtlMs > 0
        ? parsedCacheTtlMs
        : 5 * 60 * 1000);
const YELP_BASE_URL = 'https://api.yelp.com/v3/businesses/search';
const DEFAULT_SEARCH_RADIUS = 8047;
const DEFAULT_SEARCH_LIMIT = 20;
const DEFAULT_CATEGORIES = 'restaurants';
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

app.listen(PORT, () => {
    console.log(`OnTheGo proxy server running on http://localhost:${PORT}`);
});
