# JavaScript Rules & Standards (`js/`)

## Module Architecture

Each file exports a single **object-literal singleton** module. Do not use classes, prototypes, or ES modules (`import`/`export`). Scripts are loaded via `<script>` tags in `index.html` in dependency order:

1. `config.js` — Constants and mock data (no dependencies)
2. `api.js` — API integration and utility functions (depends on `CONFIG`)
3. `ui.js` — UI rendering and interactions (depends on `API`, `MapModule`)
4. `map.js` — Leaflet local map (depends on `CONFIG`, `API`, `UI`, Leaflet `L`)
5. `worldmap.js` — Leaflet world map (depends on `CONFIG`, `API`, `MOCK_*`, Leaflet `L`)
6. `account.js` — User account management (depends on `USER_ACCOUNT`)
7. `concierge.js` — AI concierge (depends on `CONFIG`, `UI`, `MOCK_*`)
8. `app.js` — Orchestrator, loaded last (depends on all other modules)

## Module Pattern

```js
// Module comment describing purpose
const ModuleName = {
    // State properties
    someState: null,

    /**
     * Initialize the module
     */
    init() {
        // Setup logic
    },

    /**
     * Method description
     * @param {type} paramName - Description
     * @returns {type} Description
     */
    methodName(paramName) {
        // Implementation
    }
};
```

### Key rules:
- Every module must have an `init()` method as its entry point
- Use `this` to reference sibling properties/methods within a module
- Some modules (`worldmap.js`) use `var self = this` for callback contexts — prefer arrow functions in new code
- Register modules globally in `app.js`: `window.ModuleName = ModuleName`

## Coding Conventions

### Variables & Functions
- Use `const` for values that won't be reassigned; `let` for mutable bindings
- Never use `var` in new code (some legacy `var` exists in `worldmap.js`)
- Use `camelCase` for all variables and function names
- Use `UPPER_SNAKE_CASE` for top-level constants: `CONFIG`, `MOCK_RESTAURANTS`, `DEFAULT_SEARCH_RADIUS`

### Functions
- Use **arrow functions** for callbacks and short expressions
- Use **regular function syntax** only inside object literals (for `this` binding)
- All public methods must have **JSDoc comments** with `@param` and `@returns`
- Keep functions focused and single-purpose

### Async Patterns
- Use `async/await` with `try-catch` for all asynchronous operations
- Never use raw `.then()/.catch()` promise chains in new code
- Simulate API delays with: `await new Promise(resolve => setTimeout(resolve, ms))`

### DOM Access
- Primary: `document.getElementById('elementId')`
- Multi-element: `document.querySelectorAll('.class-name')`
- Use **optional chaining** for DOM element values: `document.getElementById('filter')?.value || ''`
- Always check element existence before manipulation: `if (!element) return`
- Create dynamic elements with `document.createElement()` and set `.innerHTML` for complex templates

### Cross-Module Communication
- Check module availability before calling: `if (window.MapModule && MapModule.map)`
- Check with `typeof` for early-loaded modules: `if (typeof WorldMap !== 'undefined')`
- Use `window.` prefix when referencing modules from callbacks or closures

### Event Handling
- Use `addEventListener()` exclusively — no inline `onclick` attributes
- Use **event delegation** for dynamic content (e.g., Account disconnect buttons)
- Prevent default on form submissions: `e.preventDefault()`
- Stop propagation when needed: `e.stopPropagation()` (e.g., map control clicks)
- Check if a click target is a link before handling card clicks:
  ```js
  if (e.target.tagName === 'A' || e.target.closest('a')) return;
  ```

### String Templating
- Use **template literals** (backticks) for HTML generation and multi-line strings
- Use `${}` interpolation — never string concatenation for HTML building
- Note: `worldmap.js` uses string concatenation (`+`) for historical reasons — new code should use template literals

## File-Specific Conventions

