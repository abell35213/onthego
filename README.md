# OnTheGo 🍽️

**OnTheGo** is a full-featured web application designed for traveling salespeople and anyone on the go who needs to quickly find the best restaurants nearby. The app provides an interactive map, detailed restaurant information, and convenient links to reviews, social media, delivery services, and reservation platforms — all in one place.

![OnTheGo Preview](color.gif)
*Note: Replace with actual screenshot after deployment*

## ✨ Features

### 🗺️ Interactive Map
- **Leaflet.js** powered map with **OpenStreetMap** tiles
- Automatic geolocation to center map on your current location
- Restaurant markers with interactive popups
- Click markers to view restaurant details
- Visual distinction between user location and restaurant locations

### 📋 Restaurant Discovery
- Curated, scrollable list of nearby restaurants
- Each restaurant card displays:
  - Restaurant name and cuisine type
  - Star rating and review count (from Yelp)
  - Price level indicator ($, $$, $$$, $$$$)
  - Distance from your location
  - Full address and phone number
  - High-quality thumbnail image

### 🔍 Smart Filtering & Search
- **Search bar** to find restaurants by name or cuisine type
- **Filter by cuisine** - Italian, Japanese, Mexican, Thai, and more
- **Filter by price level** - Budget to Very Expensive
- **Sort options** - By rating, distance, or review count
- Real-time filtering with instant results

### ⭐ Yelp Integration
- Direct **"View on Yelp"** links for each restaurant
- Display Yelp ratings and review counts
- Seamless integration with Yelp Fusion API
- Automatic fallback to sample data when API is not configured

### 📱 Social Media Links
- Quick access to restaurant social media profiles:
  - **Instagram** - View photos and stories
  - **Facebook** - Check their page and posts
  - **Twitter/X** - See latest updates
- Fallback to Google search if direct links unavailable

### 🚗 Delivery Options
- One-click access to popular delivery platforms:
  - **Uber Eats** - Order delivery instantly
  - **DoorDash** - Get food delivered fast
  - **Grubhub** - Browse menus and order
- Smart search integration for each platform

### 🍽️ Make Reservations
- Quick links to reservation platforms:
  - **OpenTable** - Book a table easily
  - **Resy** - Reserve at top restaurants
- Automatic restaurant search on each platform

### 📱 Mobile-First Design
- Fully responsive layout optimized for mobile devices
- Sidebar + map layout on desktop
- Stacked layout on mobile for easy scrolling
- Touch-friendly buttons and interactions
- Clean, modern UI with professional styling

