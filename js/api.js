// API Integration Module
const API = {
    /**
     * Fetch restaurants from Yelp API or return mock data
     * @param {number} latitude - User's latitude
     * @param {number} longitude - User's longitude
     * @returns {Promise<Array>} - Array of restaurant objects
     */
    async fetchRestaurants(latitude, longitude) {
        // Check if Yelp proxy is configured
        if (!CONFIG.YELP_API_URL || CONFIG.YELP_API_URL === '') {
            console.log('Yelp proxy not configured. Using mock data.');
            return this.getMockRestaurants(latitude, longitude);
        }

        try {
            const payload = {
                latitude,
                longitude,
                radius: CONFIG.SEARCH_RADIUS,
                limit: CONFIG.SEARCH_LIMIT,
                categories: 'restaurants,bars,breweries,nightlife',
                sort_by: 'rating'
            };

            const response = await fetch(CONFIG.YELP_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Yelp API error: ${response.status}`);
            }

            const data = await response.json();
            return data.businesses || [];
        } catch (error) {
            console.error('Error fetching from Yelp API:', error);
            console.log('Falling back to mock data.');
            return this.getMockRestaurants(latitude, longitude);
        }
    },

    /**
     * Get mock restaurant data, relocated around the given coordinates
     * @param {number} latitude - User's latitude
     * @param {number} longitude - User's longitude
     * @returns {Promise<Array>} - Array of mock restaurant objects
     */
    async getMockRestaurants(latitude, longitude) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, CONFIG.MOCK_API_DELAY));
        
        // Relocate mock restaurants around the given coordinates so they appear
        // on the map regardless of which city/hotel is selected.
        const offsets = [
            { lat: 0.005, lng: 0.003 },
            { lat: -0.003, lng: 0.006 },
            { lat: 0.004, lng: -0.005 },
            { lat: -0.006, lng: -0.002 },
            { lat: 0.002, lng: -0.007 },
            { lat: 0.006, lng: 0.005 },
            { lat: -0.004, lng: -0.006 },
            { lat: -0.002, lng: 0.008 },
            { lat: 0.007, lng: -0.003 },
            { lat: -0.005, lng: -0.004 },
            { lat: 0.003, lng: 0.007 },
            { lat: -0.007, lng: 0.002 },
            { lat: 0.001, lng: -0.008 },
            { lat: -0.004, lng: 0.005 },
        ];

        return MOCK_RESTAURANTS.map((restaurant, i) => {
            const offset = offsets[i % offsets.length];
            const newLat = latitude + offset.lat;
            const newLng = longitude + offset.lng;
            const distance = this.calculateDistance(
                latitude,
                longitude,
                newLat,
                newLng
            );
            
            return {
                ...restaurant,
                coordinates: {
                    latitude: newLat,
                    longitude: newLng
                },
                distance: Math.round(distance)
            };
        });
    },

    /**
     * Calculate distance between two coordinates using Haversine formula
     * @param {number} lat1 - First latitude
     * @param {number} lon1 - First longitude
     * @param {number} lat2 - Second latitude
     * @param {number} lon2 - Second longitude
     * @returns {number} - Distance in meters
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    },

    /**
     * Generate social media search URLs
     * @param {string} restaurantName - Name of the restaurant
     * @param {string} [city] - City name
     * @param {string} [state] - State abbreviation
     * @returns {Object} - Object containing social media URLs
     */
    getSocialMediaLinks(restaurantName, city, state) {
        const locationParts = [restaurantName, city, state].filter(Boolean);
        const encodedName = encodeURIComponent(restaurantName);
        const encodedQuery = encodeURIComponent(locationParts.join(' '));
        
        return {
            instagram: `https://www.instagram.com/explore/tags/${encodedName.replace(/%20/g, '')}/`,
            facebook: `https://www.facebook.com/search/top?q=${encodedQuery}`,
            twitter: `https://twitter.com/search?q=${encodedQuery}`,
            // Fallback search links
            instagramSearch: `https://www.google.com/search?q=${encodedQuery}+instagram`,
            facebookSearch: `https://www.google.com/search?q=${encodedQuery}+facebook`,
            twitterSearch: `https://www.google.com/search?q=${encodedQuery}+twitter`
        };
    },

    /**
     * Generate delivery platform URLs
     * @param {string} restaurantName - Name of the restaurant
     * @param {string} address - Restaurant address
     * @returns {Object} - Object containing delivery platform URLs
     */
    getDeliveryLinks(restaurantName, address) {
        const encodedName = encodeURIComponent(restaurantName);
        const encodedAddress = encodeURIComponent(address);
        
        return {
            ubereats: `https://www.ubereats.com/search?q=${encodedName}`,
            doordash: `https://www.doordash.com/search/?query=${encodedName}`,
            grubhub: `https://www.grubhub.com/search?searchTerm=${encodedName}`
        };
    },

    /**
     * Generate reservation platform URLs
     * @param {string} restaurantName - Name of the restaurant
     * @param {string} city - Restaurant city
     * @returns {Object} - Object containing reservation platform URLs
     */
    getReservationLinks(restaurantName, city) {
        const encodedName = encodeURIComponent(restaurantName);
        const encodedCity = encodeURIComponent(city || '');
        
        return {
            opentable: `https://www.opentable.com/s?term=${encodedName}${city ? `&metroId=${encodedCity}` : ''}`,
            resy: `https://resy.com/cities/${encodedCity ? encodedCity.toLowerCase() : 'sf'}?search=${encodedName}`
        };
    },

    /**
     * Format distance for display (in miles)
     * @param {number} meters - Distance in meters
     * @returns {string} - Formatted distance string
     */
    formatDistance(meters) {
        const miles = meters / 1609.344;
        if (miles < 0.1) {
            const feet = Math.round(meters * 3.28084);
            return `${feet} ft`;
        } else {
            return `${miles.toFixed(1)} mi`;
        }
    },

    /**
     * Generate star rating HTML
     * @param {number} rating - Rating value (0-5)
     * @returns {string} - HTML string with star icons
     */
    getStarRating(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        
        let stars = '';
        for (let i = 0; i < fullStars; i++) {
            stars += '<i class="fas fa-star"></i>';
        }
        if (hasHalfStar) {
            stars += '<i class="fas fa-star-half-alt"></i>';
        }
        for (let i = 0; i < emptyStars; i++) {
            stars += '<i class="far fa-star"></i>';
        }
        
        return stars;
    }
};
