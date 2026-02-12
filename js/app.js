// Main Application Module
const App = {
    currentView: CONFIG.VIEW_MODE_WORLD,

    locationControlsInitialized: false,
    activeSearchContext: null,

    /**
     * Initialize the application
     */
    init() {
        console.log('OnTheGo App Initializing...');
        
        // Initialize Account module
        if (typeof Account !== 'undefined') {
            Account.init();
        }
        
        // Initialize World Map (default view)
        if (typeof WorldMap !== 'undefined') {
            WorldMap.init();
            WorldMap.renderTripHistory();
            WorldMap.renderUpcomingTrips();
        }
        
        // Initialize UI for local view (hidden initially)
        UI.init();
        
        // Initialize Map for local view (hidden initially)
        MapModule.init();
        
        // Setup trip/hotel location controls (local view)
        this.setupLocationControls();

        // Setup view toggle
        this.setupViewToggle();

        // Setup travel log button
        this.setupTravelLogToggle();
        
        console.log('OnTheGo App Ready!');
    },

    /**
     * Setup view toggle between world map and local restaurant view
     */
    setupViewToggle() {
        const viewToggleBtn = document.getElementById('viewToggle');
        if (!viewToggleBtn) return;

        viewToggleBtn.addEventListener('click', () => {
            this.toggleView();
        });
    },

    /**
     * Setup travel log button
     */
    setupTravelLogToggle() {
        const travelLogBtn = document.getElementById('travelLogBtn');
        if (!travelLogBtn) return;

        travelLogBtn.addEventListener('click', () => {
            this.showTravelLog();
        });
    },

    /**
     * Toggle between world map and local restaurant view
     */
    toggleView() {
        const worldView = document.getElementById('worldView');
        const localView = document.getElementById('localView');
        const travelLogView = document.getElementById('travelLogView');
        const viewToggleBtn = document.getElementById('viewToggle');

        // Hide travel log if visible
        if (travelLogView) travelLogView.style.display = 'none';

        if (this.currentView === CONFIG.VIEW_MODE_LOCAL) {
            // Switch to world map view
            localView.style.display = 'none';
            worldView.style.display = 'flex';
            this.currentView = CONFIG.VIEW_MODE_WORLD;
            viewToggleBtn.innerHTML = '<i class="fas fa-list"></i><span>Restaurant List</span>';
            
            // Refresh world map
            if (WorldMap._leafletMap) {
                setTimeout(() => {
                    WorldMap._leafletMap.invalidateSize();
                }, 100);
            }
        } else if (this.currentView === CONFIG.VIEW_MODE_TRAVEL_LOG) {
            // From travel log, go back to world map
            worldView.style.display = 'flex';
            this.currentView = CONFIG.VIEW_MODE_WORLD;
            viewToggleBtn.innerHTML = '<i class="fas fa-list"></i><span>Restaurant List</span>';
            
            if (WorldMap._leafletMap) {
                setTimeout(() => {
                    WorldMap._leafletMap.invalidateSize();
                }, 100);
            }
        } else {
            // Switch to local restaurant view (from world map)
            worldView.style.display = 'none';
            localView.style.display = 'flex';
            this.currentView = CONFIG.VIEW_MODE_LOCAL;
            viewToggleBtn.innerHTML = '<i class="fas fa-globe"></i><span>World Map</span>';
            
            
            // Ensure location controls are initialized and default trip is selected
            this.setupLocationControls();
// Initialize local map if not already done
            if (MapModule.map) {
                setTimeout(() => {
                    MapModule.map.invalidateSize();
                }, 100);
            }
        }
    },

    /**
     * Show My Travel Log view
     */
    showTravelLog() {
        const worldView = document.getElementById('worldView');
        const localView = document.getElementById('localView');
        const travelLogView = document.getElementById('travelLogView');
        const viewToggleBtn = document.getElementById('viewToggle');

        worldView.style.display = 'none';
        localView.style.display = 'none';
        if (travelLogView) travelLogView.style.display = 'flex';

        this.currentView = CONFIG.VIEW_MODE_TRAVEL_LOG;
        viewToggleBtn.innerHTML = '<i class="fas fa-globe"></i><span>World Map</span>';

        // Render travel log content
        this.renderTravelLog();
    },

    /**
     * Render travel log with yearly records
     */
    renderTravelLog() {
        const statsContainer = document.getElementById('travelLogStats');
        const contentContainer = document.getElementById('travelLogContent');
        if (!statsContainer || !contentContainer) return;

        // Combine all trips
        const allTrips = [...MOCK_TRAVEL_HISTORY];

        // Calculate stats
        const totalTrips = allTrips.length;
        const totalCities = new Set(allTrips.map(t => t.city)).size;
        const totalRestaurantsVisited = allTrips.reduce((sum, t) => sum + (t.restaurantsVisited ? t.restaurantsVisited.length : 0), 0);
        const totalHotels = new Set(allTrips.map(t => t.hotel)).size;

        statsContainer.innerHTML = `
            <div class="travel-log-stat">
                <div class="travel-log-stat-number">${totalTrips}</div>
                <div class="travel-log-stat-label">Trips</div>
            </div>
            <div class="travel-log-stat">
                <div class="travel-log-stat-number">${totalCities}</div>
                <div class="travel-log-stat-label">Cities</div>
            </div>
            <div class="travel-log-stat">
                <div class="travel-log-stat-number">${totalHotels}</div>
                <div class="travel-log-stat-label">Hotels</div>
            </div>
            <div class="travel-log-stat">
                <div class="travel-log-stat-number">${totalRestaurantsVisited}</div>
                <div class="travel-log-stat-label">Places Eaten</div>
            </div>
        `;

        // Group trips by year
        const tripsByYear = {};
        allTrips.forEach(trip => {
            const year = new Date(trip.startDate).getFullYear();
            if (!tripsByYear[year]) tripsByYear[year] = [];
            tripsByYear[year].push(trip);
        });

        // Sort years descending
        const years = Object.keys(tripsByYear).sort((a, b) => b - a);

        contentContainer.innerHTML = '';
        years.forEach(year => {
            const yearSection = document.createElement('div');
            yearSection.className = 'travel-log-year';

            const trips = tripsByYear[year];

            yearSection.innerHTML = `
                <h3><i class="fas fa-calendar-alt"></i> ${year}</h3>
                <div class="travel-log-entries">
                    ${trips.map(trip => {
                        const dateRange = `${WorldMap.formatDate(trip.startDate)} - ${WorldMap.formatDate(trip.endDate)}`;
                        const visitedRestaurants = trip.restaurantsVisited || [];
                        
                        // Look up restaurant names from MOCK_RESTAURANTS
                        const restaurantDetails = visitedRestaurants.map(id => {
                            const r = MOCK_RESTAURANTS.find(mr => mr.id === id);
                            return r ? r : null;
                        }).filter(r => r !== null);

                        return `
                            <div class="travel-log-entry">
                                <div class="travel-log-entry-header">
                                    <div class="travel-log-city">${trip.city}, ${trip.state}</div>
                                    <div class="travel-log-dates">${dateRange}</div>
                                </div>
                                <div class="travel-log-hotel">
                                    <i class="fas fa-hotel"></i> ${trip.hotel}
                                </div>
                                ${restaurantDetails.length > 0 ? `
                                    <div class="travel-log-restaurants-title">
                                        <i class="fas fa-utensils"></i> Places Visited
                                    </div>
                                    <div class="travel-log-restaurant-list">
                                        ${restaurantDetails.map(r => `
                                            <div class="travel-log-restaurant-item">
                                                <span class="stars">${API.getStarRating(r.rating)}</span>
                                                <span>${r.name}</span>
                                                <span style="color:var(--success-color);font-weight:700;">${r.price || ''}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : `
                                    <div class="travel-log-no-restaurants">No dining records for this trip</div>
                                `}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            contentContainer.appendChild(yearSection);
        });
    },

        /**
     * Setup trip/hotel selector (Upcoming + Past) and optional GPS button.
     * Default selection: next upcoming trip.
     */
    setupLocationControls() {
        if (this.locationControlsInitialized) return;

        const select = document.getElementById('tripLocationSelect');
        const gpsBtn = document.getElementById('useGpsBtn');

        if (!select) return;

        // Build dropdown options
        select.innerHTML = '<option value="" disabled>Select a trip…</option>';

        const upcomingGroup = document.createElement('optgroup');
        upcomingGroup.label = 'Upcoming Trips';
        MOCK_UPCOMING_TRIPS.forEach(trip => {
            upcomingGroup.appendChild(this.createTripOption(trip, 'upcoming'));
        });

        const pastGroup = document.createElement('optgroup');
        pastGroup.label = 'Past Trips';
        MOCK_TRAVEL_HISTORY.forEach(trip => {
            pastGroup.appendChild(this.createTripOption(trip, 'past'));
        });

        select.appendChild(upcomingGroup);
        select.appendChild(pastGroup);

        // Default to the next upcoming trip (earliest startDate that is today or later)
        const defaultTrip = this.getNextUpcomingTrip();
        if (defaultTrip) {
            select.value = `upcoming:${defaultTrip.id}`;
            this.applyTripSelection(defaultTrip, 'upcoming');
        } else if (MOCK_TRAVEL_HISTORY.length > 0) {
            // fallback: most recent past trip
            const mostRecent = [...MOCK_TRAVEL_HISTORY].sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0];
            select.value = `past:${mostRecent.id}`;
            this.applyTripSelection(mostRecent, 'past');
        }

        select.addEventListener('change', () => {
            const value = select.value || '';
            const [type, id] = value.split(':');
            if (!type || !id) return;

            const list = type === 'upcoming' ? MOCK_UPCOMING_TRIPS : MOCK_TRAVEL_HISTORY;
            const trip = list.find(t => t.id === id);
            if (trip) {
                this.applyTripSelection(trip, type);
            }
        });

        if (gpsBtn) {
            gpsBtn.addEventListener('click', () => {
                if (window.MapModule && MapModule.requestUserLocation) {
                    MapModule.requestUserLocation();
                } else if (window.MapModule && MapModule.getUserLocation) {
                    MapModule.getUserLocation();
                }
            });
        }

        this.locationControlsInitialized = true;
    },

    /**
     * Create a dropdown option for a trip.
     */
    createTripOption(trip, type) {
        const option = document.createElement('option');
        option.value = `${type}:${trip.id}`;

        const dateRange = this.formatDateRange(trip.startDate, trip.endDate);
        // Label requested: hotel + dates (include city in parentheses for clarity)
        option.textContent = `${trip.hotel} (${trip.city}) — ${dateRange}`;
        return option;
    },

    /**
     * Pick the next upcoming trip (earliest upcoming trip starting today or later).
     */
    getNextUpcomingTrip() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcomingSorted = [...MOCK_UPCOMING_TRIPS]
            .filter(t => t.startDate)
            .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

        return upcomingSorted.find(t => {
            const start = new Date(t.startDate);
            start.setHours(0, 0, 0, 0);
            return start >= today;
        }) || upcomingSorted[0] || null;
    },

    /**
     * Format a date range for display.
     * Examples:
     * - Mar 15–19, 2026
     * - Mar 30 – Apr 2, 2026
     * - Dec 30, 2026 – Jan 2, 2027
     */
    formatDateRange(startDateStr, endDateStr) {
        const start = new Date(startDateStr);
        const end = new Date(endDateStr);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return `${startDateStr} – ${endDateStr}`;
        }

        const sY = start.getFullYear();
        const eY = end.getFullYear();
        const sM = start.toLocaleString('en-US', { month: 'short' });
        const eM = end.toLocaleString('en-US', { month: 'short' });
        const sD = start.getDate();
        const eD = end.getDate();

        const sameYear = sY === eY;
        const sameMonth = sameYear && start.getMonth() === end.getMonth();

        if (sameYear && sameMonth) {
            return `${sM} ${sD}–${eD}, ${sY}`;
        }
        if (sameYear) {
            return `${sM} ${sD} – ${eM} ${eD}, ${sY}`;
        }
        return `${sM} ${sD}, ${sY} – ${eM} ${eD}, ${eY}`;
    },

    /**
     * Apply trip selection: update active label, center map, and load restaurants.
     */
    applyTripSelection(trip, type) {
        const dateRange = this.formatDateRange(trip.startDate, trip.endDate);
        const label = `${trip.hotel} • ${dateRange}`;

        const activeLabel = document.getElementById('activeLocationLabel');
        if (activeLabel) {
            activeLabel.textContent = `Active: ${trip.hotel} • ${dateRange}`;
        }

        this.activeSearchContext = { type, tripId: trip.id };

        const lat = trip.coordinates?.latitude;
        const lng = trip.coordinates?.longitude;

        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            if (window.MapModule && MapModule.setSearchCenter) {
                MapModule.setSearchCenter(lat, lng, label);
            } else if (window.App && App.onLocationReady) {
                App.onLocationReady(lat, lng);
            }
        }
    },
/**
     * Called when user location is ready
     * @param {number} latitude - User's latitude
     * @param {number} longitude - User's longitude
     */
    async onLocationReady(latitude, longitude) {
        console.log(`Location ready: ${latitude}, ${longitude}`);

        // Show loading state in local view
        if (window.UI && UI.showLoadingState) {
            UI.showLoadingState();
        }

        try {
            // Fetch restaurants
            const restaurants = await API.fetchRestaurants(latitude, longitude);
            console.log(`Found ${restaurants.length} restaurants`);
            
            // Update UI with restaurants
            UI.setRestaurants(restaurants);
            
        } catch (error) {
            console.error('Error loading restaurants:', error);
            UI.hideLoadingState();
            UI.showEmptyState();
        }
    }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        App.init();
    });
} else {
    App.init();
}

// Make App available globally
window.App = App;
window.UI = UI;
window.MapModule = MapModule;
window.WorldMap = WorldMap;
window.Account = Account;
