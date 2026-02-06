// Main Application Module
const App = {
    /**
     * Initialize the application
     */
    init() {
        console.log('OnTheGo App Initializing...');
        
        // Initialize UI
        UI.init();
        
        // Initialize Map
        MapModule.init();
        
        console.log('OnTheGo App Ready!');
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
