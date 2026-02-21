// World Map Module - Handles the 2D world map view with travel history using Leaflet
const WorldMap = {
    _leafletMap: null,
    _tripMarkers: [],
    _restaurantMarkers: [],
    currentView: CONFIG.VIEW_MODE_WORLD,

    /**
     * Initialize the world map using Leaflet 2D map
     */
    init() {
        if (typeof L === 'undefined') {
            console.warn('Leaflet library not loaded. World map disabled.');
            return;
        }

        this._leafletMap = L.map('worldMap').setView([30, -40], CONFIG.WORLD_MAP_ZOOM);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            minZoom: CONFIG.WORLD_MAP_MIN_ZOOM,
            maxZoom: CONFIG.WORLD_MAP_MAX_ZOOM
        }).addTo(this._leafletMap);

        // Add travel history markers
        this.addTravelHistoryMarkers();

        // Add upcoming trip markers
        this.addUpcomingTripMarkers();
    },

    /**
     * Add markers for travel history on the map
     */
    addTravelHistoryMarkers() {
        MOCK_TRAVEL_HISTORY.forEach(trip => {
            this.createTripMarker(trip, true);
        });
    },

    /**
     * Add markers for upcoming trips on the map
     */
    addUpcomingTripMarkers() {
        MOCK_UPCOMING_TRIPS.forEach(trip => {
            this.createTripMarker(trip, false);
        });
    },

    /**
     * Create a Leaflet marker for a trip
     */
    createTripMarker(trip, isPast) {
        if (!this._leafletMap) return;

        var color = isPast ? '#FF6B35' : '#004E89';
        var icon = L.divIcon({
            className: 'trip-marker-icon',
            html: '<div style="background-color:' + color + ';width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>' +
                  '<div style="color:white;font-size:12px;font-weight:bold;text-shadow:1px 1px 2px black,-1px -1px 2px black,1px -1px 2px black,-1px 1px 2px black;white-space:nowrap;margin-top:2px;text-align:center;transform:translateX(-30%);">' + trip.city + '</div>',
            iconSize: [22, 40],
            iconAnchor: [11, 8]
        });

        var marker = L.marker(
            [trip.coordinates.latitude, trip.coordinates.longitude],
            { icon: icon }
        ).addTo(this._leafletMap);

        var self = this;
        marker.on('click', function() {
            // Preferred behavior: jump straight to Restaurant List (Local view)
            if (window.App && typeof App.openTripFromWorldMap === 'function') {
                App.openTripFromWorldMap(trip.id, isPast);
                return;
            }
            // Fallback: keep existing world-map highlight behavior
            self.highlightTrip(trip.id, isPast);
        });

        this._tripMarkers.push(marker);
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

        if (trip && this._leafletMap) {
            // Fly to the trip location
            this._leafletMap.flyTo(
                [trip.coordinates.latitude, trip.coordinates.longitude],
                13,
                { duration: 1.5 }
            );

            // Show nearby restaurants around the hotel after fly animation
            var self = this;
            setTimeout(function() {
                self.showNearbyRestaurants(trip);
            }, 1600);
        }

        // Highlight corresponding card in sidebar
        var listId = isPast ? 'tripHistory' : 'upcomingTrips';
        var cards = document.querySelectorAll('#' + listId + ' .trip-card');
        cards.forEach(function(card) {
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
        if (!this._leafletMap) return;

        // Clear existing restaurant markers
        this.clearRestaurantMarkers();

        // Add hotel marker
        var hotelIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        var hotelPopup = '<div class="popup-content popup-content-full">' +
            '<div class="popup-name"><i data-lucide="building"></i> ' + trip.hotel + '</div>' +
            '<div style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 0.5rem;">' + trip.city + ', ' + trip.state + '</div>' +
            '<div class="popup-info">' +
                '<span><i data-lucide="star" class="star-icon star-filled"></i> 4.5 (Google)</span>' +
                '<span><i data-lucide="phone"></i> (800) 555-0199</span>' +
            '</div>' +
            '<div class="popup-actions">' +
                '<a href="https://www.google.com/maps/search/' + encodeURIComponent(trip.hotel + ' ' + trip.city) + '" target="_blank" rel="noopener noreferrer" class="popup-btn">' +
                    '<i data-lucide="map"></i> Google Maps' +
                '</a>' +
            '</div>' +
            '</div>';

        var hotelMarker = L.marker(
            [trip.coordinates.latitude, trip.coordinates.longitude],
            { icon: hotelIcon }
        ).addTo(this._leafletMap)
         .bindPopup(hotelPopup, { maxWidth: 350, minWidth: 280 });

        hotelMarker.on('popupopen', function() {
            if (window.lucide) lucide.createIcons();
        });

        this._restaurantMarkers.push(hotelMarker);

        // Generate and add nearby restaurant pins
        var nearbyRestaurants = this.generateNearbyRestaurants(trip);
        var self = this;
        nearbyRestaurants.forEach(function(restaurant) {
            var markerColors = {
                'restaurant': '#e74c3c',
                'bar': '#f39c12',
                'brewery': '#f1c40f',
                'club': '#9b59b6'
            };
            var color = markerColors[restaurant.type] || '#e74c3c';

            var restaurantIcon = L.divIcon({
                className: 'restaurant-pin-icon',
                html: '<div style="background-color:' + color + ';width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.4);"></div>',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });

            var stars = API.getStarRating(restaurant.rating);
            var typeIcons = {
                'restaurant': 'utensils',
                'bar': 'wine',
                'brewery': 'beer',
                'club': 'music'
            };
            var typeIcon = typeIcons[restaurant.type] || 'utensils';
            var typeLabel = restaurant.type ? restaurant.type.charAt(0).toUpperCase() + restaurant.type.slice(1) : 'Restaurant';

            var distanceMeters = API.calculateDistance(
                trip.coordinates.latitude, trip.coordinates.longitude,
                restaurant.lat, restaurant.lng
            );

            // Get delivery, reservation, and social media links
            var deliveryLinks = API.getDeliveryLinks(restaurant.name, trip.city);
            var reservationLinks = API.getReservationLinks(restaurant.name, trip.city);
            var socialLinks = API.getSocialMediaLinks(restaurant.name, trip.city, trip.state);

            var popupContent = '<div class="popup-content popup-content-full">' +
                '<div class="popup-header"><div>' +
                    '<div class="popup-name">' + restaurant.name + '</div>' +
                    '<div style="color: var(--text-muted); font-size: 0.85rem;"><i data-lucide="' + typeIcon + '"></i> ' + typeLabel + ' &middot; ' + restaurant.cuisine + '</div>' +
                '</div></div>' +
                '<div class="popup-rating">' +
                    '<span class="stars">' + stars + '</span>' +
                    '<span class="rating-number">' + restaurant.rating + '</span>' +
                '</div>' +
                '<div class="popup-info">' +
                    '<span><i data-lucide="dollar-sign"></i> ' + restaurant.price + '</span>' +
                    '<span><i data-lucide="footprints"></i> ' + API.formatDistance(distanceMeters) + '</span>' +
                '</div>' +
                '<div class="popup-actions">' +
                    '<a href="https://www.yelp.com/search?find_desc=' + encodeURIComponent(restaurant.name) + '&find_loc=' + encodeURIComponent(trip.city) + '" target="_blank" rel="noopener noreferrer" class="popup-btn">' +
                        '<i data-lucide="external-link"></i> Yelp' +
                    '</a>' +
                    '<a href="' + deliveryLinks.ubereats + '" target="_blank" rel="noopener noreferrer" class="popup-btn">' +
                        '<i data-lucide="truck"></i> Uber Eats' +
                    '</a>' +
                    '<a href="' + deliveryLinks.doordash + '" target="_blank" rel="noopener noreferrer" class="popup-btn">' +
                        '<i data-lucide="package"></i> DoorDash' +
                    '</a>' +
                    '<a href="' + deliveryLinks.grubhub + '" target="_blank" rel="noopener noreferrer" class="popup-btn">' +
                        '<i data-lucide="utensils"></i> Grubhub' +
                    '</a>' +
                    '<a href="' + reservationLinks.opentable + '" target="_blank" rel="noopener noreferrer" class="popup-btn">' +
                        '<i data-lucide="calendar-check"></i> OpenTable' +
                    '</a>' +
                    '<a href="' + reservationLinks.resy + '" target="_blank" rel="noopener noreferrer" class="popup-btn">' +
                        '<i data-lucide="bookmark"></i> Resy' +
                    '</a>' +
                    '<a href="https://www.google.com/maps/search/' + encodeURIComponent(restaurant.name + ' ' + trip.city) + '" target="_blank" rel="noopener noreferrer" class="popup-btn">' +
                        '<i data-lucide="map"></i> Google Maps' +
                    '</a>' +
                '</div>' +
                '<div class="popup-social-links">' +
                    '<a href="' + socialLinks.instagram + '" target="_blank" rel="noopener noreferrer" class="social-link instagram" title="Instagram">' +
                        '<i data-lucide="camera"></i>' +
                    '</a>' +
                    '<a href="' + socialLinks.facebook + '" target="_blank" rel="noopener noreferrer" class="social-link facebook" title="Facebook">' +
                        '<i data-lucide="share-2"></i>' +
                    '</a>' +
                    '<a href="' + socialLinks.twitter + '" target="_blank" rel="noopener noreferrer" class="social-link twitter" title="Twitter">' +
                        '<i data-lucide="message-circle"></i>' +
                    '</a>' +
                '</div>' +
                '</div>';

            var marker = L.marker(
                [restaurant.lat, restaurant.lng],
                { icon: restaurantIcon }
            ).addTo(self._leafletMap)
             .bindPopup(popupContent, { maxWidth: 350, minWidth: 280 });

            marker.on('popupopen', function() {
                if (window.lucide) lucide.createIcons();
            });

            self._restaurantMarkers.push(marker);
        });
    },

    /**
     * Clear all restaurant markers from the map
     */
    clearRestaurantMarkers() {
        if (!this._leafletMap) return;
        this._restaurantMarkers.forEach(function(marker) {
            this._leafletMap.removeLayer(marker);
        }.bind(this));
        this._restaurantMarkers = [];
    },

    /**
     * Zoom to a specific trip location on the map
     * @param {Object} coordinates - {latitude, longitude}
     */
    zoomToLocation(coordinates) {
        if (this._leafletMap) {
            this._leafletMap.flyTo(
                [coordinates.latitude, coordinates.longitude],
                10,
                { duration: 1.5 }
            );
        }
    },

    /**
     * Generate simulated nearby restaurants for a trip location
     * @param {Object} trip - Trip data
     * @returns {Array} - Array of nearby restaurant objects
     */
    generateNearbyRestaurants(trip) {
        var baseLat = trip.coordinates.latitude;
        var baseLng = trip.coordinates.longitude;

        var cityRestaurants = {
            'San Francisco': [
                { name: 'Golden Gate Grill', cuisine: 'American', rating: 4.3, price: '$$', type: 'restaurant' },
                { name: "Fisherman's Catch", cuisine: 'Seafood', rating: 4.5, price: '$$$', type: 'restaurant' },
                { name: 'Chinatown Express', cuisine: 'Chinese', rating: 4.1, price: '$', type: 'restaurant' },
                { name: 'Bay Brew Coffee', cuisine: 'Cafe', rating: 4.6, price: '$', type: 'restaurant' },
                { name: 'Nob Hill Steakhouse', cuisine: 'Steakhouse', rating: 4.7, price: '$$$$', type: 'restaurant' },
                { name: 'Anchor Brewing Taproom', cuisine: 'Brewery', rating: 4.4, price: '$$', type: 'brewery' },
                { name: 'The Bourbon Bar', cuisine: 'Bar', rating: 4.2, price: '$$$', type: 'bar' },
                { name: 'Temple Nightclub', cuisine: 'Club', rating: 4.0, price: '$$$', type: 'club' },
            ],
            'New York': [
                { name: 'Manhattan Bistro', cuisine: 'French', rating: 4.4, price: '$$$', type: 'restaurant' },
                { name: 'Brooklyn Pizza Co.', cuisine: 'Pizza', rating: 4.2, price: '$', type: 'restaurant' },
                { name: 'Empire Sushi', cuisine: 'Japanese', rating: 4.6, price: '$$$', type: 'restaurant' },
                { name: 'Harlem Soul Food', cuisine: 'Southern', rating: 4.5, price: '$$', type: 'restaurant' },
                { name: 'The Deli on 5th', cuisine: 'Deli', rating: 4.0, price: '$', type: 'restaurant' },
                { name: 'Brooklyn Brewery', cuisine: 'Brewery', rating: 4.5, price: '$$', type: 'brewery' },
                { name: 'Speakeasy Bar NYC', cuisine: 'Bar', rating: 4.3, price: '$$$', type: 'bar' },
                { name: 'Marquee NYC', cuisine: 'Club', rating: 4.1, price: '$$$$', type: 'club' },
            ],
            'Chicago': [
                { name: 'Deep Dish House', cuisine: 'Pizza', rating: 4.5, price: '$$', type: 'restaurant' },
                { name: 'Windy City Steaks', cuisine: 'Steakhouse', rating: 4.7, price: '$$$$', type: 'restaurant' },
                { name: 'Lake Shore Sushi', cuisine: 'Japanese', rating: 4.3, price: '$$$', type: 'restaurant' },
                { name: 'Magnificent Mile Cafe', cuisine: 'Cafe', rating: 4.1, price: '$', type: 'restaurant' },
                { name: 'South Side BBQ', cuisine: 'BBQ', rating: 4.4, price: '$$', type: 'restaurant' },
                { name: 'Revolution Brewing', cuisine: 'Brewery', rating: 4.5, price: '$$', type: 'brewery' },
                { name: 'The Violet Hour', cuisine: 'Bar', rating: 4.6, price: '$$$', type: 'bar' },
                { name: 'Sound-Bar Chicago', cuisine: 'Club', rating: 4.0, price: '$$$', type: 'club' },
            ],
            'Los Angeles': [
                { name: 'Sunset Tacos', cuisine: 'Mexican', rating: 4.3, price: '$', type: 'restaurant' },
                { name: 'Hollywood Grill', cuisine: 'American', rating: 4.1, price: '$$', type: 'restaurant' },
                { name: 'Venice Beach Bowls', cuisine: 'Health Food', rating: 4.5, price: '$$', type: 'restaurant' },
                { name: 'Beverly Hills Bistro', cuisine: 'French', rating: 4.8, price: '$$$$', type: 'restaurant' },
                { name: 'K-Town BBQ', cuisine: 'Korean', rating: 4.4, price: '$$', type: 'restaurant' },
                { name: 'Angel City Brewery', cuisine: 'Brewery', rating: 4.3, price: '$$', type: 'brewery' },
                { name: 'The Varnish', cuisine: 'Bar', rating: 4.5, price: '$$$', type: 'bar' },
                { name: 'Avalon Hollywood', cuisine: 'Club', rating: 4.2, price: '$$$', type: 'club' },
            ],
            'Miami': [
                { name: 'Ocean Drive Seafood', cuisine: 'Seafood', rating: 4.5, price: '$$$', type: 'restaurant' },
                { name: 'Little Havana Cafe', cuisine: 'Cuban', rating: 4.6, price: '$$', type: 'restaurant' },
                { name: 'South Beach Sushi', cuisine: 'Japanese', rating: 4.2, price: '$$$', type: 'restaurant' },
                { name: 'Brickell Steakhouse', cuisine: 'Steakhouse', rating: 4.7, price: '$$$$', type: 'restaurant' },
                { name: 'Wynwood Tacos', cuisine: 'Mexican', rating: 4.3, price: '$', type: 'restaurant' },
                { name: 'Wynwood Brewing Co.', cuisine: 'Brewery', rating: 4.4, price: '$$', type: 'brewery' },
                { name: 'Broken Shaker', cuisine: 'Bar', rating: 4.5, price: '$$$', type: 'bar' },
                { name: 'LIV Miami', cuisine: 'Club', rating: 4.3, price: '$$$$', type: 'club' },
            ],
            'Seattle': [
                { name: 'Pike Place Chowder', cuisine: 'Seafood', rating: 4.6, price: '$$', type: 'restaurant' },
                { name: 'Capitol Hill Coffee', cuisine: 'Cafe', rating: 4.4, price: '$', type: 'restaurant' },
                { name: 'Emerald City Sushi', cuisine: 'Japanese', rating: 4.3, price: '$$$', type: 'restaurant' },
                { name: 'Ballard Brewery & Grill', cuisine: 'American', rating: 4.2, price: '$$', type: 'restaurant' },
                { name: 'Pioneer Square Pasta', cuisine: 'Italian', rating: 4.5, price: '$$', type: 'restaurant' },
                { name: 'Fremont Brewing', cuisine: 'Brewery', rating: 4.6, price: '$$', type: 'brewery' },
                { name: 'Canon Whiskey Bar', cuisine: 'Bar', rating: 4.7, price: '$$$', type: 'bar' },
                { name: 'Q Nightclub', cuisine: 'Club', rating: 4.1, price: '$$$', type: 'club' },
            ],
            'Austin': [
                { name: 'Congress Ave BBQ', cuisine: 'BBQ', rating: 4.7, price: '$$', type: 'restaurant' },
                { name: 'South Lamar Tacos', cuisine: 'Tex-Mex', rating: 4.4, price: '$', type: 'restaurant' },
                { name: '6th Street Grill', cuisine: 'American', rating: 4.1, price: '$$', type: 'restaurant' },
                { name: 'East Side Thai', cuisine: 'Thai', rating: 4.3, price: '$$', type: 'restaurant' },
                { name: 'Rainey Street Cafe', cuisine: 'Cafe', rating: 4.5, price: '$', type: 'restaurant' },
                { name: 'Jester King Brewery', cuisine: 'Brewery', rating: 4.7, price: '$$', type: 'brewery' },
                { name: 'Midnight Cowboy', cuisine: 'Bar', rating: 4.5, price: '$$$', type: 'bar' },
                { name: 'Summit Rooftop', cuisine: 'Club', rating: 4.2, price: '$$$', type: 'club' },
            ],
            'Boston': [
                { name: 'Beacon Hill Bistro', cuisine: 'French', rating: 4.5, price: '$$$', type: 'restaurant' },
                { name: 'North End Pasta', cuisine: 'Italian', rating: 4.6, price: '$$', type: 'restaurant' },
                { name: 'Back Bay Oyster Bar', cuisine: 'Seafood', rating: 4.4, price: '$$$', type: 'restaurant' },
                { name: 'Fenway Franks', cuisine: 'American', rating: 4.0, price: '$', type: 'restaurant' },
                { name: 'Seaport Sushi', cuisine: 'Japanese', rating: 4.3, price: '$$$', type: 'restaurant' },
                { name: 'Trillium Brewing', cuisine: 'Brewery', rating: 4.7, price: '$$', type: 'brewery' },
                { name: 'Drink Bar Boston', cuisine: 'Bar', rating: 4.5, price: '$$$', type: 'bar' },
                { name: 'Royale Boston', cuisine: 'Club', rating: 4.1, price: '$$$', type: 'club' },
            ]
        };

        var restaurants = cityRestaurants[trip.city] || [
            { name: 'Local Grill', cuisine: 'American', rating: 4.2, price: '$$', type: 'restaurant' },
            { name: 'City Bistro', cuisine: 'French', rating: 4.4, price: '$$$', type: 'restaurant' },
            { name: 'Corner Cafe', cuisine: 'Cafe', rating: 4.0, price: '$', type: 'restaurant' },
            { name: 'Main Street Sushi', cuisine: 'Japanese', rating: 4.3, price: '$$', type: 'restaurant' },
            { name: 'Downtown Steakhouse', cuisine: 'Steakhouse', rating: 4.6, price: '$$$$', type: 'restaurant' },
            { name: 'Local Craft Brewery', cuisine: 'Brewery', rating: 4.3, price: '$$', type: 'brewery' },
            { name: 'The Neighborhood Bar', cuisine: 'Bar', rating: 4.1, price: '$$', type: 'bar' },
            { name: 'Downtown Club', cuisine: 'Club', rating: 3.9, price: '$$$', type: 'club' },
        ];

        var offsets = [
            { lat: 0.005, lng: 0.003 },
            { lat: -0.003, lng: 0.006 },
            { lat: 0.004, lng: -0.005 },
            { lat: -0.006, lng: -0.002 },
            { lat: 0.002, lng: -0.007 },
            { lat: 0.006, lng: 0.005 },
            { lat: -0.004, lng: -0.006 },
            { lat: -0.002, lng: 0.008 },
        ];

        return restaurants.map(function(r, i) {
            return Object.assign({}, r, {
                lat: baseLat + offsets[i % offsets.length].lat,
                lng: baseLng + offsets[i % offsets.length].lng
            });
        });
    },

    /**
     * Render trip history sidebar
     */
    renderTripHistory() {
        var tripHistoryContainer = document.getElementById('tripHistory');
        if (!tripHistoryContainer) return;

        tripHistoryContainer.innerHTML = '';

        if (MOCK_TRAVEL_HISTORY.length === 0) {
            tripHistoryContainer.innerHTML = '<p style="color: var(--text-light);">No travel history yet. Connect your accounts to import trips.</p>';
            return;
        }

        var self = this;
        MOCK_TRAVEL_HISTORY.forEach(function(trip) {
            var card = self.createTripCard(trip, true);
            tripHistoryContainer.appendChild(card);
        });

        // Refresh Lucide icons
        if (window.lucide) lucide.createIcons();
    },

    /**
     * Render upcoming trips sidebar
     */
    renderUpcomingTrips() {
        var upcomingTripsContainer = document.getElementById('upcomingTrips');
        if (!upcomingTripsContainer) return;

        upcomingTripsContainer.innerHTML = '';

        if (MOCK_UPCOMING_TRIPS.length === 0) {
            upcomingTripsContainer.innerHTML = '<p style="color: var(--text-light);">No upcoming trips scheduled.</p>';
            return;
        }

        var self = this;
        MOCK_UPCOMING_TRIPS.forEach(function(trip) {
            var card = self.createTripCard(trip, false);
            upcomingTripsContainer.appendChild(card);
        });

        // Refresh Lucide icons
        if (window.lucide) lucide.createIcons();
    },

    /**
     * Create a trip card for the sidebar
     * @param {Object} trip - Trip data
     * @param {boolean} isPast - Whether this is a past trip
     */
    createTripCard(trip, isPast) {
        var card = document.createElement('div');
        card.className = 'trip-card';
        card.dataset.tripId = trip.id;

        var dateRange = this.formatDate(trip.startDate) + ' - ' + this.formatDate(trip.endDate);
        var restaurantCount = isPast && trip.restaurantsVisited ? trip.restaurantsVisited.length : 0;

        // Flighty-inspired countdown badge for upcoming trips
        var countdownHtml = '';
        if (!isPast && trip.startDate) {
            var today = new Date();
            today.setHours(0, 0, 0, 0);
            var start = new Date(trip.startDate);
            start.setHours(0, 0, 0, 0);
            var diffDays = Math.ceil((start - today) / (1000 * 60 * 60 * 24));
            if (diffDays === 0) {
                countdownHtml = '<span class="trip-countdown today">Today</span>';
            } else if (diffDays === 1) {
                countdownHtml = '<span class="trip-countdown soon">Tomorrow</span>';
            } else if (diffDays > 0 && diffDays <= 7) {
                countdownHtml = '<span class="trip-countdown soon">In ' + diffDays + ' days</span>';
            } else if (diffDays > 7) {
                countdownHtml = '<span class="trip-countdown">In ' + diffDays + ' days</span>';
            }
        }

        card.innerHTML = '<div class="trip-card-top">' +
                '<div class="trip-city">' + trip.city + ', ' + trip.state + '</div>' +
                countdownHtml +
            '</div>' +
            '<div class="trip-dates"><i data-lucide="calendar"></i> ' + dateRange + '</div>' +
            '<div class="trip-hotel"><i data-lucide="building"></i> ' + trip.hotel + '</div>' +
            (restaurantCount > 0 ? '<div class="trip-restaurants"><i data-lucide="utensils"></i> ' + restaurantCount + ' restaurant' + (restaurantCount > 1 ? 's' : '') + ' visited</div>' : '') +
            '<span class="trip-purpose">' + trip.purpose + '</span>';

        var self = this;
        card.addEventListener('click', function() {
            // Same behavior as map markers: open Local view for the selected trip
            if (window.App && typeof App.openTripFromWorldMap === 'function') {
                App.openTripFromWorldMap(trip.id, isPast);
                return;
            }
            self.highlightTrip(trip.id, isPast);
        });

        return card;
    }
};