## 🚀 Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js + Express (Yelp proxy)
- **Mapping**: [Leaflet.js](https://leafletjs.com/) with OpenStreetMap tiles
- **API**: [Yelp Fusion API](https://www.yelp.com/developers) for restaurant data
- **Icons**: [Lucide Icons](https://lucide.dev/) (vanilla JS)
- **Styling**: Custom CSS with CSS Variables for theming
- **Geolocation**: Browser Geolocation API

## 📦 Project Structure

```
onthego/
├── index.html              # Main HTML page
├── api/
│   └── yelp-search.js       # Vercel serverless Yelp proxy
├── css/
│   └── styles.css          # All application styles
├── js/
│   ├── app.js              # Main application logic
│   ├── map.js              # Leaflet map initialization and management
│   ├── api.js              # API calls and data utilities
│   ├── ui.js               # UI rendering and interactions
│   └── config.js           # Configuration and sample data
├── server.js               # Express proxy for Yelp API
├── package.json            # Node.js dependencies and scripts
├── package-lock.json       # Dependency lockfile
├── assets/
│   └── icons/              # Custom icons (if any)
├── .env.example            # Environment variable template
├── .gitignore              # Git ignore file
└── README.md               # This file
```

## 🛠️ Setup Instructions

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- A web server (optional for local development)
- Node.js 18+ (for the Yelp proxy server)
- Yelp Fusion API key (optional - app works with sample data)

### 1. Clone the Repository
```bash
git clone https://github.com/abell35213/onthego.git
cd onthego
```

### 2. Get a Yelp API Key (Optional)

The app works with sample data out of the box, but for real restaurant data:

1. Go to [Yelp Fusion API](https://www.yelp.com/developers/v3/manage_app)
2. Create a Yelp account or log in
3. Create a new app to get your API key
4. Copy your API key

### 3. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and add your Yelp API key:
   ```
   YELP_API_KEY=your_actual_yelp_api_key_here
   ```
3. (Optional) Adjust the cache TTL in `.env` if you want a different caching window.

### 4. Run the Application

#### Option A: Node + Express (Recommended for Yelp data)
```bash
npm install
npm start
```

Then open `http://localhost:3000` in your browser.

#### Option B: Simple HTTP Server (Python)
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

Then open `http://localhost:8000` in your browser.

#### Option C: Node.js HTTP Server
```bash
npx http-server -p 8000
```

Then open `http://localhost:8000` in your browser.

#### Option D: VS Code Live Server
1. Install the "Live Server" extension in VS Code
2. Right-click `index.html` and select "Open with Live Server"

#### Option E: Open Directly
For basic testing, you can open `index.html` directly in your browser. Note: Some features may not work due to CORS restrictions.

### 5. Enable Location Services

When prompted by your browser, **allow location access** to see restaurants near you. If you deny access, the app will default to San Francisco, CA.

## 🎮 Usage Guide

### Finding Restaurants
1. **Open the app** - The map will center on your current location
2. **Browse the list** - Scroll through nearby restaurants in the sidebar
3. **Click a marker** - View restaurant details in a popup
4. **Click a card** - Pan the map to that restaurant's location

### Filtering & Searching
- **Search**: Type in the search bar to find restaurants by name or cuisine
- **Filter by cuisine**: Select a cuisine type from the dropdown
- **Filter by price**: Choose a price range
- **Sort**: Change the sort order (rating, distance, reviews)

### Taking Action
- **View on Yelp**: Read reviews and see more photos
- **Order delivery**: Click Uber Eats, DoorDash, or Grubhub
- **Make a reservation**: Use OpenTable or Resy
- **Check social media**: Visit Instagram, Facebook, or Twitter

### Mobile Usage
- **Swipe** to scroll through the restaurant list
- **Tap** a card to see it on the map
- **Tap** action buttons to visit external sites
- **Pinch/zoom** the map as needed

## 🔧 Configuration

### Customizing Default Location
Edit `js/config.js`:
```javascript
const CONFIG = {
    DEFAULT_LAT: 40.7128,  // New York City
    DEFAULT_LNG: -74.0060,
    DEFAULT_ZOOM: 13,
    // ...
};
```

### Adjusting Search Radius
Edit `js/config.js`:
```javascript
const CONFIG = {
    SEARCH_RADIUS: 3000,  // 3km instead of 5km
    SEARCH_LIMIT: 30,     // Show up to 30 restaurants
    // ...
};
```

### Using Custom Mock Data
Edit the `MOCK_RESTAURANTS` array in `js/config.js` to add your own sample restaurants.

## 🎨 Customization

### Color Scheme
The app uses CSS variables for easy theming. Edit `css/styles.css`:
```css
:root {
    --primary-color: #FF6B35;    /* Main brand color */
    --secondary-color: #004E89;  /* Secondary accent */
    --accent-color: #F77F00;     /* Highlight color */
    /* ... */
}
```

### Styling
All styles are in `css/styles.css`. The design is mobile-first with responsive breakpoints at:
- 768px (tablet)
- 1024px (desktop)
- 480px (small mobile)

## 🐛 Troubleshooting

### Location Not Working
- **Check browser permissions**: Ensure location access is allowed
- **Try HTTPS**: Geolocation requires HTTPS in production
- **Fallback**: The app will use San Francisco as default

### No Restaurants Showing
- **Check API key**: Verify your Yelp API key in `.env`
- **Check server**: Ensure the Node/Express proxy is running (`npm start`)
- **Mock data**: The app should show sample data if API fails
- **Console errors**: Check browser console for error messages

### CORS Issues with Yelp API
The Yelp API has CORS restrictions. For production use:
- Run the included Node/Express proxy (`npm start`)
- Use a CORS proxy service
- Or rely on the built-in mock data for demos

### Map Not Loading
- **Check internet**: Leaflet requires internet for tiles
- **CDN access**: Ensure CDN resources aren't blocked
- **Console errors**: Check for JavaScript errors

## 🚀 Deployment

### Static Hosting (Recommended)
Deploy to any static hosting service:

- **DigitalOcean App Platform**: Use the existing `.do` directory
- **Netlify**: Drag and drop the entire folder
- **Vercel**: Connect your GitHub repo
- **GitHub Pages**: Enable in repo settings
- **AWS S3**: Upload files to an S3 bucket

### Server Deployment
For Yelp API integration without CORS issues:
1. Deploy the included Node/Express proxy (`server.js`)
2. Set `YELP_API_KEY` and `PORT` in your production environment
3. Serve the static assets from the same server or a frontend host pointed at `/api/yelp-search`

## 🗺️ Future Improvements

- [ ] User authentication and saved favorites
- [ ] Custom restaurant lists and collections
- [ ] Directions integration (Google Maps, Apple Maps)
- [ ] Offline support with service workers
- [ ] More filter options (dietary restrictions, hours, etc.)
- [ ] Restaurant comparison feature
- [ ] Share restaurant recommendations
- [ ] Dark mode theme
- [ ] Multi-language support
- [ ] Integration with more delivery services
- [ ] Backend API for better Yelp integration
- [ ] Restaurant photos gallery
- [ ] User reviews and ratings
- [ ] Price range estimation based on menu data

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 👨‍💻 Author

**OnTheGo** - Built for traveling professionals who need quick access to great food nearby.

## 🙏 Acknowledgments

- [Leaflet.js](https://leafletjs.com/) for the amazing mapping library
- [OpenStreetMap](https://www.openstreetmap.org/) for map tiles
- [Yelp Fusion API](https://www.yelp.com/developers) for restaurant data
- [Lucide Icons](https://lucide.dev/) for clean, minimal icons
- [Unsplash](https://unsplash.com/) for sample restaurant images

---

**Happy Restaurant Hunting! 🍕🍣🍔🌮**
