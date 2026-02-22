# API Rules & Standards (`api/`)

## Overview

The `api/` directory contains **Vercel serverless functions** that act as backend proxies for external APIs. These functions protect API keys from client-side exposure and handle CORS transparently.

## Serverless Function Convention

Each file in `api/` exports a single async handler function using **CommonJS** (`module.exports`):

```js
module.exports = async (req, res) => {
    // Handler logic
};
```

This follows Vercel's serverless function convention. The filename maps to the API route (e.g., `api/yelp-search.js` → `POST /api/yelp-search`).

## Module System

- Use **CommonJS** (`require`/`module.exports`) — not ES modules
- This matches the root `package.json` setting: `"type": "commonjs"`
- Keep functions self-contained — avoid importing from `js/` frontend modules

## Coding Standards

### Constants
Define configuration constants at the top of the file:
```js
const YELP_BASE_URL = 'https://api.yelp.com/v3/businesses/search';
const DEFAULT_SEARCH_RADIUS = 8047;
const MAX_SEARCH_RADIUS_METERS = 40000;
const DEFAULT_SEARCH_LIMIT = 20;
const DEFAULT_CATEGORIES = 'restaurants,bars,breweries,nightlife';
const DEFAULT_SORT_BY = 'rating';
```

### Environment Variables
- Read API keys from `process.env` — never hardcode secrets
- Validate API key presence before processing requests:
  ```js
  const YELP_API_KEY = process.env.YELP_API_KEY;
  if (!YELP_API_KEY) {
      return res.status(500).json({ error: 'API key not configured.' });
  }
  ```

### Request Handling
- Enforce HTTP method: return `405 Method Not Allowed` for non-POST requests
- Parse request body defensively — handle string, object, and missing body cases
- Validate all required parameters and return `400 Bad Request` with descriptive error messages
- Use `Number()` and `Number.isFinite()` for numeric validation — not `parseInt` alone

### Response Format
- Always return JSON responses with `res.status(code).json(data)`
- Error responses follow: `{ error: 'descriptive message' }`
- Success responses pass through the upstream API response structure
- Set cache headers for CDN/edge caching:
  ```js
  res.setHeader('Cache-Control', `s-maxage=${ttl}, stale-while-revalidate=${stale}`);
  ```

### Error Handling
```js
try {
    const response = await fetch(url, { headers: { ... } });
    if (!response.ok) {
        return res.status(response.status).json({
            error: 'Upstream API error',
            status: response.status
        });
    }
    const data = await response.json();
    return res.status(200).json(data);
} catch (error) {
    console.error('Error description:', error?.message || String(error));
    return res.status(500).json({ error: 'Failed to contact API' });
}
```

### Input Validation Pattern
```js
// 1. Check required fields
if (!latitude || !longitude) {
    return res.status(400).json({ error: 'latitude and longitude are required' });
}

// 2. Convert and validate types
const latitudeValue = Number(latitude);
if (!Number.isFinite(latitudeValue)) {
    return res.status(400).json({ error: 'latitude must be a valid number' });
}

// 3. Validate ranges (for optional fields, only if provided)
const hasRadius = radius !== undefined;
if (hasRadius && (radiusValue <= 0 || radiusValue > MAX_SEARCH_RADIUS_METERS)) {
    return res.status(400).json({ error: `radius must be between 1 and ${MAX_SEARCH_RADIUS_METERS}` });
}

// 4. Apply defaults for optional parameters
const normalizedCategories = categories || DEFAULT_CATEGORIES;
```

## Caching

- Cache TTL is configurable via environment variables (`YELP_CACHE_TTL_SECONDS`, `YELP_CACHE_STALE_SECONDS`)
- Support legacy `YELP_CACHE_TTL_MS` with automatic conversion
- Default cache TTL: 300 seconds (5 minutes)
- Stale-while-revalidate defaults to 2× the cache TTL
- Serverless functions use HTTP `Cache-Control` headers (CDN caching)
- Express `server.js` uses an in-memory `Map` cache (process-local)

## Relationship to `server.js`

The `api/` directory mirrors endpoints defined in `server.js`:
- `api/yelp-search.js` ↔ `server.js` POST `/api/yelp-search`
- Additional endpoints (e.g., `/api/concierge`) are in `server.js` only

When adding a new endpoint:
1. Add it to `server.js` for local Express development
2. Optionally create a matching `api/*.js` file for Vercel deployment
3. Keep validation and business logic consistent between both

## Security

- API keys are read from environment variables only
- Validate and sanitize all user inputs before passing to external APIs
- Use `Authorization: Bearer` header pattern for API key transmission
- Never expose upstream API keys or internal error details to the client
- Use `error?.message || String(error)` pattern for safe error logging
