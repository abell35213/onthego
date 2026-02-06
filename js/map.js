// Map Module - Handles Leaflet map initialization and markers
const MapModule = {
    map: null,
    markers: [],
    userMarker: null,
    userLocation: null,

    /**
     * Initialize the map
     */
    init() {
        // Create map centered on default location
        this.map = L.map('map').setView(
            [CONFIG.DEFAULT_LAT, CONFIG.DEFAULT_LNG],
            CONFIG.DEFAULT_ZOOM
        );

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(this.map);

        // Try to get user's location
        this.getUserLocation();
    },

    /**
     * Get user's current location using Geolocation API
     */
    getUserLocation() {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    
                    // Center map on user location
                    this.map.setView([this.userLocation.lat, this.userLocation.lng], CONFIG.DEFAULT_ZOOM);
                    
                    // Add user location marker
                    this.addUserMarker(this.userLocation.lat, this.userLocation.lng);
                    
                    // Notify app that location is ready
                    if (window.App && window.App.onLocationReady) {
                        window.App.onLocationReady(this.userLocation.lat, this.userLocation.lng);
                    }
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    this.handleGeolocationError(error);
                    
                    // Use default location
                    this.userLocation = {
                        lat: CONFIG.DEFAULT_LAT,
                        lng: CONFIG.DEFAULT_LNG
                    };
                    
                    // Notify app with default location
                    if (window.App && window.App.onLocationReady) {
                        window.App.onLocationReady(CONFIG.DEFAULT_LAT, CONFIG.DEFAULT_LNG);
                    }
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            console.log('Geolocation not supported');
            this.userLocation = {
                lat: CONFIG.DEFAULT_LAT,
                lng: CONFIG.DEFAULT_LNG
            };
            
            // Notify app with default location
            if (window.App && window.App.onLocationReady) {
                window.App.onLocationReady(CONFIG.DEFAULT_LAT, CONFIG.DEFAULT_LNG);
            }
        }
    },

    /**
     * Handle geolocation errors
     * @param {Object} error - Geolocation error object
     */
    handleGeolocationError(error) {
        let message = 'Unable to get your location. ';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message += 'Location permission denied. Using default location (San Francisco).';
                break;
            case error.POSITION_UNAVAILABLE:
                message += 'Location information unavailable. Using default location.';
                break;
            case error.TIMEOUT:
                message += 'Location request timed out. Using default location.';
                break;
            default:
                message += 'Using default location.';
        }
        
        console.log(message);
        
        // Could show a user-friendly notification here
        // For now, just log to console
    },

    /**
     * Add user location marker to map
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     */
    addUserMarker(lat, lng) {
        // Create custom icon for user location
        const userIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        this.userMarker = L.marker([lat, lng], { icon: userIcon })
            .addTo(this.map)
            .bindPopup('<strong>Your Location</strong>')
            .openPopup();
    },

    /**
     * Clear all restaurant markers
     */
    clearMarkers() {
        this.markers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.markers = [];
    },

    /**
     * Add restaurant markers to map
     * @param {Array} restaurants - Array of restaurant objects
     */
    addRestaurantMarkers(restaurants) {
        this.clearMarkers();

        restaurants.forEach(restaurant => {
            const marker = this.createRestaurantMarker(restaurant);
            this.markers.push(marker);
        });

        // Fit map to show all markers if there are any
        if (this.markers.length > 0) {
            const group = L.featureGroup([...this.markers, this.userMarker]);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    },

    /**
     * Create a marker for a restaurant
     * @param {Object} restaurant - Restaurant object
     * @returns {Object} - Leaflet marker object
     */
    createRestaurantMarker(restaurant) {
        const lat = restaurant.coordinates.latitude;
        const lng = restaurant.coordinates.longitude;

        // Create custom icon for restaurant
        const restaurantIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        // Create popup content
        const popupContent = this.createPopupContent(restaurant);

        // Create and return marker
        const marker = L.marker([lat, lng], { icon: restaurantIcon })
            .addTo(this.map)
            .bindPopup(popupContent);

        // Add click event to highlight corresponding card
        marker.on('click', () => {
            if (window.UI && window.UI.highlightRestaurantCard) {
                window.UI.highlightRestaurantCard(restaurant.id);
            }
        });

        return marker;
    },

    /**
     * Create popup content for a restaurant marker
     * @param {Object} restaurant - Restaurant object
     * @returns {string} - HTML string for popup
     */
    createPopupContent(restaurant) {
        const categories = restaurant.categories
            ? restaurant.categories.map(cat => cat.title).join(', ')
            : '';
        
        const stars = API.getStarRating(restaurant.rating);
        
        return `
            <div class="popup-content">
                <div class="popup-name">${restaurant.name}</div>
                <div class="popup-rating">
                    <span class="stars">${stars}</span>
                    <span class="rating-number">${restaurant.rating}</span>
                    <span class="review-count">(${restaurant.review_count} reviews)</span>
                </div>
                <div style="color: #666; font-size: 0.9rem; margin-bottom: 0.5rem;">
                    ${categories}
                </div>
                <div class="popup-actions">
                    <a href="${restaurant.url}" target="_blank" rel="noopener noreferrer" class="popup-btn">
                        View on Yelp
                    </a>
                </div>
            </div>
        `;
    },

    /**
     * Pan map to a specific restaurant
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     */
    panToRestaurant(lat, lng) {
        this.map.setView([lat, lng], 16, {
            animate: true,
            duration: 0.5
        });
    },

    /**
     * Open popup for a specific marker
     * @param {string} restaurantId - Restaurant ID
     * @param {Array} restaurants - Array of restaurant objects
     */
    openMarkerPopup(restaurantId, restaurants) {
        const restaurant = restaurants.find(r => r.id === restaurantId);
        if (!restaurant) return;

        const markerIndex = restaurants.indexOf(restaurant);
        if (markerIndex >= 0 && markerIndex < this.markers.length) {
            const marker = this.markers[markerIndex];
            marker.openPopup();
            this.panToRestaurant(
                restaurant.coordinates.latitude,
                restaurant.coordinates.longitude
            );
        }
    }
};
