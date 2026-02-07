// World Map Module - Handles the 3D globe view with travel history using CesiumJS
const WorldMap = {
    viewer: null,
    entities: [],
    restaurantEntities: [],
    currentView: CONFIG.VIEW_MODE_WORLD,
    infoBoxContainer: null,

    /**
     * Initialize the 3D globe world map using CesiumJS
     */
    init() {
        // Check if Cesium is available
        if (typeof Cesium === 'undefined') {
            console.warn('CesiumJS library not loaded. Falling back to 2D map.');
            this.initFallback2D();
            return;
        }

        // Use default Cesium Ion token for basic imagery
        Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0YjAwZTJlMC0xMzBiLTQ0NTUtOTAzYy1mZDFkZTcyMTFmMGMiLCJpZCI6MjU5LCJpYXQiOjE3MjczNzc5ODd9.sld5jLe3TOJdpxpVfxM_FJR31lCGjVDMwnFVHo24Wpw';

        try {
            this.viewer = new Cesium.Viewer('worldMap', {
                terrainProvider: Cesium.createWorldTerrain(),
                animation: false,
                baseLayerPicker: false,
                fullscreenButton: false,
                geocoder: false,
                homeButton: false,
                infoBox: false,
                sceneModePicker: false,
                selectionIndicator: false,
                timeline: false,
                navigationHelpButton: false,
                scene3DOnly: true,
                requestRenderMode: true,
                maximumRenderTimeChange: Infinity
            });

            // Remove Cesium credits display clutter
            this.viewer.cesiumWidget.creditContainer.style.display = 'none';

            // Set initial camera to show globe
            this.viewer.camera.setView({
                destination: Cesium.Cartesian3.fromDegrees(0, 20, 20000000),
                orientation: {
                    heading: 0,
                    pitch: Cesium.Math.toRadians(-90),
                    roll: 0
                }
            });

            // Create info box container for popups
            this.createInfoBoxContainer();

            // Add travel history markers
            this.addTravelHistoryMarkers();

            // Add upcoming trip markers
            this.addUpcomingTripMarkers();

            // Handle entity clicks
            const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
            handler.setInputAction((click) => {
                const pickedObject = this.viewer.scene.pick(click.position);
                if (Cesium.defined(pickedObject) && pickedObject.id) {
                    const entity = pickedObject.id;
                    if (entity.tripData) {
                        this.highlightTrip(entity.tripData.id, entity.tripData.isPast);
                    } else if (entity.restaurantPopupContent) {
                        this.showInfoBox(entity.restaurantPopupContent, click.position);
                    }
                } else {
                    this.hideInfoBox();
                }
            }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        } catch (e) {
            console.error('Error initializing CesiumJS:', e);
            this.initFallback2D();
        }
    },

    /**
     * Create a floating info box container for popups on the 3D globe
     */
    createInfoBoxContainer() {
        const worldMapEl = document.getElementById('worldMap');
        if (!worldMapEl) return;

        this.infoBoxContainer = document.createElement('div');
        this.infoBoxContainer.className = 'cesium-popup-container';
        this.infoBoxContainer.style.display = 'none';
        worldMapEl.appendChild(this.infoBoxContainer);
    },

    /**
     * Show info box popup near clicked entity
     */
    showInfoBox(content, position) {
        if (!this.infoBoxContainer) return;
        this.infoBoxContainer.innerHTML = '<div class="cesium-popup-content">' +
            '<button class="cesium-popup-close" onclick="WorldMap.hideInfoBox()">&times;</button>' +
            content +
            '</div>';
        this.infoBoxContainer.style.display = 'block';
        this.infoBoxContainer.style.left = Math.min(position.x, window.innerWidth - 360) + 'px';
        this.infoBoxContainer.style.top = Math.min(position.y, window.innerHeight - 300) + 'px';
    },

    /**
     * Hide info box popup
     */
    hideInfoBox() {
        if (this.infoBoxContainer) {
            this.infoBoxContainer.style.display = 'none';
        }
    },

    /**
     * Fallback to 2D Leaflet map if CesiumJS fails to load
     */
    initFallback2D() {
        if (typeof L === 'undefined') {
            console.warn('Leaflet library also not loaded. World map disabled.');
            return;
        }

        this._leafletMap = L.map('worldMap').setView([20, 0], CONFIG.WORLD_MAP_ZOOM);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri',
            minZoom: CONFIG.WORLD_MAP_MIN_ZOOM,
            maxZoom: CONFIG.WORLD_MAP_MAX_ZOOM
        }).addTo(this._leafletMap);
    },

    /**
     * Add markers for travel history on the 3D globe
     */
    addTravelHistoryMarkers() {
        MOCK_TRAVEL_HISTORY.forEach(trip => {
            this.createTripEntity(trip, true);
        });
    },

    /**
     * Add markers for upcoming trips on the 3D globe
     */
    addUpcomingTripMarkers() {
        MOCK_UPCOMING_TRIPS.forEach(trip => {
            this.createTripEntity(trip, false);
        });
    },

    /**
     * Create a 3D globe entity for a trip
     */
    createTripEntity(trip, isPast) {
        if (!this.viewer) return;

        const entity = this.viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(
                trip.coordinates.longitude,
                trip.coordinates.latitude
            ),
            point: {
                pixelSize: 16,
                color: isPast
                    ? Cesium.Color.fromCssColorString('#FF6B35')
                    : Cesium.Color.fromCssColorString('#004E89'),
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 3,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            },
            label: {
                text: trip.city,
                font: '14px sans-serif',
                fillColor: Cesium.Color.WHITE,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                outlineColor: Cesium.Color.BLACK,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -20),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8000000)
            },
            tripData: { ...trip, isPast }
        });

        this.entities.push(entity);
        this.viewer.scene.requestRender();
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
     * Highlight a trip on the globe and show restaurant pins near the hotel
     * @param {string} tripId - Trip ID
     * @param {boolean} isPast - Whether this is a past trip
     */
    highlightTrip(tripId, isPast) {
        const trips = isPast ? MOCK_TRAVEL_HISTORY : MOCK_UPCOMING_TRIPS;
        const trip = trips.find(t => t.id === tripId);
        
        if (trip && this.viewer) {
            this.hideInfoBox();

            // Fly to the trip location
            this.viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(
                    trip.coordinates.longitude,
                    trip.coordinates.latitude,
                    50000
                ),
                orientation: {
                    heading: 0,
                    pitch: Cesium.Math.toRadians(-45),
                    roll: 0
                },
                duration: 2
            });

            // Show nearby restaurants around the hotel
            setTimeout(() => {
                this.showNearbyRestaurants(trip);
            }, 2200);
        }

        // Highlight corresponding card in sidebar
        const listId = isPast ? 'tripHistory' : 'upcomingTrips';
        const cards = document.querySelectorAll('#' + listId + ' .trip-card');
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
     * Show nearby restaurant pins on the 3D globe around a trip's hotel
     * @param {Object} trip - Trip data with coordinates
     */
    showNearbyRestaurants(trip) {
        if (!this.viewer) return;

        // Clear existing restaurant entities
        this.clearRestaurantMarkers();

        // Add hotel entity
        var hotelPopup = '<div class="popup-content popup-content-full">' +
            '<div class="popup-name"><i class="fas fa-hotel"></i> ' + trip.hotel + '</div>' +
            '<div style="color: #666; font-size: 0.9rem; margin-bottom: 0.5rem;">' + trip.city + ', ' + trip.state + '</div>' +
            '<div class="popup-info">' +
                '<span><i class="fas fa-star" style="color:#F77F00"></i> 4.5 (Google)</span>' +
                '<span><i class="fas fa-phone" style="color:var(--primary-color)"></i> (800) 555-0199</span>' +
            '</div>' +
            '<div class="popup-actions">' +
                '<a href="https://www.google.com/maps/search/' + encodeURIComponent(trip.hotel + ' ' + trip.city) + '" target="_blank" rel="noopener noreferrer" class="popup-btn">' +
                    '<i class="fas fa-map"></i> Google Maps' +
                '</a>' +
            '</div>' +
            '</div>';

        var hotelEntity = this.viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(
                trip.coordinates.longitude,
                trip.coordinates.latitude
            ),
            billboard: {
                image: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                width: 25,
                height: 41,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            },
            label: {
                text: trip.hotel,
                font: '12px sans-serif',
                fillColor: Cesium.Color.WHITE,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                outlineColor: Cesium.Color.BLACK,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -45),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            },
            restaurantPopupContent: hotelPopup
        });
        this.restaurantEntities.push(hotelEntity);

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
            var color = Cesium.Color.fromCssColorString(markerColors[restaurant.type] || '#e74c3c');

            var stars = API.getStarRating(restaurant.rating);
            var typeIcons = {
                'restaurant': 'fa-utensils',
                'bar': 'fa-cocktail',
                'brewery': 'fa-beer',
                'club': 'fa-music'
            };
            var typeIcon = typeIcons[restaurant.type] || 'fa-utensils';
            var typeLabel = restaurant.type ? restaurant.type.charAt(0).toUpperCase() + restaurant.type.slice(1) : 'Restaurant';

            var distanceMeters = API.calculateDistance(
                trip.coordinates.latitude, trip.coordinates.longitude,
                restaurant.lat, restaurant.lng
            );

            var popupContent = '<div class="popup-content popup-content-full">' +
                '<div class="popup-header"><div>' +
                    '<div class="popup-name">' + restaurant.name + '</div>' +
                    '<div style="color: #666; font-size: 0.85rem;"><i class="fas ' + typeIcon + '"></i> ' + typeLabel + ' &middot; ' + restaurant.cuisine + '</div>' +
                '</div></div>' +
                '<div class="popup-rating">' +
                    '<span class="stars">' + stars + '</span>' +
                    '<span class="rating-number">' + restaurant.rating + '</span>' +
                '</div>' +
                '<div class="popup-info">' +
                    '<span><i class="fas fa-dollar-sign" style="color:var(--primary-color)"></i> ' + restaurant.price + '</span>' +
                    '<span><i class="fas fa-walking" style="color:var(--primary-color)"></i> ' + API.formatDistance(distanceMeters) + '</span>' +
                '</div>' +
                '<div class="popup-actions">' +
                    '<a href="https://www.google.com/maps/search/' + encodeURIComponent(restaurant.name + ' ' + trip.city) + '" target="_blank" rel="noopener noreferrer" class="popup-btn">' +
                        '<i class="fas fa-map"></i> Google Maps' +
                    '</a>' +
                    '<a href="https://www.yelp.com/search?find_desc=' + encodeURIComponent(restaurant.name) + '&find_loc=' + encodeURIComponent(trip.city) + '" target="_blank" rel="noopener noreferrer" class="popup-btn" style="background-color:#D32323;">' +
                        '<i class="fab fa-yelp"></i> Yelp' +
                    '</a>' +
                '</div>' +
                '</div>';

            var entity = self.viewer.entities.add({
                position: Cesium.Cartesian3.fromDegrees(restaurant.lng, restaurant.lat),
                point: {
                    pixelSize: 12,
                    color: color,
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
                },
                label: {
                    text: restaurant.name,
                    font: '11px sans-serif',
                    fillColor: Cesium.Color.WHITE,
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    outlineWidth: 2,
                    outlineColor: Cesium.Color.BLACK,
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    pixelOffset: new Cesium.Cartesian2(0, -16),
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 80000)
                },
                restaurantPopupContent: popupContent
            });

            self.restaurantEntities.push(entity);
        });

        this.viewer.scene.requestRender();
    },

    /**
     * Clear all restaurant entities from the globe
     */
    clearRestaurantMarkers() {
        if (!this.viewer) return;
        this.restaurantEntities.forEach(function(entity) {
            this.viewer.entities.remove(entity);
        }.bind(this));
        this.restaurantEntities = [];
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
     * Zoom to a specific trip location on the globe
     * @param {Object} coordinates - {latitude, longitude}
     */
    zoomToLocation(coordinates) {
        if (this.viewer) {
            this.viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(
                    coordinates.longitude,
                    coordinates.latitude,
                    500000
                ),
                duration: 2
            });
        }
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
        var restaurantCount = isPast ? trip.restaurantsVisited.length : 0;

        card.innerHTML = '<div class="trip-city">' + trip.city + ', ' + trip.state + '</div>' +
            '<div class="trip-dates"><i class="fas fa-calendar"></i> ' + dateRange + '</div>' +
            '<div class="trip-hotel"><i class="fas fa-hotel"></i> ' + trip.hotel + '</div>' +
            (restaurantCount > 0 ? '<div class="trip-restaurants"><i class="fas fa-utensils"></i> ' + restaurantCount + ' restaurant' + (restaurantCount > 1 ? 's' : '') + ' visited</div>' : '') +
            '<span class="trip-purpose">' + trip.purpose + '</span>';

        var self = this;
        card.addEventListener('click', function() {
            self.highlightTrip(trip.id, isPast);
        });

        return card;
    }
};
