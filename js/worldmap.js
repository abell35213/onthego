// World Map Module - Handles the 2D world map view with travel history.
// Uses Apple MapKit JS (satellite) when credentials are configured;
// falls back to Leaflet + ESRI tiles when MapKit is unavailable.
const WorldMap = {
    _leafletMap: null,
    _mapkitMap: null,
    _mapkitEnabled: false,
    _tripMarkers: [],
    _tripOverlays: [],
    _restaurantMarkers: [],
    currentView: CONFIG.VIEW_MODE_WORLD,

    /**
     * Initialize the world map. Tries Apple MapKit JS first, then Leaflet.
     */
    async init() {
        if (typeof mapkit !== 'undefined') {
            const success = await this._initMapKit();
            if (success) {
                this._addMapContent();
                return;
            }
        }

        if (typeof L === 'undefined') {
            console.warn('Neither MapKit JS nor Leaflet could be loaded. World map disabled.');
            return;
        }

        this._initLeaflet();
        this._addMapContent();
    },

    /**
     * Build MapKit constructor options from CONFIG.WORLD_MAPKIT_OPTIONS.
     * Allows section-by-section tuning without changing map initialization logic.
     * @returns {Object} mapkit.Map constructor options
     */
    _buildMapKitOptions() {
        const options = CONFIG.WORLD_MAPKIT_OPTIONS || {};

        const center = options.center || { latitude: 38, longitude: -96 };
        const span = options.span || { latitudeDelta: 50, longitudeDelta: 80 };
        const padding = options.padding || { top: 0, right: 0, bottom: 0, left: 0 };

        const mapTypeMap = {
            hybrid: mapkit.Map.MapTypes.Hybrid,
            mutedstandard: mapkit.Map.MapTypes.MutedStandard,
            satellite: mapkit.Map.MapTypes.Satellite,
            standard: mapkit.Map.MapTypes.Standard
        };

        const colorSchemeMap = {
            dark: mapkit.ColorSchemes.Dark,
            light: mapkit.ColorSchemes.Light
        };

        const featureVisibilityMap = {
            adaptive: mapkit.FeatureVisibility.Adaptive,
            hidden: mapkit.FeatureVisibility.Hidden,
            visible: mapkit.FeatureVisibility.Visible
        };

        const mapType = mapTypeMap[String(options.mapType || 'satellite').toLowerCase()] || mapkit.Map.MapTypes.Satellite;
        const colorScheme = colorSchemeMap[String(options.colorScheme || 'dark').toLowerCase()] || mapkit.ColorSchemes.Dark;
        const showsCompass = featureVisibilityMap[String(options.showsCompass || 'visible').toLowerCase()] || mapkit.FeatureVisibility.Visible;
        const showsScale = featureVisibilityMap[String(options.showsScale || 'hidden').toLowerCase()] || mapkit.FeatureVisibility.Hidden;

        return {
            mapType,
            colorScheme,
            region: new mapkit.CoordinateRegion(
                new mapkit.Coordinate(center.latitude, center.longitude),
                new mapkit.CoordinateSpan(span.latitudeDelta, span.longitudeDelta)
            ),
            rotation: options.rotation ?? 0,
            tintColor: options.tintColor || '#FFFFFF',
            padding: new mapkit.Padding(
                padding.top ?? 0,
                padding.right ?? 0,
                padding.bottom ?? 0,
                padding.left ?? 0
            ),
            showsMapTypeControl: options.showsMapTypeControl ?? true,
            showsZoomControl: options.showsZoomControl ?? true,
            showsCompass,
            isRotationEnabled: options.isRotationEnabled ?? true,
            isZoomEnabled: options.isZoomEnabled ?? true,
            isScrollEnabled: options.isScrollEnabled ?? true,
            showsScale
        };
    },

    /**
     * Initialize Apple MapKit JS for the world map (satellite imagery).
     * @returns {Promise<boolean>} true if initialization succeeded
     */
    async _initMapKit() {
        try {
            const ready = await initMapKit();
            if (!ready) return false;

            const container = document.getElementById('worldMap');
            if (!container) throw new Error('World map container #worldMap not found');

            const mapOptions = this._buildMapKitOptions();
            this._mapkitMap = new mapkit.Map(container, mapOptions);

            // Polyfill invalidateSize for callers in app.js
            this._mapkitMap.invalidateSize = () => {};

            // Single 'select' handler for all trip annotations
            this._mapkitMap.addEventListener('select', (event) => {
                const a = event.annotation;
                if (a && a._tripId) {
                    if (window.App && typeof App.openTripFromWorldMap === 'function') {
                        App.openTripFromWorldMap(a._tripId, a._isPast);
                        return;
                    }
                    this.highlightTrip(a._tripId, a._isPast);
                }
            });

            this._mapkitEnabled = true;
            console.log('World map: Apple MapKit JS initialized with satellite view');
            return true;
        } catch (error) {
            console.warn('World map MapKit init failed, falling back to Leaflet:', error.message);
            return false;
        }
    },

    /**
     * Initialize the Leaflet fallback world map (existing implementation).
     */
    _initLeaflet() {
        this._leafletMap = L.map('worldMap', {
            minZoom: CONFIG.WORLD_MAP_MIN_ZOOM,
            maxZoom: CONFIG.WORLD_MAP_MAX_ZOOM
        }).setView([38, -96], CONFIG.WORLD_MAP_ZOOM);

        // Satellite imagery base layer
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            minZoom: CONFIG.WORLD_MAP_MIN_ZOOM,
            maxZoom: CONFIG.WORLD_MAP_MAX_ZOOM
        }).addTo(this._leafletMap);

        // City/country labels overlay on top of satellite
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
            minZoom: CONFIG.WORLD_MAP_MIN_ZOOM,
            maxZoom: CONFIG.WORLD_MAP_MAX_ZOOM,
            opacity: 0.9
        }).addTo(this._leafletMap);

        this._mapkitEnabled = false;
        console.log('World map: Leaflet initialized with ESRI satellite tiles');
    },

    /**
     * Add all map content (flight paths, markers) after the map is ready.
     */
    _addMapContent() {
        this.addFlightPaths();
        this.addHomeMarker();
        this.addTravelHistoryMarkers();
        this.addUpcomingTripMarkers();
    },

    /**
     * Get the home/hub city for flight paths.
     * Returns user-saved city from settings if available, otherwise CONFIG.HOME_CITY.
     * @returns {{name: string, state: string, coordinates: {latitude: number, longitude: number}}}
     */
    getHomeCity() {
        try {
            const saved = localStorage.getItem('onthego_settings');
            if (saved) {
                const settings = JSON.parse(saved);
                if (settings.homeCity && settings.homeCityCoords) {
                    // Split on the first comma only; treat remainder as state/region (may be empty)
                    const commaIdx = settings.homeCity.indexOf(',');
                    const name = commaIdx >= 0
                        ? settings.homeCity.slice(0, commaIdx).trim()
                        : settings.homeCity.trim();
                    const state = commaIdx >= 0
                        ? settings.homeCity.slice(commaIdx + 1).trim()
                        : '';
                    return { name, state, coordinates: settings.homeCityCoords };
                }
            }
        } catch (e) {
            console.error('Error reading home city setting:', e);
        }
        return CONFIG.HOME_CITY;
    },

    /**
     * Clear all flight paths and trip markers then redraw with the current home city.
     * Called when the user updates their home city in Settings.
     */
    refresh() {
        if (this._mapkitEnabled && this._mapkitMap) {
            // Remove MapKit annotations and overlays
            if (this._tripMarkers.length) this._mapkitMap.removeAnnotations(this._tripMarkers);
            if (this._tripOverlays.length) this._mapkitMap.removeOverlays(this._tripOverlays);
        } else if (this._leafletMap) {
            this._tripMarkers.forEach(layer => this._leafletMap.removeLayer(layer));
        }
        this._tripMarkers = [];
        this._tripOverlays = [];

        this._addMapContent();
    },

    /**
     * Draw flight path polylines from the home city hub to every trip destination
     */
    addFlightPaths() {
        const home = this.getHomeCity().coordinates;
        const allTrips = [...MOCK_TRAVEL_HISTORY, ...MOCK_UPCOMING_TRIPS];

        if (this._mapkitEnabled && this._mapkitMap) {
            allTrips.forEach(trip => {
                const dest = trip.coordinates;
                const style = new mapkit.Style({
                    lineWidth: 1.5,
                    strokeColor: 'rgba(255, 255, 255, 0.75)',
                    strokeOpacity: 0.75
                });
                const overlay = new mapkit.PolylineOverlay([
                    new mapkit.Coordinate(home.latitude, home.longitude),
                    new mapkit.Coordinate(dest.latitude, dest.longitude)
                ], { style: style });
                this._mapkitMap.addOverlay(overlay);
                this._tripOverlays.push(overlay);
            });
            return;
        }

        if (!this._leafletMap) return;

        allTrips.forEach(trip => {
            const dest = trip.coordinates;
            const line = L.polyline(
                [
                    [home.latitude, home.longitude],
                    [dest.latitude, dest.longitude]
                ],
                {
                    color: 'rgba(255, 255, 255, 0.75)',
                    weight: 1.5,
                    opacity: 0.75,
                    dashArray: null
                }
            ).addTo(this._leafletMap);
            this._tripMarkers.push(line);
        });
    },

    /**
     * Add a pulsing home-city hub marker at the configured home coordinates
     */
    addHomeMarker() {
        const homeCity = this.getHomeCity();
        const { latitude, longitude } = homeCity.coordinates;

        if (this._mapkitEnabled && this._mapkitMap) {
            const annotation = new mapkit.MarkerAnnotation(
                new mapkit.Coordinate(latitude, longitude),
                {
                    color: '#64B4FF',
                    glyphText: '🏠',
                    title: `${homeCity.name}, ${homeCity.state}`,
                    subtitle: 'Home Base',
                    calloutEnabled: true
                }
            );
            this._mapkitMap.addAnnotation(annotation);
            this._tripMarkers.push(annotation);
            return;
        }

        if (!this._leafletMap) return;

        const homeIcon = L.divIcon({
            className: 'home-marker-icon',
            html: `<div style="
                background-color:rgba(173,216,255,0.95);
                width:18px;height:18px;border-radius:50%;
                border:3px solid rgba(255,255,255,1);
                box-shadow:0 0 12px rgba(100,180,255,1),0 0 4px rgba(0,0,0,0.6);
            "></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        });

        const marker = L.marker([latitude, longitude], { icon: homeIcon })
            .addTo(this._leafletMap)
            .bindPopup(`<strong>${homeCity.name}, ${homeCity.state}</strong><br>Home Base`, { maxWidth: 180 });
        this._tripMarkers.push(marker);
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
     * Create a marker for a trip (MapKit annotation or Leaflet marker)
     */
    createTripMarker(trip, isPast) {
        if (this._mapkitEnabled && this._mapkitMap) {
            const annotation = new mapkit.MarkerAnnotation(
                new mapkit.Coordinate(trip.coordinates.latitude, trip.coordinates.longitude),
                {
                    color: '#64B4FF',
                    glyphText: isPast ? '✓' : '✈',
                    title: `${trip.city}, ${trip.state}`,
                    subtitle: `${trip.hotel} — ${trip.purpose}`,
                    calloutEnabled: true
                }
            );
            annotation._tripId = trip.id;
            annotation._isPast = isPast;

            this._mapkitMap.addAnnotation(annotation);
            this._tripMarkers.push(annotation);
            return;
        }

        if (!this._leafletMap) return;

        var icon = L.divIcon({
            className: 'trip-marker-icon',
            html: '<div style="background-color:rgba(173,216,255,0.9);width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,0.95);box-shadow:0 0 8px rgba(100,180,255,0.8),0 2px 4px rgba(0,0,0,0.5);"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
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

        if (trip) {
            if (this._mapkitEnabled && this._mapkitMap) {
                this._mapkitMap.setRegionAnimated(
                    new mapkit.CoordinateRegion(
                        new mapkit.Coordinate(trip.coordinates.latitude, trip.coordinates.longitude),
                        new mapkit.CoordinateSpan(0.1, 0.1)
                    ),
                    true
                );
                setTimeout(() => {
                    this.showNearbyRestaurants(trip);
                }, 1600);
            } else if (this._leafletMap) {
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
        // Clear existing restaurant markers
        this.clearRestaurantMarkers();

        // Generate nearby restaurants for this trip
        var nearbyRestaurants = this.generateNearbyRestaurants(trip);

        if (this._mapkitEnabled && this._mapkitMap) {
            // Hotel annotation
            var hotelAnnotation = new mapkit.MarkerAnnotation(
                new mapkit.Coordinate(trip.coordinates.latitude, trip.coordinates.longitude),
                {
                    color: '#007aff',
                    glyphText: '🏨',
                    title: trip.hotel,
                    subtitle: trip.city + ', ' + trip.state,
                    calloutEnabled: true
                }
            );
            this._mapkitMap.addAnnotation(hotelAnnotation);
            this._restaurantMarkers.push(hotelAnnotation);

            // Restaurant annotations
            nearbyRestaurants.forEach((restaurant) => {
                var colorMap = {
                    'restaurant': '#e74c3c',
                    'bar': '#f39c12',
                    'brewery': '#f1c40f',
                    'club': '#9b59b6'
                };
                var color = colorMap[restaurant.type] || '#e74c3c';
                var glyphMap = {
                    'restaurant': '🍽',
                    'bar': '🍸',
                    'brewery': '🍺',
                    'club': '🎵'
                };
                var glyph = glyphMap[restaurant.type] || '🍽';

                var annotation = new mapkit.MarkerAnnotation(
                    new mapkit.Coordinate(restaurant.lat, restaurant.lng),
                    {
                        color: color,
                        glyphText: glyph,
                        title: restaurant.name,
                        subtitle: restaurant.cuisine + ' · ' + restaurant.price,
                        calloutEnabled: true
                    }
                );
                this._mapkitMap.addAnnotation(annotation);
                this._restaurantMarkers.push(annotation);
            });
            return;
        }

        if (!this._leafletMap) return;

        // Add hotel marker (Leaflet fallback)
        var hotelIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

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

        var hotelMarker = L.marker(
            [trip.coordinates.latitude, trip.coordinates.longitude],
            { icon: hotelIcon }
        ).addTo(this._leafletMap)
         .bindPopup(hotelPopup, { maxWidth: 350, minWidth: 280 });

        this._restaurantMarkers.push(hotelMarker);

        // Add nearby restaurant pins (Leaflet)
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

            // Get delivery, reservation, and social media links
            var deliveryLinks = API.getDeliveryLinks(restaurant.name, trip.city);
            var reservationLinks = API.getReservationLinks(restaurant.name, trip.city);
            var socialLinks = API.getSocialMediaLinks(restaurant.name, trip.city, trip.state);

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
                    '<a href="https://www.yelp.com/search?find_desc=' + encodeURIComponent(restaurant.name) + '&find_loc=' + encodeURIComponent(trip.city) + '" target="_blank" rel="noopener noreferrer" class="popup-btn" style="background-color:#D32323;">' +
                        '<i class="fab fa-yelp"></i> Yelp' +
                    '</a>' +
                    '<a href="' + deliveryLinks.ubereats + '" target="_blank" rel="noopener noreferrer" class="popup-btn">' +
                        '<i class="fas fa-hamburger"></i> Uber Eats' +
                    '</a>' +
                    '<a href="' + deliveryLinks.doordash + '" target="_blank" rel="noopener noreferrer" class="popup-btn">' +
                        '<i class="fas fa-motorcycle"></i> DoorDash' +
                    '</a>' +
                    '<a href="' + deliveryLinks.grubhub + '" target="_blank" rel="noopener noreferrer" class="popup-btn">' +
                        '<i class="fas fa-utensils"></i> Grubhub' +
                    '</a>' +
                    '<a href="' + reservationLinks.opentable + '" target="_blank" rel="noopener noreferrer" class="popup-btn">' +
                        '<i class="fas fa-calendar-check"></i> OpenTable' +
                    '</a>' +
                    '<a href="' + reservationLinks.resy + '" target="_blank" rel="noopener noreferrer" class="popup-btn">' +
                        '<i class="fas fa-bookmark"></i> Resy' +
                    '</a>' +
                    '<a href="https://www.google.com/maps/search/' + encodeURIComponent(restaurant.name + ' ' + trip.city) + '" target="_blank" rel="noopener noreferrer" class="popup-btn">' +
                        '<i class="fas fa-map"></i> Google Maps' +
                    '</a>' +
                '</div>' +
                '<div class="popup-social-links">' +
                    '<a href="' + socialLinks.instagram + '" target="_blank" rel="noopener noreferrer" class="social-link instagram" title="Instagram">' +
                        '<i class="fab fa-instagram"></i>' +
                    '</a>' +
                    '<a href="' + socialLinks.facebook + '" target="_blank" rel="noopener noreferrer" class="social-link facebook" title="Facebook">' +
                        '<i class="fab fa-facebook-f"></i>' +
                    '</a>' +
                    '<a href="' + socialLinks.twitter + '" target="_blank" rel="noopener noreferrer" class="social-link twitter" title="Twitter">' +
                        '<i class="fab fa-twitter"></i>' +
                    '</a>' +
                '</div>' +
                '</div>';

            var marker = L.marker(
                [restaurant.lat, restaurant.lng],
                { icon: restaurantIcon }
            ).addTo(self._leafletMap)
             .bindPopup(popupContent, { maxWidth: 350, minWidth: 280 });

            self._restaurantMarkers.push(marker);
        });
    },

    /**
     * Clear all restaurant markers from the map
     */
    clearRestaurantMarkers() {
        if (this._mapkitEnabled && this._mapkitMap) {
            if (this._restaurantMarkers.length) {
                this._mapkitMap.removeAnnotations(this._restaurantMarkers);
            }
        } else if (this._leafletMap) {
            this._restaurantMarkers.forEach(function(marker) {
                this._leafletMap.removeLayer(marker);
            }.bind(this));
        }
        this._restaurantMarkers = [];
    },

    /**
     * Zoom to a specific trip location on the map
     * @param {Object} coordinates - {latitude, longitude}
     */
    zoomToLocation(coordinates) {
        if (this._mapkitEnabled && this._mapkitMap) {
            this._mapkitMap.setRegionAnimated(
                new mapkit.CoordinateRegion(
                    new mapkit.Coordinate(coordinates.latitude, coordinates.longitude),
                    new mapkit.CoordinateSpan(0.5, 0.5)
                ),
                true
            );
        } else if (this._leafletMap) {
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
            '<div class="trip-dates"><i class="fas fa-calendar"></i> ' + dateRange + '</div>' +
            '<div class="trip-hotel"><i class="fas fa-hotel"></i> ' + trip.hotel + '</div>' +
            (restaurantCount > 0 ? '<div class="trip-restaurants"><i class="fas fa-utensils"></i> ' + restaurantCount + ' restaurant' + (restaurantCount > 1 ? 's' : '') + ' visited</div>' : '') +
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
