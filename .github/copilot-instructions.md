# Copilot Instructions for OnTheGo

## Project Overview

OnTheGo is a full-featured restaurant discovery web application designed for traveling salespeople and anyone on the go. The app provides an interactive map, detailed restaurant information, and convenient links to reviews, social media, delivery services, and reservation platforms.

## Technology Stack

- **Frontend Framework**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Mapping Libraries**: 
  - Leaflet.js with OpenStreetMap tiles for local restaurant view
  - Cesium.js for 3D world globe visualization
- **APIs**: Yelp Fusion API for restaurant data
- **Icons**: Font Awesome 6
- **Styling**: Custom CSS with CSS Variables for theming
- **Geolocation**: Browser Geolocation API

## Project Structure

```
onthego/
├── index.html              # Main HTML page
├── css/
│   └── styles.css          # All application styles
├── js/
│   ├── app.js              # Main application logic and view management
│   ├── map.js              # Leaflet map initialization (local view)
│   ├── worldmap.js         # Cesium 3D globe (world view)
│   ├── api.js              # API calls and data utilities
│   ├── ui.js               # UI rendering and interactions
│   ├── account.js          # User account and authentication
│   └── config.js           # Configuration and mock data
├── .github/                # GitHub configuration
└── README.md               # Documentation
```

## Code Style and Conventions

### JavaScript
- Use **Vanilla JavaScript** (no frameworks like React, Vue, or Angular)
- Use **ES6+ features** (const/let, arrow functions, template literals, async/await)
- Follow **modular pattern** with object namespaces (e.g., `App`, `UI`, `MapModule`, `WorldMap`, `Account`)
- Use **JSDoc comments** for functions with clear parameter and return type documentation
- Prefer **async/await** over promise chains for asynchronous operations
- Keep functions focused and single-purpose
- Use descriptive variable names (e.g., `restaurantCard`, not `rc`)

### CSS
- Use **mobile-first** responsive design approach
- Utilize **CSS Variables** (custom properties) defined in `:root` for theming
- Follow **BEM-like naming** for CSS classes where appropriate
- Responsive breakpoints:
  - 480px: Small mobile devices
  - 768px: Tablets
  - 1024px: Desktop
- Keep styles organized by component/section

### HTML
- Use **semantic HTML5** elements (header, nav, main, section, article, footer)
- Include proper **accessibility attributes** (aria-labels, alt text, roles)
- Maintain **clean indentation** (2 spaces)

## Development Practices

### API Integration
- **Yelp Fusion API** is the primary data source
- Always include **mock data fallback** in `config.js` for development and demos
- Handle **CORS issues** gracefully (Yelp API has CORS restrictions)
- Include proper **error handling** for API calls
- Use `async/await` with try-catch blocks for API requests

### Mock Data
- Mock restaurant data is defined in `MOCK_RESTAURANTS` array in `config.js`
- Mock data should match the Yelp API response structure
- Include realistic sample data with all required fields (name, rating, location, etc.)

### Geolocation
- Always check for browser support before using Geolocation API
- Provide **clear fallback** to default location (San Francisco) if denied
- Handle geolocation errors gracefully with user-friendly messages

### Map Features
- **Local View**: Uses Leaflet.js for 2D interactive maps with restaurant markers
- **World View**: Uses Cesium.js for 3D globe visualization with travel history
- Both maps should maintain their own initialization and state
- Use proper cleanup when switching between views

### View Management
- App supports three view modes: `world`, `local`, and `travellog`
- Current view is tracked in `App.currentView`
- Always hide/show elements properly when switching views
- Ensure map instances are initialized only when needed

## Common Tasks

### Adding a New Restaurant Feature
1. Update `config.js` if adding new configuration
2. Add business logic to appropriate module (`api.js`, `ui.js`, etc.)
3. Update UI in `ui.js` to render new feature
4. Update styles in `css/styles.css`
5. Test with both real API and mock data

