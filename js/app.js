// Main Application Module
const App = {
    currentView: CONFIG.VIEW_MODE_WORLD,

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
        
        // Setup view toggle
        this.setupViewToggle();
        
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
     * Toggle between world map and local restaurant view
     */
    toggleView() {
        const worldView = document.getElementById('worldView');
        const localView = document.getElementById('localView');
        const viewToggleBtn = document.getElementById('viewToggle');

        if (this.currentView === CONFIG.VIEW_MODE_WORLD) {
            // Switch to local restaurant view
            worldView.style.display = 'none';
            localView.style.display = 'flex';
            this.currentView = CONFIG.VIEW_MODE_LOCAL;
            viewToggleBtn.innerHTML = '<i class="fas fa-globe"></i><span>World Map</span>';
            
            // Initialize local map if not already done
            if (MapModule.map) {
                setTimeout(() => {
                    MapModule.map.invalidateSize();
                }, 100);
            }
        } else {
            // Switch to world map view
            localView.style.display = 'none';
            worldView.style.display = 'flex';
            this.currentView = CONFIG.VIEW_MODE_WORLD;
            viewToggleBtn.innerHTML = '<i class="fas fa-list"></i><span>Restaurant List</span>';
            
            // Refresh world map if not already done
            if (WorldMap.map) {
                setTimeout(() => {
                    WorldMap.map.invalidateSize();
                }, 100);
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
