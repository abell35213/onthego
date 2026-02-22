# OnTheGo — Project Rules & Standards

## Project Overview

OnTheGo is a restaurant discovery SPA for business travelers. It provides an interactive map, restaurant details, and links to reviews, delivery, and reservation platforms. The app uses **vanilla JavaScript** (no frameworks), HTML5, CSS3, Leaflet.js for maps, and the Yelp Fusion API for data.

## Architecture

- **Single Page Application** with three views: World Map (`world`), Restaurant List (`local`), and Travel Log (`travellog`)
- **Module pattern** using object-literal singletons (`App`, `API`, `UI`, `MapModule`, `WorldMap`, `Account`, `Concierge`)
- Modules are registered globally on `window` (e.g., `window.App = App`)
- **No build step** — plain HTML/CSS/JS served directly from disk or a static server
- **Express.js backend** (`server.js`) acts as a proxy for Yelp and OpenAI APIs
- **Vercel serverless** variant in `api/yelp-search.js` for edge deployment

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS (ES6+), HTML5, CSS3 |
| Mapping | Leaflet.js with OpenStreetMap / Esri / Google tiles |
| Icons | Font Awesome 6 (CDN) |
| Fonts | Inter (Google Fonts) |
| APIs | Yelp Fusion, OpenAI Chat Completions |
| Backend | Express.js (Node.js), dotenv |
| Serverless | Vercel Functions (`api/` directory) |

## File Structure

```
onthego/
├── index.html          # Main SPA entry point
├── homepage.html       # Alternative landing page
├── server.js           # Express backend proxy
├── package.json        # Node dependencies (express, dotenv)
├── .env.example        # API key templates
├── js/
│   ├── config.js       # Constants, mock data, helper functions
│   ├── app.js          # App orchestrator, view management, trip selection
│   ├── api.js          # Yelp API integration, URL builders, utilities
│   ├── ui.js           # Restaurant list rendering, filtering, search
│   ├── map.js          # Leaflet local map with restaurant markers
│   ├── worldmap.js     # Leaflet world map with travel history
│   ├── account.js      # User profile, account connections, settings
│   └── concierge.js    # AI concierge (OpenAI integration)
├── css/
│   └── styles.css      # Single stylesheet with CSS variables theming
├── api/
│   └── yelp-search.js  # Vercel serverless Yelp proxy
└── screenshots/        # App screenshots for documentation
```

## General Coding Rules

### Language & Style
- Use **vanilla JavaScript only** — no frameworks (React, Vue, Angular, etc.)
- Use **ES6+ features**: `const`/`let`, arrow functions, template literals, async/await, destructuring, spread operator
- Use **4-space indentation** consistently across JS, CSS, and HTML
- Use **camelCase** for variables and functions
- Use **UPPER_SNAKE_CASE** for constants (e.g., `CONFIG`, `MOCK_RESTAURANTS`, `DEFAULT_SEARCH_RADIUS`)
- Use **kebab-case** for CSS classes (e.g., `.restaurant-card`, `.trip-sidebar`)
- Use **descriptive names** — `restaurantCard` not `rc`, `formatDistance` not `fmtDst`

### Module Pattern
- Each module is a `const` object literal with an `init()` method
- Modules reference each other via `window` globals with existence checks: `if (typeof WorldMap !== 'undefined')`
- Cross-module calls use defensive patterns: `if (window.MapModule && MapModule.map)`
- All modules are made globally available at the end of `app.js`:
  ```js
  window.App = App;
  window.UI = UI;
  window.MapModule = MapModule;
  ```

### Documentation
- Use **JSDoc comments** for all public functions with `@param` and `@returns` tags
- Module-level comments describe the module's purpose (first line of each file)
- Sparse inline comments — rely on descriptive naming

### Error Handling
- Use `async/await` with `try-catch` blocks for all API calls
- **Graceful fallback**: if the Yelp API fails or is not configured, fall back to mock data
- Check for library availability before use: `if (typeof L === 'undefined')` for Leaflet
- Handle geolocation errors with user-friendly messages and default location fallback (San Francisco)
- Console log errors with `console.error()` for debugging

### Security
- **Never commit API keys** — use `.env` for secrets (already in `.gitignore`)
- Use `rel="noopener noreferrer"` on all `target="_blank"` links
- Escape HTML in user-facing content (see `Concierge.escapeHtml()`)
- Validate and sanitize all API inputs on the server side (check `Number.isFinite()`, range limits)

### DOM Interaction
- Use `document.getElementById()` as the primary DOM query method
- Use `document.querySelectorAll()` for multi-element selections
- Use `addEventListener()` for event binding — no inline handlers
- Use **event delegation** where appropriate (e.g., Account module disconnect buttons)
- Check element existence before interacting: `if (!element) return`

### Data Patterns
- Mock data arrays in `config.js` follow Yelp API response structure
- Restaurant objects have: `id`, `name`, `image_url`, `categories[]`, `rating`, `review_count`, `price`, `location{}`, `coordinates{}`, `display_phone`, `distance`, `url`
- Additional app-specific fields: `tags[]`, `visited`, `visitDate`, `instagram_photos[]`
- User state is stored in `localStorage` with keys prefixed `onthego_`

### External Links
- All external links open in new tabs with `target="_blank" rel="noopener noreferrer"`
- URL-encode restaurant names and addresses with `encodeURIComponent()` for external service links
- Supported external services: Yelp, Uber Eats, DoorDash, Grubhub, OpenTable, Resy, Instagram, Facebook, Twitter, Google Maps, Apple Maps

## Environment & Configuration

### Environment Variables (`.env`)
```
YELP_API_KEY=            # Required for live restaurant data
OPENAI_API_KEY=          # Required for AI concierge
PORT=3000                # Express server port
YELP_CACHE_TTL_SECONDS=300
YELP_CACHE_STALE_SECONDS=600
YELP_CACHE_TTL_MS=300000 # Legacy millisecond support
CORS_PROXY=              # Optional CORS proxy URL
```

### Running Locally
```bash
npm start                 # Runs Express server on PORT (default 3000)
python -m http.server 8000  # Alternative: static file server
npx http-server -p 8000    # Alternative: Node static server
```

## Testing

- **No formal test framework** — manual browser testing is primary
- Test at responsive breakpoints: 480px, 768px, 1024px, desktop
- Test with and without API keys (mock data fallback)
- Test geolocation: both allowed and denied states
- Test all three views: World Map, Restaurant List, Travel Log
- Cross-browser: Chrome, Firefox, Safari, Edge

## Deployment

- **Static hosting**: Netlify, Vercel, GitHub Pages, AWS S3, Cloudflare Pages
- **Vercel serverless**: `api/` directory auto-deploys as serverless functions
- **Express backend**: `server.js` for traditional Node hosting (DigitalOcean, Heroku)
- For production: use backend proxy to protect API keys and avoid CORS issues