### Adding a New Filter or Sort Option
1. Update filter/sort UI in HTML
2. Add filter logic in `ui.js`
3. Update `API.searchRestaurants()` if needed
4. Ensure filters work with both API and mock data

### Adding External Service Links
1. Add link button in restaurant card template in `ui.js`
2. Update styles for new button in `css/styles.css`
3. Follow existing patterns (Uber Eats, DoorDash, OpenTable, etc.)
4. Use proper URL encoding for restaurant names and addresses

### Styling Changes
1. Use CSS variables from `:root` for colors and spacing
2. Test on mobile devices (or browser dev tools)
3. Maintain responsive behavior at all breakpoints
4. Keep consistent with existing design patterns

## Testing

This is a vanilla JavaScript project without a formal testing framework. When making changes:

- **Manual testing is primary**: Test in browser at different screen sizes
- **Test with geolocation**: Both allowed and denied states
- **Test with API**: Both with real Yelp API key and without (mock data)
- **Test map interactions**: Markers, popups, zoom, pan
- **Test filters and search**: All combinations should work
- **Cross-browser testing**: Chrome, Firefox, Safari, Edge
- **Mobile testing**: Test on actual mobile devices when possible

## Running the Application

### Local Development
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server -p 8000

# Or use VS Code Live Server extension
```

Then navigate to `http://localhost:8000`

### Configuration
- Copy `.env.example` to `.env` for environment variables
- Update `js/config.js` with your Yelp API key (optional)
- App works with mock data if no API key is provided

## Linting and Build

Currently, there is no build process or linting configured. The project uses plain HTML, CSS, and JavaScript files served directly.

When adding linting:
- Consider ESLint for JavaScript
- Consider Stylelint for CSS
- Use `.gitignore` to exclude linter cache files

## API Keys and Secrets

- **Never commit API keys** to the repository
- Use `.env` for environment variables (already in `.gitignore`)
- Yelp API key goes in `js/config.js` for client-side use
- Note: Client-side API keys are visible to users; use backend proxy for production

## Deployment

The app can be deployed to any static hosting service:
- DigitalOcean App Platform (configured in `.do` directory)
- Netlify, Vercel, GitHub Pages
- AWS S3, Cloudflare Pages

For production with Yelp API:
- Create a backend proxy to handle API requests
- Update `YELP_API_URL` in `config.js` to point to your proxy
- This avoids CORS issues and protects API keys

## Common Issues and Solutions

### CORS Errors with Yelp API
- Yelp API has CORS restrictions for browser-based requests
- Solution: Use mock data for demos, or create a backend proxy for production

### Geolocation Not Working
- Requires HTTPS in production (HTTP only works on localhost)
- User must grant permission in browser
- Fallback to San Francisco coordinates if denied

### Map Not Rendering
- Check that Leaflet.js and Cesium.js CDN links are accessible
- Ensure proper initialization order (wait for DOM ready)
- Check console for JavaScript errors

### Mobile Layout Issues
- Always test responsive behavior with browser dev tools
- Use mobile-first approach when adding new features
- Test touch interactions on actual mobile devices

## Best Practices for Contributors

1. **Keep it simple**: This is a vanilla JS project; avoid adding frameworks
2. **Mobile-first**: Always design for mobile screens first
3. **Graceful degradation**: Handle API failures, geolocation denials, etc.
4. **Accessibility**: Include proper ARIA labels and semantic HTML
5. **Performance**: Minimize API calls, use efficient DOM updates
6. **Documentation**: Update README.md when adding major features
7. **Mock data**: Always test with mock data as fallback

## Future Enhancement Considerations

When adding new features, consider:
- User authentication and saved favorites
- Offline support with service workers
- Progressive Web App (PWA) capabilities
- Backend API for better Yelp integration
- Dark mode theme toggle
- Multi-language support
- More delivery service integrations
- Dietary restriction filters
- User reviews and ratings

---

**Remember**: This is a client-side web application focused on simplicity and accessibility. Keep the codebase clean, well-documented, and easy to understand for future contributors.
