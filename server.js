const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const YELP_API_KEY = process.env.YELP_API_KEY;
const CACHE_TTL_MS = Number(process.env.YELP_CACHE_TTL_MS) || 5 * 60 * 1000;
const YELP_BASE_URL = 'https://api.yelp.com/v3/businesses/search';

const cache = new Map();

const buildCacheKey = (params) => params.toString();

const getCachedResponse = (cacheKey) => {
    const cached = cache.get(cacheKey);
    if (!cached) {
        return null;
    }

    if (cached.expiresAt <= Date.now()) {
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

app.get('/api/yelp', async (req, res) => {
    if (!YELP_API_KEY) {
        return res.status(500).json({ error: 'Yelp API key not configured' });
    }

    const { latitude, longitude, radius, limit, categories, sort_by: sortBy } = req.query;

    if (!latitude || !longitude) {
        return res.status(400).json({ error: 'latitude and longitude are required' });
    }

    const params = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        radius: (radius || '8047').toString(),
        limit: (limit || '20').toString(),
        categories: (categories || 'restaurants').toString(),
        sort_by: (sortBy || 'rating').toString()
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
        console.error('Error contacting Yelp API:', error);
        return res.status(500).json({ error: 'Failed to contact Yelp API' });
    }
});

app.listen(PORT, () => {
    console.log(`OnTheGo proxy server running on http://localhost:${PORT}`);
});
