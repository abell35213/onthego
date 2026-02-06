// World Map Module - Handles the world map view with travel history
const WorldMap = {
    map: null,
    markers: [],
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

        // Create world map centered on world view
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
     * Highlight a trip on the map
     * @param {string} tripId - Trip ID
     * @param {boolean} isPast - Whether this is a past trip
     */
    highlightTrip(tripId, isPast) {
        const trips = isPast ? MOCK_TRAVEL_HISTORY : MOCK_UPCOMING_TRIPS;
        const trip = trips.find(t => t.id === tripId);
        
        if (trip && this.map) {
            this.map.setView([trip.coordinates.latitude, trip.coordinates.longitude], 8, {
                animate: true,
                duration: 1
            });
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
