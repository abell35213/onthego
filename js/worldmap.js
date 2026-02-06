// World Map Module - Handles the world map view with travel history
const WorldMap = {
    map: null,
    markers: [],
    restaurantMarkers: [],
    currentView: CONFIG.VIEW_MODE_WORLD,

    /**
     * Initialize the world map
     */
    init() {
        // Check if Leaflet is available
        if (typeof L === 'undefined') {
            console.warn('Leaflet library not loaded. World map functionality disabled.');
            return;
        }

        // Create world map centered on earth view (zoomed out globe)
        this.map = L.map('worldMap').setView([20, 0], CONFIG.WORLD_MAP_ZOOM);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            minZoom: CONFIG.WORLD_MAP_MIN_ZOOM,
            maxZoom: CONFIG.WORLD_MAP_MAX_ZOOM
        }).addTo(this.map);

        // Add travel history markers
        this.addTravelHistoryMarkers();
        
        // Add upcoming trip markers
        this.addUpcomingTripMarkers();
    },

    /**
     * Add markers for travel history
     */
    addTravelHistoryMarkers() {
        if (!this.map) return;

        MOCK_TRAVEL_HISTORY.forEach(trip => {
            const marker = this.createTripMarker(trip, true);
            this.markers.push(marker);
        });
    },

    /**
     * Add markers for upcoming trips
     */
    addUpcomingTripMarkers() {
        if (!this.map) return;

        MOCK_UPCOMING_TRIPS.forEach(trip => {
            const marker = this.createTripMarker(trip, false);
            this.markers.push(marker);
        });
    },

    /**
     * Create a trip marker
     * @param {Object} trip - Trip data
     * @param {boolean} isPast - Whether this is a past trip
     */
    createTripMarker(trip, isPast) {
        const lat = trip.coordinates.latitude;
        const lng = trip.coordinates.longitude;

        // Create custom circle marker
        const circleMarker = L.circleMarker([lat, lng], {
            radius: 15,
            fillColor: isPast ? '#FF6B35' : '#004E89',
            color: 'white',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(this.map);

        // Create popup content
        const popupContent = this.createTripPopup(trip, isPast);
        circleMarker.bindPopup(popupContent);

        // Add click event
        circleMarker.on('click', () => {
            this.highlightTrip(trip.id, isPast);
        });

        return circleMarker;
    },

    /**
     * Create popup content for a trip marker
     * @param {Object} trip - Trip data
     * @param {boolean} isPast - Whether this is a past trip
     */
    createTripPopup(trip, isPast) {
        const dateRange = `${this.formatDate(trip.startDate)} - ${this.formatDate(trip.endDate)}`;
        const restaurantCount = isPast ? trip.restaurantsVisited.length : 0;
        
        return `
            <div class="trip-popup">
                <h3>${trip.city}, ${trip.state}</h3>
                <p><strong>${trip.purpose}</strong></p>
                <p><i class="fas fa-calendar"></i> ${dateRange}</p>
                <p><i class="fas fa-hotel"></i> ${trip.hotel}</p>
                ${restaurantCount > 0 ? `<p><i class="fas fa-utensils"></i> ${restaurantCount} restaurants visited</p>` : ''}
                ${!isPast ? '<p class="upcoming-label"><i class="fas fa-clock"></i> Upcoming Trip</p>' : ''}
                <div class="popup-actions" style="margin-top: 0.75rem;">
                    <button onclick="WorldMap.highlightTrip('${trip.id}', ${isPast})" class="popup-btn">
                        <i class="fas fa-map-pin"></i> View Nearby Places
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Format date for display
     * @param {string} dateStr - ISO date string
     */
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },

    /**
     * Highlight a trip on the map and show restaurant pins near the hotel
     * @param {string} tripId - Trip ID
     * @param {boolean} isPast - Whether this is a past trip
     */
    highlightTrip(tripId, isPast) {
        const trips = isPast ? MOCK_TRAVEL_HISTORY : MOCK_UPCOMING_TRIPS;
        const trip = trips.find(t => t.id === tripId);
        
        if (trip && this.map) {
            this.map.setView([trip.coordinates.latitude, trip.coordinates.longitude], 13, {
                animate: true,
                duration: 1
            });

            // Show restaurant pins near the hotel
            this.showNearbyRestaurants(trip);
        }

        // Highlight corresponding card in sidebar
        const listId = isPast ? 'tripHistory' : 'upcomingTrips';
        const cards = document.querySelectorAll(`#${listId} .trip-card`);
        cards.forEach(card => {
            if (card.dataset.tripId === tripId) {
                card.classList.add('active');
                card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                card.classList.remove('active');
            }
        });
    },

    /**
     * Show nearby restaurant pins on the map around a trip's hotel
     * @param {Object} trip - Trip data with coordinates
     */
    showNearbyRestaurants(trip) {
        // Clear existing restaurant markers
        this.clearRestaurantMarkers();

        // Add a hotel marker
        const hotelIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        const hotelMarker = L.marker(
            [trip.coordinates.latitude, trip.coordinates.longitude],
            { icon: hotelIcon }
        ).addTo(this.map)
         .bindPopup(`<div class="popup-content">
            <div class="popup-name"><i class="fas fa-hotel"></i> ${trip.hotel}</div>
            <div style="color: #666; font-size: 0.9rem;">${trip.city}, ${trip.state}</div>
         </div>`)
         .openPopup();

        this.restaurantMarkers.push(hotelMarker);

        // Generate nearby restaurant pins around the hotel
        const nearbyRestaurants = this.generateNearbyRestaurants(trip);
        nearbyRestaurants.forEach(restaurant => {
            const restaurantIcon = L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });

            const stars = API.getStarRating(restaurant.rating);
            const popupContent = `
                <div class="popup-content">
                    <div class="popup-name">${restaurant.name}</div>
                    <div class="popup-rating">
                        <span class="stars">${stars}</span>
                        <span class="rating-number">${restaurant.rating}</span>
                    </div>
                    <div style="color: #666; font-size: 0.9rem; margin-bottom: 0.5rem;">
                        ${restaurant.cuisine}
                    </div>
                    <div style="color: #666; font-size: 0.85rem;">
                        <i class="fas fa-dollar-sign"></i> ${restaurant.price}
                    </div>
                </div>
            `;

            const marker = L.marker(
                [restaurant.lat, restaurant.lng],
                { icon: restaurantIcon }
            ).addTo(this.map)
             .bindPopup(popupContent);

            this.restaurantMarkers.push(marker);
        });
    },

    /**
     * Clear all restaurant markers from the map
     */
    clearRestaurantMarkers() {
        this.restaurantMarkers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.restaurantMarkers = [];
    },

    /**
     * Generate simulated nearby restaurants for a trip location
     * @param {Object} trip - Trip data
     * @returns {Array} - Array of nearby restaurant objects
     */
    generateNearbyRestaurants(trip) {
        const baseLat = trip.coordinates.latitude;
        const baseLng = trip.coordinates.longitude;

        // Restaurant templates per city for variety
        const cityRestaurants = {
            'San Francisco': [
                { name: 'Golden Gate Grill', cuisine: 'American', rating: 4.3, price: '$$' },
                { name: 'Fisherman\'s Catch', cuisine: 'Seafood', rating: 4.5, price: '$$$' },
                { name: 'Chinatown Express', cuisine: 'Chinese', rating: 4.1, price: '$' },
                { name: 'Bay Brew Coffee', cuisine: 'Cafe', rating: 4.6, price: '$' },
                { name: 'Nob Hill Steakhouse', cuisine: 'Steakhouse', rating: 4.7, price: '$$$$' },
            ],
            'New York': [
                { name: 'Manhattan Bistro', cuisine: 'French', rating: 4.4, price: '$$$' },
                { name: 'Brooklyn Pizza Co.', cuisine: 'Italian, Pizza', rating: 4.2, price: '$' },
                { name: 'Empire Sushi', cuisine: 'Japanese', rating: 4.6, price: '$$$' },
                { name: 'Harlem Soul Food', cuisine: 'Southern', rating: 4.5, price: '$$' },
                { name: 'The Deli on 5th', cuisine: 'Deli', rating: 4.0, price: '$' },
            ],
            'Chicago': [
                { name: 'Deep Dish House', cuisine: 'Pizza', rating: 4.5, price: '$$' },
                { name: 'Windy City Steaks', cuisine: 'Steakhouse', rating: 4.7, price: '$$$$' },
                { name: 'Lake Shore Sushi', cuisine: 'Japanese', rating: 4.3, price: '$$$' },
                { name: 'Magnificent Mile Cafe', cuisine: 'Cafe', rating: 4.1, price: '$' },
                { name: 'South Side BBQ', cuisine: 'BBQ', rating: 4.4, price: '$$' },
            ],
            'Los Angeles': [
                { name: 'Sunset Tacos', cuisine: 'Mexican', rating: 4.3, price: '$' },
                { name: 'Hollywood Grill', cuisine: 'American', rating: 4.1, price: '$$' },
                { name: 'Venice Beach Bowls', cuisine: 'Health Food', rating: 4.5, price: '$$' },
                { name: 'Beverly Hills Bistro', cuisine: 'French', rating: 4.8, price: '$$$$' },
                { name: 'K-Town BBQ', cuisine: 'Korean', rating: 4.4, price: '$$' },
            ],
            'Miami': [
                { name: 'Ocean Drive Seafood', cuisine: 'Seafood', rating: 4.5, price: '$$$' },
                { name: 'Little Havana Cafe', cuisine: 'Cuban', rating: 4.6, price: '$$' },
                { name: 'South Beach Sushi', cuisine: 'Japanese', rating: 4.2, price: '$$$' },
                { name: 'Brickell Steakhouse', cuisine: 'Steakhouse', rating: 4.7, price: '$$$$' },
                { name: 'Wynwood Tacos', cuisine: 'Mexican', rating: 4.3, price: '$' },
            ],
            'Seattle': [
                { name: 'Pike Place Chowder', cuisine: 'Seafood', rating: 4.6, price: '$$' },
                { name: 'Capitol Hill Coffee', cuisine: 'Cafe', rating: 4.4, price: '$' },
                { name: 'Emerald City Sushi', cuisine: 'Japanese', rating: 4.3, price: '$$$' },
                { name: 'Ballard Brewery & Grill', cuisine: 'American', rating: 4.2, price: '$$' },
                { name: 'Pioneer Square Pasta', cuisine: 'Italian', rating: 4.5, price: '$$' },
            ],
            'Austin': [
                { name: 'Congress Ave BBQ', cuisine: 'BBQ', rating: 4.7, price: '$$' },
                { name: 'South Lamar Tacos', cuisine: 'Tex-Mex', rating: 4.4, price: '$' },
                { name: '6th Street Grill', cuisine: 'American', rating: 4.1, price: '$$' },
                { name: 'East Side Thai', cuisine: 'Thai', rating: 4.3, price: '$$' },
                { name: 'Rainey Street Cafe', cuisine: 'Cafe', rating: 4.5, price: '$' },
            ],
            'Boston': [
                { name: 'Beacon Hill Bistro', cuisine: 'French', rating: 4.5, price: '$$$' },
                { name: 'North End Pasta', cuisine: 'Italian', rating: 4.6, price: '$$' },
                { name: 'Back Bay Oyster Bar', cuisine: 'Seafood', rating: 4.4, price: '$$$' },
                { name: 'Fenway Franks', cuisine: 'American', rating: 4.0, price: '$' },
                { name: 'Seaport Sushi', cuisine: 'Japanese', rating: 4.3, price: '$$$' },
            ]
        };

        const restaurants = cityRestaurants[trip.city] || [
            { name: 'Local Grill', cuisine: 'American', rating: 4.2, price: '$$' },
            { name: 'City Bistro', cuisine: 'French', rating: 4.4, price: '$$$' },
            { name: 'Corner Cafe', cuisine: 'Cafe', rating: 4.0, price: '$' },
            { name: 'Main Street Sushi', cuisine: 'Japanese', rating: 4.3, price: '$$' },
            { name: 'Downtown Steakhouse', cuisine: 'Steakhouse', rating: 4.6, price: '$$$$' },
        ];

        // Spread restaurants around the hotel coordinates
        const offsets = [
            { lat: 0.005, lng: 0.003 },
            { lat: -0.003, lng: 0.006 },
            { lat: 0.004, lng: -0.005 },
            { lat: -0.006, lng: -0.002 },
            { lat: 0.002, lng: -0.007 },
        ];

        return restaurants.map((r, i) => ({
            ...r,
            lat: baseLat + offsets[i].lat,
            lng: baseLng + offsets[i].lng
        }));
    },

    /**
     * Zoom to a specific trip location
     * @param {Object} coordinates - {latitude, longitude}
     */
    zoomToLocation(coordinates) {
        if (this.map) {
            this.map.setView([coordinates.latitude, coordinates.longitude], 8, {
                animate: true,
                duration: 1
            });
        }
    },

    /**
     * Render trip history sidebar
     */
    renderTripHistory() {
        const tripHistoryContainer = document.getElementById('tripHistory');
        if (!tripHistoryContainer) return;

        tripHistoryContainer.innerHTML = '';

        if (MOCK_TRAVEL_HISTORY.length === 0) {
            tripHistoryContainer.innerHTML = '<p style="color: var(--text-light);">No travel history yet. Connect your accounts to import trips.</p>';
            return;
        }

        MOCK_TRAVEL_HISTORY.forEach(trip => {
            const card = this.createTripCard(trip, true);
            tripHistoryContainer.appendChild(card);
        });
    },

    /**
     * Render upcoming trips sidebar
     */
    renderUpcomingTrips() {
        const upcomingTripsContainer = document.getElementById('upcomingTrips');
        if (!upcomingTripsContainer) return;

        upcomingTripsContainer.innerHTML = '';

        if (MOCK_UPCOMING_TRIPS.length === 0) {
            upcomingTripsContainer.innerHTML = '<p style="color: var(--text-light);">No upcoming trips scheduled.</p>';
            return;
        }

        MOCK_UPCOMING_TRIPS.forEach(trip => {
            const card = this.createTripCard(trip, false);
            upcomingTripsContainer.appendChild(card);
        });
    },

    /**
     * Create a trip card for the sidebar
     * @param {Object} trip - Trip data
     * @param {boolean} isPast - Whether this is a past trip
     */
    createTripCard(trip, isPast) {
        const card = document.createElement('div');
        card.className = 'trip-card';
        card.dataset.tripId = trip.id;

        const dateRange = `${this.formatDate(trip.startDate)} - ${this.formatDate(trip.endDate)}`;
        const restaurantCount = isPast ? trip.restaurantsVisited.length : 0;

        card.innerHTML = `
            <div class="trip-city">${trip.city}, ${trip.state}</div>
            <div class="trip-dates">
                <i class="fas fa-calendar"></i>
                ${dateRange}
            </div>
            <div class="trip-hotel">
                <i class="fas fa-hotel"></i>
                ${trip.hotel}
            </div>
            ${restaurantCount > 0 ? `
            <div class="trip-restaurants">
                <i class="fas fa-utensils"></i>
                ${restaurantCount} restaurant${restaurantCount > 1 ? 's' : ''} visited
            </div>
            ` : ''}
            <span class="trip-purpose">${trip.purpose}</span>
        `;

        // Add click event
        card.addEventListener('click', () => {
            this.highlightTrip(trip.id, isPast);
        });

        return card;
    }
};
