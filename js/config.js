// Configuration and Constants
const CONFIG = {
    // Default map center (San Francisco)
    DEFAULT_LAT: 37.7749,
    DEFAULT_LNG: -122.4194,
    DEFAULT_ZOOM: 13,
    
    // Yelp API settings
    YELP_API_KEY: '', // Will be loaded from environment or left empty to use mock data
    YELP_API_URL: 'https://api.yelp.com/v3/businesses/search',
    
    // Search parameters
    SEARCH_RADIUS: 5000, // 5km in meters
    SEARCH_LIMIT: 20,
    
    // Mock API settings
    MOCK_API_DELAY: 500, // Delay in milliseconds for mock data
    
    // Map marker icon
    MARKER_ICON_URL: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    
    // World map settings
    WORLD_MAP_ZOOM: 2,
    WORLD_MAP_MIN_ZOOM: 2,
    WORLD_MAP_MAX_ZOOM: 18,
    
    // View modes
    VIEW_MODE_WORLD: 'world',
    VIEW_MODE_LOCAL: 'local',
};

// Sample/Mock Restaurant Data
// This data will be used when Yelp API is not configured
const MOCK_RESTAURANTS = [
    {
        id: '1',
        name: 'The Golden Spoon',
        image_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=300&h=300&fit=crop',
        categories: [{ title: 'Italian' }, { title: 'Pizza' }],
        rating: 4.5,
        review_count: 328,
        price: '$$',
        location: {
            address1: '123 Market Street',
            city: 'San Francisco',
            state: 'CA',
            zip_code: '94103'
        },
        coordinates: {
            latitude: 37.7849,
            longitude: -122.4094
        },
        display_phone: '(415) 555-0123',
        distance: 450,
        url: 'https://www.yelp.com',
        tags: ['Local Spots', 'Good for Business Meal'],
        visited: true,
        visitDate: '2024-11-15'
    },
    {
        id: '2',
        name: 'Sushi Paradise',
        image_url: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=300&h=300&fit=crop',
        categories: [{ title: 'Japanese' }, { title: 'Sushi' }],
        rating: 4.8,
        review_count: 512,
        price: '$$$',
        location: {
            address1: '456 California Street',
            city: 'San Francisco',
            state: 'CA',
            zip_code: '94108'
        },
        coordinates: {
            latitude: 37.7919,
            longitude: -122.4058
        },
        display_phone: '(415) 555-0456',
        distance: 890,
        url: 'https://www.yelp.com',
        tags: ['Chill', 'Local Spots'],
        visited: true,
        visitDate: '2024-10-22'
    },
    {
        id: '3',
        name: 'Burger Heaven',
        image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=300&fit=crop',
        categories: [{ title: 'American' }, { title: 'Burgers' }],
        rating: 4.2,
        review_count: 245,
        price: '$',
        location: {
            address1: '789 Mission Street',
            city: 'San Francisco',
            state: 'CA',
            zip_code: '94103'
        },
        coordinates: {
            latitude: 37.7799,
            longitude: -122.4134
        },
        display_phone: '(415) 555-0789',
        distance: 320,
        url: 'https://www.yelp.com',
        tags: ['Fun', 'Chill'],
        visited: false
    },
    {
        id: '4',
        name: 'Taco Fiesta',
        image_url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=300&h=300&fit=crop',
        categories: [{ title: 'Mexican' }, { title: 'Tacos' }],
        rating: 4.6,
        review_count: 421,
        price: '$$',
        location: {
            address1: '321 Valencia Street',
            city: 'San Francisco',
            state: 'CA',
            zip_code: '94110'
        },
        coordinates: {
            latitude: 37.7649,
            longitude: -122.4214
        },
        display_phone: '(415) 555-0321',
        distance: 1200,
        url: 'https://www.yelp.com',
        tags: ['Fun', 'Local Spots'],
        visited: true,
        visitDate: '2025-01-10'
    },
    {
        id: '5',
        name: 'Thai Delight',
        image_url: 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=300&h=300&fit=crop',
        categories: [{ title: 'Thai' }, { title: 'Asian' }],
        rating: 4.4,
        review_count: 298,
        price: '$$',
        location: {
            address1: '654 Geary Boulevard',
            city: 'San Francisco',
            state: 'CA',
            zip_code: '94102'
        },
        coordinates: {
            latitude: 37.7869,
            longitude: -122.4194
        },
        display_phone: '(415) 555-0654',
        distance: 780,
        url: 'https://www.yelp.com',
        tags: ['Chill'],
        visited: false
    },
    {
        id: '6',
        name: 'La Bella Vita',
        image_url: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=300&h=300&fit=crop',
        categories: [{ title: 'Italian' }, { title: 'Pasta' }],
        rating: 4.7,
        review_count: 356,
        price: '$$$',
        location: {
            address1: '987 Columbus Avenue',
            city: 'San Francisco',
            state: 'CA',
            zip_code: '94133'
        },
        coordinates: {
            latitude: 37.8019,
            longitude: -122.4078
        },
        display_phone: '(415) 555-0987',
        distance: 1450,
        url: 'https://www.yelp.com',
        tags: ['Good for Business Meal', 'Chill'],
        visited: true,
        visitDate: '2024-09-05'
    },
    {
        id: '7',
        name: 'The Steakhouse',
        image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=300&h=300&fit=crop',
        categories: [{ title: 'Steakhouse' }, { title: 'American' }],
        rating: 4.9,
        review_count: 678,
        price: '$$$$',
        location: {
            address1: '147 Powell Street',
            city: 'San Francisco',
            state: 'CA',
            zip_code: '94102'
        },
        coordinates: {
            latitude: 37.7879,
            longitude: -122.4074
        },
        display_phone: '(415) 555-0147',
        distance: 650,
        url: 'https://www.yelp.com',
        tags: ['Good for Business Meal'],
        visited: true,
        visitDate: '2024-12-03'
    },
    {
        id: '8',
        name: 'Pho Kitchen',
        image_url: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=300&h=300&fit=crop',
        categories: [{ title: 'Vietnamese' }, { title: 'Pho' }],
        rating: 4.3,
        review_count: 189,
        price: '$',
        location: {
            address1: '258 Larkin Street',
            city: 'San Francisco',
            state: 'CA',
            zip_code: '94102'
        },
        coordinates: {
            latitude: 37.7819,
            longitude: -122.4164
        },
        display_phone: '(415) 555-0258',
        distance: 520,
        url: 'https://www.yelp.com',
        tags: ['Local Spots', 'Chill'],
        visited: false
    },
    {
        id: '9',
        name: 'Mediterranean Grill',
        image_url: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=300&h=300&fit=crop',
        categories: [{ title: 'Mediterranean' }, { title: 'Greek' }],
        rating: 4.5,
        review_count: 267,
        price: '$$',
        location: {
            address1: '369 Fillmore Street',
            city: 'San Francisco',
            state: 'CA',
            zip_code: '94117'
        },
        coordinates: {
            latitude: 37.7739,
            longitude: -122.4314
        },
        display_phone: '(415) 555-0369',
        distance: 1150,
        url: 'https://www.yelp.com',
        tags: ['Chill', 'Local Spots'],
        visited: false
    },
    {
        id: '10',
        name: 'Dim Sum Palace',
        image_url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=300&h=300&fit=crop',
        categories: [{ title: 'Chinese' }, { title: 'Dim Sum' }],
        rating: 4.6,
        review_count: 534,
        price: '$$',
        location: {
            address1: '741 Grant Avenue',
            city: 'San Francisco',
            state: 'CA',
            zip_code: '94108'
        },
        coordinates: {
            latitude: 37.7949,
            longitude: -122.4068
        },
        display_phone: '(415) 555-0741',
        distance: 980,
        url: 'https://www.yelp.com',
        tags: ['Fun', 'Local Spots'],
        visited: true,
        visitDate: '2024-08-18'
    }
];

