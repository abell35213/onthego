// Map Module - Handles map initialization and restaurant markers
// Uses Apple MapKit JS (satellite, primary) when credentials are configured;
// falls back to Leaflet + ESRI tiles when MapKit is unavailable.
const MapModule = {
    map: null,
    markers: [],
    userMarker: null,
    userLocation: null,
    searchAreaBtn: null,
    _mapkitEnabled: false,
    _programmaticMove: false,

    // Bounds-fitting constants used by _fitMapKitBounds()
    _BOUNDS_PADDING_MULTIPLIER: 1.3,
    _MIN_COORDINATE_SPAN: 0.01,

    // ===== Initialization =====

    /**
     * Initialize the map. Tries Apple MapKit JS first, then falls back to Leaflet.
     */
    init() {
        if (typeof mapkit !== 'undefined') {
            // Start async MapKit initialization; fall back to Leaflet on failure
            this._initMapKit().then(success => {
                if (!success) {
                    if (typeof L !== 'undefined') {
                        this._initLeaflet();
                    } else {
                        console.warn('Neither MapKit JS nor Leaflet could be initialized.');
                    }
                }
            });
            return;
        }

        if (typeof L === 'undefined') {
            console.warn('Leaflet library not loaded. Map functionality disabled.');
            return;
        }

        this._initLeaflet();
    },

    /**
     * Initialize Apple MapKit JS map with satellite imagery.
     * Fetches a JWT token from the server, then creates a mapkit.Map.
     * @returns {Promise<boolean>} true if MapKit initialized successfully
     */
    async _initMapKit() {
        try {
            const response = await fetch(CONFIG.MAPKIT_TOKEN_URL);
            if (!response.ok) throw new Error(`Token endpoint returned ${response.status}`);
            const { token } = await response.json();
            if (!token) throw new Error('No token in server response');

            mapkit.init({
                authorizationCallback: (done) => done(token),
                language: 'en'
            });

            const mapContainer = document.getElementById('map');
            if (!mapContainer) throw new Error('Map container #map not found');

            this.map = new mapkit.Map(mapContainer, {
                mapType: mapkit.Map.MapTypes.Satellite,
                region: new mapkit.CoordinateRegion(
                    new mapkit.Coordinate(CONFIG.DEFAULT_LAT, CONFIG.DEFAULT_LNG),
                    new mapkit.CoordinateSpan(0.1, 0.1)
                ),
                showsMapTypeControl: true,
                showsZoomControl: true,
                showsCompass: mapkit.FeatureVisibility.Visible
            });

            // Polyfill for Leaflet-style calls in app.js (e.g. MapModule.map.invalidateSize())
            this.map.invalidateSize = () => {};

            this._mapkitEnabled = true;

            // Show "Search This Area" when user manually pans/zooms
            this.map.addEventListener('region-change-end', () => {
                if (this._programmaticMove) {
                    this._programmaticMove = false;
                    return;
                }
                if (this.searchAreaBtn) {
                    this.searchAreaBtn.style.display = 'block';
                }
            });

            // Highlight restaurant card when annotation is selected
            this.map.addEventListener('select', (event) => {
                const annotation = event.annotation;
                if (annotation && annotation._restaurantId && window.UI && window.UI.highlightRestaurantCard) {
                    window.UI.highlightRestaurantCard(annotation._restaurantId);
                }
            });

            this.addSearchAreaButton();
            this.addDirectionsControl();

            console.log('Apple MapKit JS initialized with satellite view');

            // If restaurants were loaded before MapKit was ready, render their markers now
            if (typeof UI !== 'undefined' && UI.restaurants && UI.restaurants.length > 0) {
                if (this.userLocation) {
                    this.addUserMarker(this.userLocation.lat, this.userLocation.lng, 'Search Center');
                }
                this.addRestaurantMarkers(UI.restaurants, { skipFitBounds: true });
            }

            return true;
        } catch (error) {
            console.warn('MapKit JS init failed, falling back to Leaflet:', error.message);
            return false;
        }
    },

    /**
     * Initialize the Leaflet fallback map (existing implementation).
     */
    _initLeaflet() {
        this.map = L.map('map').setView(
            [CONFIG.DEFAULT_LAT, CONFIG.DEFAULT_LNG],
            CONFIG.DEFAULT_ZOOM
        );

        this.tileLayers = {
            'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri',
                maxZoom: 19
            }),
            'Google Roads': L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                attribution: '&copy; Google Maps',
                maxZoom: 20
            }),
            'Google Hybrid': L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                attribution: '&copy; Google Maps',
                maxZoom: 20
            }),
            'Street Map': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors',
                maxZoom: 19
            })
        };

        this.tileLayers['Satellite'].addTo(this.map);
        L.control.layers(this.tileLayers, null, { position: 'topright', collapsed: true }).addTo(this.map);

        this._mapkitEnabled = false;
        this._programmaticMove = false;

        this.map.on('moveend', () => {
            if (this._programmaticMove) {
                this._programmaticMove = false;
                return;
            }
            if (this.searchAreaBtn) {
                this.searchAreaBtn.style.display = 'block';
            }
        });

        this.addSearchAreaButton();
        this.addDirectionsControl();
    },

    // ===== Shared Controls =====

    /**
     * Returns the DOM element that is the map's outer container.
     * @returns {HTMLElement}
     */
    _getMapContainer() {
        return document.getElementById('map');
    },

    /**
     * Add a "Search This Area" button overlay centered on the map container.
     * Only shown when the user manually pans or zooms.
     */
    addSearchAreaButton() {
        if (!this.map) return;

        const mapContainer = this._getMapContainer();
        if (!mapContainer) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'search-area-btn-wrapper';
        const btn = document.createElement('button');
        btn.className = 'search-area-btn';
        btn.innerHTML = '<i class="fas fa-search-location"></i> Search This Area';
        btn.style.display = 'none';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.searchCurrentArea();
            btn.style.display = 'none';
        });
        wrapper.appendChild(btn);
        mapContainer.appendChild(wrapper);

        // Prevent map interaction events from propagating through the button wrapper
        wrapper.addEventListener('click', (e) => e.stopPropagation());
        if (!this._mapkitEnabled && typeof L !== 'undefined') {
            L.DomEvent.disableClickPropagation(wrapper);
        }

        this.searchAreaBtn = btn;
    },

    /**
     * Add a directions dropdown control to the top-right of the map.
     */
    addDirectionsControl() {
        if (!this.map) return;

        const buildContainer = () => {
            const container = document.createElement('div');
            container.className = 'map-directions-control';
            container.innerHTML = `
                <button class="directions-toggle-btn" title="Get Directions">
                    <i class="fas fa-directions"></i>
                </button>
                <div class="directions-dropdown" style="display:none;">
                    <a class="directions-option" data-provider="google" href="#" title="Google Maps">
                        <i class="fas fa-map-marked-alt"></i> Google Maps
                    </a>
                    <a class="directions-option" data-provider="apple" href="#" title="Apple Maps">
                        <i class="fab fa-apple"></i> Apple Maps
                    </a>
                </div>
            `;

            const toggleBtn = container.querySelector('.directions-toggle-btn');
            const dropdown = container.querySelector('.directions-dropdown');

            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
            });

            container.querySelectorAll('.directions-option').forEach(opt => {
                opt.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const provider = opt.dataset.provider;
                    let lat, lng;
                    if (this._mapkitEnabled) {
                        const center = this.map.region.center;
                        lat = center.latitude;
                        lng = center.longitude;
                    } else {
                        const center = this.map.getCenter();
                        lat = center.lat;
                        lng = center.lng;
                    }
                    const url = provider === 'apple'
                        ? `https://maps.apple.com/?daddr=${lat},${lng}`
                        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                    dropdown.style.display = 'none';
                });
            });

            container.addEventListener('click', (e) => e.stopPropagation());
            return container;
        };

        if (this._mapkitEnabled) {
            // MapKit mode: append the control div directly to the map container
            const mapContainer = this._getMapContainer();
            if (mapContainer) {
                const container = buildContainer();
                container.classList.add('mapkit-overlay-control');
                mapContainer.appendChild(container);
            }
        } else {
            // Leaflet mode: use L.Control.extend for proper Leaflet integration
            const self = this;
            const DirectionsControl = L.Control.extend({
                options: { position: 'topright' },
                onAdd() {
                    const container = buildContainer();
                    L.DomEvent.disableClickPropagation(container);
                    return container;
                }
            });
            this.map.addControl(new DirectionsControl());
        }
    },

    /**
     * Search for restaurants in the current map view area.
     */
    async searchCurrentArea() {
        let lat, lng;
        if (this._mapkitEnabled) {
            const center = this.map.region.center;
            lat = center.latitude;
            lng = center.longitude;
        } else {
            const center = this.map.getCenter();
            lat = center.lat;
            lng = center.lng;
        }

        console.log(`Searching area at: ${lat}, ${lng}`);
        try {
            const restaurants = await API.fetchRestaurants(lat, lng);
            console.log(`Found ${restaurants.length} restaurants in area`);
            UI.setRestaurants(restaurants, { skipFitBounds: true });
        } catch (error) {
            console.error('Error searching area:', error);
        }
    },

    // ===== Location =====

    /**
     * Set the active search center, update the map view, and load restaurants.
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {string} [label] - Display label for the search center marker
     */
    setSearchCenter(lat, lng, label = 'Search Center') {
        const latitude = Number(lat);
        const longitude = Number(lng);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

        this.userLocation = { lat: latitude, lng: longitude };

        if (this.map) {
            this._programmaticMove = true;
            if (this._mapkitEnabled) {
                this.map.region = new mapkit.CoordinateRegion(
                    new mapkit.Coordinate(latitude, longitude),
                    new mapkit.CoordinateSpan(0.1, 0.1)
                );
            } else if (typeof L !== 'undefined') {
                this.map.setView([latitude, longitude], CONFIG.DEFAULT_ZOOM);
            }
        }

        // Remove existing user/search-center marker
        if (this.userMarker && this.map) {
            if (this._mapkitEnabled) {
                this.map.removeAnnotation(this.userMarker);
            } else {
                try { this.map.removeLayer(this.userMarker); } catch (_) {}
            }
        }

        this.addUserMarker(latitude, longitude, label);

        if (window.App && window.App.onLocationReady) {
            window.App.onLocationReady(latitude, longitude);
        }
    },

    /**
     * Request the user's live GPS location on-demand.
     * Should only be triggered by an explicit user action.
     */
    requestUserLocation() {
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
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            console.log('Geolocation not supported');
            if (!this.userLocation && window.App && window.App.onLocationReady) {
                window.App.onLocationReady(CONFIG.DEFAULT_LAT, CONFIG.DEFAULT_LNG);
            }
        }
    },

    /**
     * Handle geolocation errors with user-friendly messages.
     * @param {GeolocationPositionError} error
     */
    handleGeolocationError(error) {
        let message = 'Unable to get your location. ';
        switch (error.code) {
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

    // ===== Markers =====

    /**
     * Add user/search-center location marker.
     * @param {number} lat
     * @param {number} lng
     * @param {string} [label]
     */
    addUserMarker(lat, lng, label = 'Search Center') {
        if (!this.map) return;

        if (this._mapkitEnabled) {
            const annotation = new mapkit.MarkerAnnotation(
                new mapkit.Coordinate(lat, lng),
                {
                    color: '#007aff',
                    title: label,
                    calloutEnabled: true
                }
            );
            this.map.addAnnotation(annotation);
            this.userMarker = annotation;
        } else if (typeof L !== 'undefined') {
            const userIcon = L.divIcon({
                className: '',
                html: '<div class="ios-pin-marker user-location"><div class="ios-pin-circle"></div><div class="ios-pin-tail"></div></div>',
                iconSize: [30, 43],
                iconAnchor: [15, 43],
                popupAnchor: [0, -43]
            });
            this.userMarker = L.marker([lat, lng], { icon: userIcon })
                .addTo(this.map)
                .bindPopup(`<strong>${label}</strong>`)
                .openPopup();
        }
    },

    /**
     * Remove all restaurant markers from the map.
     */
    clearMarkers() {
        if (this._mapkitEnabled && this.map) {
            this.map.removeAnnotations(this.markers);
        } else if (this.map) {
            this.markers.forEach(marker => this.map.removeLayer(marker));
        }
        this.markers = [];
    },

    /**
     * Add restaurant markers/annotations to the map.
     * @param {Array} restaurants
     * @param {Object} [options]
     * @param {boolean} [options.skipFitBounds=false]
     */
    addRestaurantMarkers(restaurants, options = {}) {
        if (!this.map) return;

        this.clearMarkers();

        if (this._mapkitEnabled) {
            const annotations = restaurants
                .map(r => this._createMapKitAnnotation(r))
                .filter(Boolean);
            this.markers = annotations;
            this.map.addAnnotations(annotations);

            if (!options.skipFitBounds && annotations.length > 0) {
                this._fitMapKitBounds(annotations);
            }
        } else {
            if (typeof L === 'undefined') return;

            restaurants.forEach(restaurant => {
                const marker = this.createRestaurantMarker(restaurant);
                if (marker) this.markers.push(marker);
            });

            if (!options.skipFitBounds && this.markers.length > 0) {
                const layers = [...this.markers];
                if (this.userMarker) layers.push(this.userMarker);
                if (layers.length > 0) {
                    this._programmaticMove = true;
                    const group = L.featureGroup(layers);
                    this.map.fitBounds(group.getBounds().pad(0.1));
                }
            }
        }
    },

    /**
     * Pan the map to a restaurant's coordinates.
     * @param {number} lat
     * @param {number} lng
     */
    panToRestaurant(lat, lng) {
        if (!this.map) return;

        this._programmaticMove = true;
        if (this._mapkitEnabled) {
            this.map.region = new mapkit.CoordinateRegion(
                new mapkit.Coordinate(lat, lng),
                new mapkit.CoordinateSpan(0.02, 0.02)
            );
        } else {
            this.map.setView([lat, lng], 16, { animate: true, duration: 0.5 });
        }
    },

    /**
     * Open the popup/callout for a specific restaurant.
     * @param {string} restaurantId
     * @param {Array} restaurants
     */
    openMarkerPopup(restaurantId, restaurants) {
        const restaurant = restaurants.find(r => r.id === restaurantId);
        if (!restaurant) return;

        if (this._mapkitEnabled) {
            const annotation = this.markers.find(m => m._restaurantId === restaurantId);
            if (annotation) {
                this.map.selectedAnnotation = annotation;
                this.panToRestaurant(
                    restaurant.coordinates.latitude,
                    restaurant.coordinates.longitude
                );
            }
        } else {
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
    },

    // ===== MapKit-specific helpers =====

    /**
     * Create a MapKit annotation for a restaurant with a rich callout.
     * @param {Object} restaurant
     * @returns {mapkit.MarkerAnnotation}
     */
    _createMapKitAnnotation(restaurant) {
        const lat = restaurant.coordinates?.latitude;
        const lng = restaurant.coordinates?.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        const categories = restaurant.categories?.map(c => c.title).join(', ') || '';

        const annotation = new mapkit.MarkerAnnotation(
            new mapkit.Coordinate(lat, lng),
            {
                color: '#ff3b30',
                title: restaurant.name,
                subtitle: categories,
                calloutEnabled: true
            }
        );

        // Store restaurant ID so the 'select' event handler can look it up
        annotation._restaurantId = restaurant.id;

        // Custom callout with full popup content
        const popupHTML = this.createPopupContent(restaurant);
        annotation.calloutDelegate = {
            calloutContentForAnnotation: () => {
                const el = document.createElement('div');
                el.className = 'mapkit-callout-content';
                el.innerHTML = popupHTML;
                return el;
            }
        };

        return annotation;
    },

    /**
     * Fit the MapKit map region to show all given annotations plus the user marker.
     * @param {mapkit.MarkerAnnotation[]} annotations
     */
    _fitMapKitBounds(annotations) {
        const coords = annotations.map(a => a.coordinate);
        if (this.userMarker && this.userMarker.coordinate) {
            coords.push(this.userMarker.coordinate);
        }
        if (coords.length === 0) return;

        const lats = coords.map(c => c.latitude);
        const lngs = coords.map(c => c.longitude);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;
        const latSpan = Math.max((maxLat - minLat) * this._BOUNDS_PADDING_MULTIPLIER, this._MIN_COORDINATE_SPAN);
        const lngSpan = Math.max((maxLng - minLng) * this._BOUNDS_PADDING_MULTIPLIER, this._MIN_COORDINATE_SPAN);

        this._programmaticMove = true;
        this.map.region = new mapkit.CoordinateRegion(
            new mapkit.Coordinate(centerLat, centerLng),
            new mapkit.CoordinateSpan(latSpan, lngSpan)
        );
    },

    // ===== Leaflet-specific helpers =====

    /**
     * Create a Leaflet marker for a restaurant (Leaflet fallback).
     * @param {Object} restaurant
     * @returns {L.Marker|null}
     */
    createRestaurantMarker(restaurant) {
        if (!this.map || typeof L === 'undefined') return null;

        const lat = restaurant.coordinates.latitude;
        const lng = restaurant.coordinates.longitude;

        const restaurantIcon = L.divIcon({
            className: '',
            html: '<div class="ios-pin-marker restaurant"><div class="ios-pin-circle"></div><div class="ios-pin-tail"></div></div>',
            iconSize: [30, 43],
            iconAnchor: [15, 43],
            popupAnchor: [0, -43]
        });

        const popupContent = this.createPopupContent(restaurant);
        const marker = L.marker([lat, lng], { icon: restaurantIcon })
            .addTo(this.map)
            .bindPopup(popupContent, { maxWidth: 420, minWidth: 320 });

        marker.on('click', () => {
            if (window.UI && window.UI.highlightRestaurantCard) {
                window.UI.highlightRestaurantCard(restaurant.id);
            }
        });

        return marker;
    },

    /**
     * Create popup/callout HTML content for a restaurant.
     * Shared between the MapKit callout delegate and Leaflet popup.
     * @param {Object} restaurant
     * @returns {string} HTML string
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
        const socialLinks = API.getSocialMediaLinks(
            restaurant.name,
            location ? location.city : '',
            location ? location.state : ''
        );

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
    }
};
