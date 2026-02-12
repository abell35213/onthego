// Map Module - Handles Leaflet map initialization and markers
const MapModule = {
    map: null,
    markers: [],
    userMarker: null,
    userLocation: null,
    searchAreaBtn: null,

    /**
     * Initialize the map
     */
    init() {
        // Check if Leaflet is available
        if (typeof L === 'undefined') {
            console.warn('Leaflet library not loaded. Map functionality disabled.');
            return;
        }

        // Create map centered on default location
        this.map = L.map('map').setView(
            [CONFIG.DEFAULT_LAT, CONFIG.DEFAULT_LNG],
            CONFIG.DEFAULT_ZOOM
        );

        // Add Esri satellite tiles for Google Earth-style satellite view
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            maxZoom: 19
        }).addTo(this.map);

        // Add "Search This Area" button
        this.addSearchAreaButton();

        // Listen for map move to show search area button
        this.map.on('moveend', () => {
            if (this.searchAreaBtn) {
                this.searchAreaBtn.style.display = 'block';
            }
        });
    },

    /**
     * Add a "Search This Area" button overlay on the map
     */
    addSearchAreaButton() {
        if (!this.map) return;

        const SearchAreaControl = L.Control.extend({
            options: { position: 'topright' },
            onAdd: () => {
                const btn = L.DomUtil.create('button', 'search-area-btn');
                btn.innerHTML = '<i class="fas fa-search-location"></i> Search This Area';
                btn.style.display = 'none';
                btn.onclick = (e) => {
                    L.DomEvent.stopPropagation(e);
                    this.searchCurrentArea();
                    btn.style.display = 'none';
                };
                L.DomEvent.disableClickPropagation(btn);
                this.searchAreaBtn = btn;
                return btn;
            }
        });

        this.map.addControl(new SearchAreaControl());
    },

    /**
     * Search for restaurants in the current map view area
     */
    async searchCurrentArea() {
        const center = this.map.getCenter();
        const lat = center.lat;
        const lng = center.lng;

        console.log(`Searching area at: ${lat}, ${lng}`);

        try {
            const restaurants = await API.fetchRestaurants(lat, lng);
            console.log(`Found ${restaurants.length} restaurants in area`);
            UI.setRestaurants(restaurants);
        } catch (error) {
            console.error('Error searching area:', error);
        }
    },

        /**
     * Set the active search center (trip/hotel or GPS), update map, and load restaurants.
     * This is the primary way the app centers searches without forcing a GPS permission prompt.
     */
    setSearchCenter(lat, lng, label = 'Search Center') {
        const latitude = Number(lat);
        const longitude = Number(lng);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

        this.userLocation = { lat: latitude, lng: longitude };

        // Update map view if map exists
        if (this.map && typeof L !== 'undefined') {
            this.map.setView([latitude, longitude], CONFIG.DEFAULT_ZOOM);
        }

        // Remove existing search center marker
        if (this.userMarker && this.map) {
            try { this.map.removeLayer(this.userMarker); } catch (_) {}
        }

        // Add/update search center marker
        this.addUserMarker(latitude, longitude, label);

        // Load restaurants for this search center
        if (window.App && window.App.onLocationReady) {
            window.App.onLocationReady(latitude, longitude);
        }
    },

    /**
     * Request the user's live GPS location on-demand.
     * This should only be triggered by an explicit user action.
     */
    requestUserLocation() {
        this.    getUserLocation() {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.setSearchCenter(
                        position.coords.latitude,
                        position.coords.longitude,
                        'My Location'
                    );
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    this.handleGeolocationError(error);
                    // Do not override the current trip/hotel search center on error
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            console.log('Geolocation not supported');
            // If we don't have a search center yet, fall back to the default coords
            if (!this.userLocation && window.App && window.App.onLocationReady) {
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
    },

    /**
     * Add user location marker to map
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     */
    addUserMarker(lat, lng, label = "Search Center") {
        if (!this.map || typeof L === 'undefined') return;
        
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
            .bindPopup(`<strong>${label}</strong>`)
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
        if (!this.map || typeof L === 'undefined') return;
        
        this.clearMarkers();

        restaurants.forEach(restaurant => {
            const marker = this.createRestaurantMarker(restaurant);
            this.markers.push(marker);
        });

        // Fit map to show all markers if there are any
        if (this.markers.length > 0) {
            const layers = [...this.markers];
        if (this.userMarker) layers.push(this.userMarker);
        if (layers.length > 0) {
            const group = L.featureGroup(layers);
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
        }
    },

    /**
     * Create a marker for a restaurant
     * @param {Object} restaurant - Restaurant object
     * @returns {Object} - Leaflet marker object
     */
    createRestaurantMarker(restaurant) {
        if (!this.map || typeof L === 'undefined') return null;
        
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

        // Create popup content matching the restaurant list card format
        const popupContent = this.createPopupContent(restaurant);

        // Create and return marker
        const marker = L.marker([lat, lng], { icon: restaurantIcon })
            .addTo(this.map)
            .bindPopup(popupContent, { maxWidth: 350, minWidth: 280 });

        // Add click event to highlight corresponding card
        marker.on('click', () => {
            if (window.UI && window.UI.highlightRestaurantCard) {
                window.UI.highlightRestaurantCard(restaurant.id);
            }
        });

        return marker;
    },

    /**
     * Create popup content for a restaurant marker that mimics the restaurant list cards
     * @param {Object} restaurant - Restaurant object
     * @returns {string} - HTML string for popup
     */
    createPopupContent(restaurant) {
        const categories = restaurant.categories
            ? restaurant.categories.map(cat => cat.title).join(', ')
            : '';
        
        const stars = API.getStarRating(restaurant.rating);

        const location = restaurant.location;
        const address = location 
            ? `${location.address1}, ${location.city}, ${location.state} ${location.zip_code}`
            : '';

        const tagsHtml = restaurant.tags && restaurant.tags.length > 0 
            ? `<div class="popup-tags">${restaurant.tags.map(tag => {
                const tagClassMap = {
                    'Good for Business Meal': 'business',
                    'Chill': 'chill',
                    'Fun': 'fun',
                    'Local Spots': 'local',
                    'Nightlife': 'fun',
                    'Craft Beer': 'chill'
                };
                const tagClass = tagClassMap[tag] || tag.toLowerCase().replace(/\s+/g, '-');
                return `<span class="tag-badge ${tagClass}">${tag}</span>`;
            }).join('')}</div>`
            : '';

        const deliveryLinks = API.getDeliveryLinks(restaurant.name, address);
        const reservationLinks = API.getReservationLinks(
            restaurant.name, 
            location ? location.city : ''
        );
        const socialLinks = API.getSocialMediaLinks(restaurant.name);

        return `
            <div class="popup-content popup-content-full">
                <div class="popup-header">
                    <div>
                        <div class="popup-name">${restaurant.name}</div>
                        <div style="color: #666; font-size: 0.85rem;">${categories}</div>
                    </div>
                    ${restaurant.image_url ? `<img src="${restaurant.image_url}" alt="${restaurant.name}" class="popup-image">` : ''}
                </div>
                <div class="popup-rating">
                    <span class="stars">${stars}</span>
                    <span class="rating-number">${restaurant.rating}</span>
                    <span class="review-count">(${restaurant.review_count} reviews)</span>
                    ${restaurant.visited ? '<span class="visited-indicator" style="font-size:0.7rem;padding:0.2rem 0.4rem;margin-left:0.3rem;"><i class="fas fa-check"></i> Visited</span>' : ''}
                </div>
                <div class="popup-info">
                    <span><i class="fas fa-dollar-sign" style="color:var(--primary-color)"></i> ${restaurant.price || 'N/A'}</span>
                    <span><i class="fas fa-walking" style="color:var(--primary-color)"></i> ${API.formatDistance(restaurant.distance)}</span>
                    ${restaurant.display_phone ? `<span><i class="fas fa-phone" style="color:var(--primary-color)"></i> ${restaurant.display_phone}</span>` : ''}
                </div>
                ${tagsHtml}
                <div style="font-size: 0.8rem; color: #666; margin-bottom: 0.5rem;">
                    <i class="fas fa-map-marker-alt" style="color:var(--primary-color)"></i> ${address}
                </div>
                <div class="popup-actions">
                    <a href="${restaurant.url}" target="_blank" rel="noopener noreferrer" class="popup-btn" style="background-color:#D32323;">
                        <i class="fab fa-yelp"></i> Yelp
                    </a>
                    <a href="${deliveryLinks.ubereats}" target="_blank" rel="noopener noreferrer" class="popup-btn">
                        <i class="fas fa-hamburger"></i> Uber Eats
                    </a>
                    <a href="${deliveryLinks.doordash}" target="_blank" rel="noopener noreferrer" class="popup-btn">
                        <i class="fas fa-motorcycle"></i> DoorDash
                    </a>
                    <a href="${reservationLinks.opentable}" target="_blank" rel="noopener noreferrer" class="popup-btn">
                        <i class="fas fa-calendar-check"></i> OpenTable
                    </a>
                </div>
                <div class="popup-social-links">
                    <a href="${socialLinks.instagram}" target="_blank" rel="noopener noreferrer" class="social-link instagram" title="Instagram">
                        <i class="fab fa-instagram"></i>
                    </a>
                    <a href="${socialLinks.facebook}" target="_blank" rel="noopener noreferrer" class="social-link facebook" title="Facebook">
                        <i class="fab fa-facebook-f"></i>
                    </a>
                    <a href="${socialLinks.twitter}" target="_blank" rel="noopener noreferrer" class="social-link twitter" title="Twitter">
                        <i class="fab fa-twitter"></i>
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
        if (!this.map) return;
        
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