// Helper function to get cuisine types from mock data
function getUniqueCuisines(restaurants) {
    const cuisines = new Set();
    restaurants.forEach(restaurant => {
        if (restaurant.categories && restaurant.categories.length > 0) {
            restaurant.categories.forEach(cat => cuisines.add(cat.title));
        }
    });
    return Array.from(cuisines).sort();
}

// Mock Travel History Data (for Concur/TripIt integration simulation)
const MOCK_TRAVEL_HISTORY = [
    {
        id: 'trip1',
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        coordinates: { latitude: 37.7749, longitude: -122.4194 },
        startDate: '2024-11-12',
        endDate: '2024-11-16',
        purpose: 'Business',
        hotel: 'The St. Regis San Francisco',
        restaurantsVisited: ['1', '7']
    },
    {
        id: 'trip2',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        startDate: '2024-10-20',
        endDate: '2024-10-24',
        purpose: 'Business',
        hotel: 'The Plaza Hotel',
        restaurantsVisited: ['2']
    },
    {
        id: 'trip3',
        city: 'Chicago',
        state: 'IL',
        country: 'USA',
        coordinates: { latitude: 41.8781, longitude: -87.6298 },
        startDate: '2024-09-01',
        endDate: '2024-09-06',
        purpose: 'Business',
        hotel: 'The Langham Chicago',
        restaurantsVisited: ['6']
    },
    {
        id: 'trip4',
        city: 'Los Angeles',
        state: 'CA',
        country: 'USA',
        coordinates: { latitude: 34.0522, longitude: -118.2437 },
        startDate: '2024-08-15',
        endDate: '2024-08-20',
        purpose: 'Business',
        hotel: 'The Beverly Hills Hotel',
        restaurantsVisited: ['10']
    },
    {
        id: 'trip5',
        city: 'Miami',
        state: 'FL',
        country: 'USA',
        coordinates: { latitude: 25.7617, longitude: -80.1918 },
        startDate: '2025-01-08',
        endDate: '2025-01-12',
        purpose: 'Business',
        hotel: 'Fontainebleau Miami Beach',
        restaurantsVisited: ['4']
    }
];

// Mock Upcoming Trips Data
const MOCK_UPCOMING_TRIPS = [
    {
        id: 'upcoming1',
        city: 'Seattle',
        state: 'WA',
        country: 'USA',
        coordinates: { latitude: 47.6062, longitude: -122.3321 },
        startDate: '2026-03-15',
        endDate: '2026-03-19',
        purpose: 'Business',
        hotel: 'Four Seasons Hotel Seattle',
        confirmedReservations: []
    },
    {
        id: 'upcoming2',
        city: 'Austin',
        state: 'TX',
        country: 'USA',
        coordinates: { latitude: 30.2672, longitude: -97.7431 },
        startDate: '2026-04-10',
        endDate: '2026-04-14',
        purpose: 'Conference',
        hotel: 'The Driskill',
        confirmedReservations: []
    },
    {
        id: 'upcoming3',
        city: 'Boston',
        state: 'MA',
        country: 'USA',
        coordinates: { latitude: 42.3601, longitude: -71.0589 },
        startDate: '2026-05-05',
        endDate: '2026-05-09',
        purpose: 'Business',
        hotel: 'The Liberty Hotel',
        confirmedReservations: []
    }
];

// User account state
const USER_ACCOUNT = {
    concurConnected: false,
    tripitConnected: false,
    lastSync: null
};

