// UI Module - Handles restaurant card rendering and interactions
const UI = {
    restaurants: [],
    filteredRestaurants: [],

    /**
     * Initialize UI components
     */
    init() {
        this.setupEventListeners();
        this.setupSidebarResize();
        this.showLoadingState();
    },

    /**
     * Setup event listeners for filters and search
     */
    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }

        // Filter dropdowns
        const cuisineFilter = document.getElementById('cuisineFilter');
        const priceFilter = document.getElementById('priceFilter');
        const ambianceFilter = document.getElementById('ambianceFilter');
        const sortBy = document.getElementById('sortBy');
        const visitedFilter = document.getElementById('visitedFilter');

        if (cuisineFilter) cuisineFilter.addEventListener('change', () => this.applyFilters());
        if (priceFilter) priceFilter.addEventListener('change', () => this.applyFilters());
        if (ambianceFilter) ambianceFilter.addEventListener('change', () => this.applyFilters());
        if (sortBy) sortBy.addEventListener('change', () => this.applyFilters());
        if (visitedFilter) visitedFilter.addEventListener('change', () => this.applyFilters());
    },

    /**
     * Setup sidebar resize handle and toggle button
     */
    setupSidebarResize() {
        const sidebar = document.getElementById('searchSidebar');
        const handle = document.getElementById('sidebarResizeHandle');
        const toggleBtn = document.getElementById('sidebarToggleBtn');
        if (!sidebar || !handle) return;

        let isResizing = false;
        let startX = 0;
        let startWidth = 0;

        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = sidebar.offsetWidth;
            handle.classList.add('active');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const newWidth = startWidth + (e.clientX - startX);
            const clampedWidth = Math.max(280, Math.min(newWidth, 600));
            sidebar.style.width = clampedWidth + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (!isResizing) return;
            isResizing = false;
            handle.classList.remove('active');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            // Refresh map size after resize
            if (window.MapModule && MapModule.map) {
                MapModule.map.invalidateSize();
            }
        });

        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const isCollapsed = sidebar.classList.toggle('sidebar-collapsed');
                if (isCollapsed) {
                    sidebar.dataset.prevWidth = sidebar.style.width || '320px';
                    sidebar.style.width = '0px';
                    toggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
                } else {
                    sidebar.style.width = sidebar.dataset.prevWidth || '320px';
                    toggleBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
                }
                // Refresh map size after toggle
                if (window.MapModule && MapModule.map) {
                    setTimeout(() => { MapModule.map.invalidateSize(); }, 200);
                }
            });
        }
    },

    /**
     * Show loading state
     */
    showLoadingState() {
        const loadingState = document.getElementById('loadingState');
        const emptyState = document.getElementById('emptyState');
        
        if (loadingState) loadingState.style.display = 'flex';
        if (emptyState) emptyState.style.display = 'none';
        
        // Clear restaurant list
        const restaurantList = document.getElementById('restaurantList');
        if (restaurantList) {
            const cards = restaurantList.querySelectorAll('.restaurant-card');
            cards.forEach(card => card.remove());
        }
    },

    /**
     * Hide loading state
     */
    hideLoadingState() {
        const loadingState = document.getElementById('loadingState');
        if (loadingState) loadingState.style.display = 'none';
    },

    /**
     * Show empty state
     */
    showEmptyState() {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) emptyState.style.display = 'flex';
    },

    /**
     * Hide empty state
     */
    hideEmptyState() {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) emptyState.style.display = 'none';
    },

    /**
     * Set restaurants data and populate cuisine filter
     * @param {Array} restaurants - Array of restaurant objects
     * @param {Object} [options] - Options
     * @param {boolean} [options.skipFitBounds=false] - When true, do not auto-zoom map to fit markers
     */
    setRestaurants(restaurants, options = {}) {
        this.restaurants = restaurants;
        this.filteredRestaurants = [...restaurants];
        this._renderOptions = options;
        this.populateCuisineFilter();
        this.applyFilters();
    },

    /**
     * Populate cuisine filter dropdown
     */
    populateCuisineFilter() {
        const cuisineFilter = document.getElementById('cuisineFilter');
        if (!cuisineFilter) return;
        const cuisines = getUniqueCuisines(this.restaurants);

        // Clear existing options except "All Cuisines"
        cuisineFilter.innerHTML = '<option value="">All Cuisines</option>';

        // Add cuisine options
        cuisines.forEach(cuisine => {
            const option = document.createElement('option');
            option.value = cuisine;
            option.textContent = cuisine;
            cuisineFilter.appendChild(option);
        });
    },

    /**
     * Handle search input
     * @param {string} query - Search query
     */
    handleSearch(query) {
        this.applyFilters(query);
    },

    /**
     * Apply all filters and sorting
     * @param {string} searchQuery - Optional search query
     */
    applyFilters(searchQuery = null) {
        const cuisineFilter = document.getElementById('cuisineFilter')?.value || '';
        const priceFilter = document.getElementById('priceFilter')?.value || '';
        const ambianceFilter = document.getElementById('ambianceFilter')?.value || '';
        const sortBy = document.getElementById('sortBy')?.value || 'rating';
        const visitedOnly = document.getElementById('visitedFilter')?.checked || false;
        const query = searchQuery !== null 
            ? searchQuery 
            : (document.getElementById('searchInput')?.value || '');

        // Start with all restaurants
        let filtered = [...this.restaurants];

        // Apply cuisine filter
        if (cuisineFilter) {
            filtered = filtered.filter(restaurant => {
                return restaurant.categories && restaurant.categories.some(cat => cat.title === cuisineFilter);
            });
        }

        // Apply price filter
        if (priceFilter) {
            filtered = filtered.filter(restaurant => restaurant.price === priceFilter);
        }

        // Apply ambiance filter
        if (ambianceFilter) {
            filtered = filtered.filter(restaurant => {
                return restaurant.tags && restaurant.tags.includes(ambianceFilter);
            });
        }

        // Apply visited filter
        if (visitedOnly) {
            filtered = filtered.filter(restaurant => restaurant.visited === true);
        }

        // Apply search query (name, cuisine, city, state, or zip)
        if (query && query.trim() !== '') {
            const lowerQuery = query.toLowerCase();
            filtered = filtered.filter(restaurant => {
                const nameMatch = restaurant.name.toLowerCase().includes(lowerQuery);
                const categoryMatch = restaurant.categories && restaurant.categories.some(cat => 
                    cat.title.toLowerCase().includes(lowerQuery)
                );
                const location = restaurant.location;
                const cityMatch = location && location.city && location.city.toLowerCase().includes(lowerQuery);
                const stateMatch = location && location.state && location.state.toLowerCase().includes(lowerQuery);
                const zipMatch = location && location.zip_code && location.zip_code.includes(query.trim());
                return nameMatch || categoryMatch || cityMatch || stateMatch || zipMatch;
            });
        }

        // Apply sorting
        this.sortRestaurants(filtered, sortBy);

        // Update filtered restaurants
        this.filteredRestaurants = filtered;

        // Render results
        this.renderRestaurants(filtered);
    },

    /**
     * Sort restaurants based on criteria
     * @param {Array} restaurants - Array to sort
     * @param {string} sortBy - Sort criteria
     */
    sortRestaurants(restaurants, sortBy) {
        switch(sortBy) {
            case 'rating':
                restaurants.sort((a, b) => b.rating - a.rating);
                break;
            case 'distance':
                restaurants.sort((a, b) => a.distance - b.distance);
                break;
            case 'review_count':
                restaurants.sort((a, b) => b.review_count - a.review_count);
                break;
        }
    },

    /**
     * Render restaurant cards
     * @param {Array} restaurants - Array of restaurant objects to render
     */
    renderRestaurants(restaurants) {
        this.hideLoadingState();
        
        const restaurantList = document.getElementById('restaurantList');
        if (!restaurantList) return;
        
        // Remove existing cards
        const existingCards = restaurantList.querySelectorAll('.restaurant-card');
        existingCards.forEach(card => card.remove());

        if (restaurants.length === 0) {
            this.showEmptyState();
            return;
        }

        this.hideEmptyState();

        // Create and append cards
        restaurants.forEach(restaurant => {
            const card = this.createRestaurantCard(restaurant);
            restaurantList.appendChild(card);
        });

        // Update map markers
        if (window.MapModule && window.MapModule.addRestaurantMarkers) {
            const opts = this._renderOptions || {};
            window.MapModule.addRestaurantMarkers(restaurants, { skipFitBounds: !!opts.skipFitBounds });
            this._renderOptions = null;
        }
    },

    /**
     * Create a restaurant card element
     * @param {Object} restaurant - Restaurant object
     * @returns {HTMLElement} - Card element
     */
    createRestaurantCard(restaurant) {
        const card = document.createElement('div');
        card.className = 'restaurant-card';
        card.id = `restaurant-${restaurant.id}`;

        // Get categories
        const categories = restaurant.categories
            ? restaurant.categories.map(cat => cat.title).join(', ')
            : '';

        // Get address
        const location = restaurant.location;
        const address = location 
            ? `${location.address1}, ${location.city}, ${location.state} ${location.zip_code}`
            : '';

        // Get social media links
        const socialLinks = API.getSocialMediaLinks(
            restaurant.name,
            location ? location.city : '',
            location ? location.state : ''
        );
        
        // Get delivery links
        const deliveryLinks = API.getDeliveryLinks(restaurant.name, address);
        
        // Get reservation links
        const reservationLinks = API.getReservationLinks(
            restaurant.name, 
            location ? location.city : ''
        );

        // Build card HTML
        card.innerHTML = `
            <div class="restaurant-header">
                <div style="flex: 1;">
                    <div class="restaurant-name">${restaurant.name}</div>
                    <div class="restaurant-category">${categories}</div>
                </div>
                ${restaurant.image_url ? `<img src="${restaurant.image_url}" alt="${restaurant.name}" class="restaurant-image">` : ''}
            </div>
            
            <div class="restaurant-rating">
                <span class="stars">${API.getStarRating(restaurant.rating)}</span>
                <span class="rating-number">${restaurant.rating}</span>
                <span class="review-count">(${restaurant.review_count} reviews)</span>
                ${restaurant.visited ? '<span class="visited-indicator"><i class="fas fa-check"></i> Visited</span>' : ''}
            </div>
            
            <div class="restaurant-info">
                <div class="info-item">
                    <i class="fas fa-dollar-sign"></i>
                    <span class="price-level">${restaurant.price || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <i class="fas fa-walking"></i>
                    <span>${API.formatDistance(restaurant.distance)}</span>
                </div>
                ${restaurant.display_phone ? `
                <div class="info-item">
                    <i class="fas fa-phone"></i>
                    <span>${restaurant.display_phone}</span>
                </div>
                ` : ''}
            </div>
            
            ${restaurant.tags && restaurant.tags.length > 0 ? `
            <div class="restaurant-tags">
                ${restaurant.tags.map(tag => {
                    const tagClassMap = {
                        'Good for Business Meal': 'business',
                        'Chill': 'chill',
                        'Fun': 'fun',
                        'Local Spots': 'local'
                    };
                    const tagClass = tagClassMap[tag] || tag.toLowerCase().replace(/\s+/g, '-');
                    return `<span class="tag-badge ${tagClass}">${tag}</span>`;
                }).join('')}
            </div>
            ` : ''}
            
            <div class="restaurant-address">
                <i class="fas fa-map-marker-alt"></i>
                <span>${address}</span>
            </div>
            
            <div class="restaurant-actions">
                <a href="${restaurant.url}" target="_blank" rel="noopener noreferrer" class="action-link yelp">
                    <i class="fab fa-yelp"></i> View on Yelp
                </a>
                <a href="${deliveryLinks.ubereats}" target="_blank" rel="noopener noreferrer" class="action-link">
                    <i class="fas fa-hamburger"></i> Uber Eats
                </a>
                <a href="${deliveryLinks.doordash}" target="_blank" rel="noopener noreferrer" class="action-link">
                    <i class="fas fa-motorcycle"></i> DoorDash
                </a>
                <a href="${deliveryLinks.grubhub}" target="_blank" rel="noopener noreferrer" class="action-link">
                    <i class="fas fa-utensils"></i> Grubhub
                </a>
                <a href="${reservationLinks.opentable}" target="_blank" rel="noopener noreferrer" class="action-link">
                    <i class="fas fa-calendar-check"></i> OpenTable
                </a>
                <a href="${reservationLinks.resy}" target="_blank" rel="noopener noreferrer" class="action-link">
                    <i class="fas fa-bookmark"></i> Resy
                </a>
            </div>
            
            <div class="social-links">
                <a href="${socialLinks.instagram}" target="_blank" rel="noopener noreferrer" 
                   class="social-link instagram" title="View on Instagram">
                    <i class="fab fa-instagram"></i>
                </a>
                <a href="${socialLinks.facebook}" target="_blank" rel="noopener noreferrer" 
                   class="social-link facebook" title="View on Facebook">
                    <i class="fab fa-facebook-f"></i>
                </a>
                <a href="${socialLinks.twitter}" target="_blank" rel="noopener noreferrer" 
                   class="social-link twitter" title="View on Twitter">
                    <i class="fab fa-twitter"></i>
                </a>
            </div>
            
            ${restaurant.instagram_photos && restaurant.instagram_photos.length > 0 ? `
            <div class="instagram-section">
                <div class="instagram-header">
                    <i class="fab fa-instagram"></i>
                    <span>Recent Instagram Posts</span>
                </div>
                <div class="instagram-photos">
                    ${restaurant.instagram_photos.map(photo => `
                        <div class="instagram-photo">
                            <img src="${photo.url}" alt="Photo by @${photo.username}" loading="lazy">
                            <div class="instagram-overlay">
                                <div class="instagram-username">@${photo.username}</div>
                                <div class="instagram-timestamp">${photo.timestamp}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
        `;

        // Add click event to pan map to restaurant
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking on a link
            if (e.target.tagName === 'A' || e.target.closest('a')) {
                return;
            }
            
            if (window.MapModule && window.MapModule.openMarkerPopup) {
                window.MapModule.openMarkerPopup(restaurant.id, this.filteredRestaurants);
            }
        });

        return card;
    },

    /**
     * Highlight a restaurant card (when marker is clicked)
     * @param {string} restaurantId - Restaurant ID
     */
    highlightRestaurantCard(restaurantId) {
        const card = document.getElementById(`restaurant-${restaurantId}`);
        if (card) {
            // Remove highlight from all cards
            const allCards = document.querySelectorAll('.restaurant-card');
            allCards.forEach(card => card.style.borderColor = '');

            // Highlight the selected card
            card.style.borderColor = 'var(--primary-color)';
            card.style.borderWidth = '2px';

            // Scroll to card
            card.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });

            // Remove highlight after 2 seconds
            setTimeout(() => {
                card.style.borderColor = '';
                card.style.borderWidth = '';
            }, 2000);
        }
    }
};