### `config.js`
- All app constants go in the `CONFIG` object
- Mock data arrays (`MOCK_RESTAURANTS`, `MOCK_TRAVEL_HISTORY`, `MOCK_UPCOMING_TRIPS`) are top-level `const` declarations
- Mock data must match Yelp API response structure for restaurant objects
- Helper functions like `getUniqueCuisines()` are top-level function declarations
- User state object `USER_ACCOUNT` is a mutable top-level `const`

### `api.js`
- Contains all Yelp API integration and data utility functions
- `fetchRestaurants()` must always fall back to `getMockRestaurants()` on error
- URL builder methods (`getSocialMediaLinks`, `getDeliveryLinks`, `getReservationLinks`) return plain objects with URLs
- Always `encodeURIComponent()` restaurant names and addresses in URLs
- `calculateDistance()` uses the Haversine formula — returns meters
- `formatDistance()` converts meters to miles/feet display strings
- `getStarRating()` returns HTML string with Font Awesome star icons

### `ui.js`
- Manages the restaurant list sidebar: rendering, filtering, sorting, search
- `setRestaurants()` is the primary entry point for updating the restaurant list
- `applyFilters()` reads filter DOM values directly and re-renders
- `createRestaurantCard()` returns a DOM element (not HTML string)
- Card click events must not interfere with nested link clicks
- After rendering, always call `MapModule.addRestaurantMarkers()` to sync map

### `map.js`
- Wraps Leaflet.js for the local restaurant map
- Track programmatic map moves with `_programmaticMove` flag to avoid showing "Search This Area"
- Custom iOS-style markers use `L.divIcon` with CSS classes
- Popup content mirrors restaurant card format from `ui.js`
- `setSearchCenter()` is the primary method for centering map and loading restaurants
- Always call `map.invalidateSize()` after container visibility changes (with `setTimeout`)

### `worldmap.js`
- Wraps Leaflet.js for the world travel history map
- Uses `var` and `function(){}` in some places (legacy) — new code should use `const`/`let` and arrows
- Trip markers are colored: orange (`#FF6B35`) for past, blue (`#004E89`) for upcoming
- `generateNearbyRestaurants()` creates simulated restaurant data per city
- Clicking a trip marker navigates to Local view via `App.openTripFromWorldMap()`

### `account.js`
- Manages user profile, settings, and third-party account connections
- Uses `localStorage` for persistence with keys `onthego_profile` and `onthego_settings`
- Simulates account connections with `setTimeout` delays
- Tab navigation uses `data-tab` attribute matching
- Shows ephemeral notifications via dynamically created DOM elements

### `concierge.js`
- AI-powered business dining recommendations via OpenAI
- Uses `escapeHtml()` for all user-visible AI-generated content (XSS prevention)
- Panel opens/closes with CSS class toggling (`.open`, `.visible`)
- Three-state UI flow: Form → Loading → Results → Reservation
- Pre-fills destination from the active trip context

### `app.js`
- Orchestrates all modules — calls `init()` on each in sequence
- Manages view switching between `world`, `local`, and `travellog`
- Contains trip selection logic (dropdown, GPS button)
- `onLocationReady()` is the callback triggered after location is determined
- DOMContentLoaded initialization:
  ```js
  if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
      App.init();
  }
  ```

## Error Handling Patterns

```js
// API calls with fallback
try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return data;
} catch (error) {
    console.error('Error description:', error);
    return fallbackData;
}

// Library availability check
if (typeof L === 'undefined') {
    console.warn('Leaflet library not loaded. Feature disabled.');
    return;
}

// Element existence check
const element = document.getElementById('myElement');
if (!element) return;
```

## State Management

- **No reactive state system** — direct DOM manipulation after data changes
- Filter state is read from DOM elements on each filter application
- Module state is stored as properties on the module object (e.g., `UI.restaurants`, `MapModule.markers`)
- Persistent state uses `localStorage` (Account module)
- Global shared state: `USER_ACCOUNT` object in `config.js`
