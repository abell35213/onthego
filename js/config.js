// Configuration and Constants
const CONFIG = {
    // Default map center (San Francisco)
    DEFAULT_LAT: 37.7749,
    DEFAULT_LNG: -122.4194,
    DEFAULT_ZOOM: 13,
    
    // Yelp API settings (proxy endpoint, assumes same-origin hosting)
    YELP_API_URL: '/api/yelp-search',
    
    // Search parameters
    SEARCH_RADIUS: 8047, // 5 miles in meters
    SEARCH_LIMIT: 20,
    
    // Mock API settings
    MOCK_API_DELAY: 500, // Delay in milliseconds for mock data
    
    // Map marker icon
    MARKER_ICON_URL: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    
    // World map settings
    WORLD_MAP_ZOOM: 2,
    WORLD_MAP_MIN_ZOOM: 1,
    WORLD_MAP_MAX_ZOOM: 18,
    
    // View modes
    VIEW_MODE_WORLD: 'world',
    VIEW_MODE_LOCAL: 'local',
    VIEW_MODE_TRAVEL_LOG: 'travellog',
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
        visitDate: '2024-11-15',
        instagram_photos: [
            {
                url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=200&h=200&fit=crop',
                username: 'foodie_sam',
                timestamp: '2 days ago'
            },
            {
                url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&h=200&fit=crop',
                username: 'sf_eats',
                timestamp: '1 week ago'
            },
            {
                url: 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=200&h=200&fit=crop',
                username: 'dining_vibes',
                timestamp: '2 weeks ago'
            }
        ]
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
        visitDate: '2024-10-22',
        instagram_photos: [
            {
                url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200&h=200&fit=crop',
                username: 'sushi_lover',
                timestamp: '3 days ago'
            },
            {
                url: 'https://images.unsplash.com/photo-1563612116625-3012372fccce?w=200&h=200&fit=crop',
                username: 'bay_area_food',
                timestamp: '5 days ago'
            }
        ]
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
        visited: false,
        instagram_photos: [
            {
                url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=200&h=200&fit=crop',
                username: 'burger_fan',
                timestamp: '1 day ago'
            },
            {
                url: 'https://images.unsplash.com/photo-1521305916504-4a1121188589?w=200&h=200&fit=crop',
                username: 'foodie_life',
                timestamp: '4 days ago'
            },
            {
                url: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=200&h=200&fit=crop',
                username: 'sf_dining',
                timestamp: '1 week ago'
            }
        ]
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
        visitDate: '2025-01-10',
        instagram_photos: [
            {
                url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&h=200&fit=crop',
                username: 'taco_tuesday',
                timestamp: '2 hours ago'
            },
            {
                url: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=200&h=200&fit=crop',
                username: 'mexican_food_fan',
                timestamp: '1 day ago'
            }
        ]
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
        visited: false,
        instagram_photos: [
            {
                url: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=200&h=200&fit=crop',
                username: 'thai_food_lover',
                timestamp: '3 days ago'
            },
            {
                url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=200&fit=crop',
                username: 'spicy_eats',
                timestamp: '1 week ago'
            }
        ]
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
        visitDate: '2024-09-05',
        instagram_photos: [
            {
                url: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=200&h=200&fit=crop',
                username: 'pasta_perfection',
                timestamp: '6 hours ago'
            },
            {
                url: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=200&h=200&fit=crop',
                username: 'italian_cuisine',
                timestamp: '2 days ago'
            },
            {
                url: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=200&h=200&fit=crop',
                username: 'fine_dining_sf',
                timestamp: '5 days ago'
            }
        ]
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
        visitDate: '2024-12-03',
        instagram_photos: [
            {
                url: 'https://images.unsplash.com/photo-1558030006-450675393462?w=200&h=200&fit=crop',
                username: 'steak_lover',
                timestamp: '5 hours ago'
            },
            {
                url: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=200&h=200&fit=crop',
                username: 'business_dining',
                timestamp: '1 day ago'
            },
            {
                url: 'https://images.unsplash.com/photo-1544148103-0773bf10d330?w=200&h=200&fit=crop',
                username: 'upscale_eats',
                timestamp: '3 days ago'
            }
        ]
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
        visited: false,
        instagram_photos: [
            {
                url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=200&h=200&fit=crop',
                username: 'pho_fanatic',
                timestamp: '8 hours ago'
            },
            {
                url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop',
                username: 'vietnamese_eats',
                timestamp: '2 days ago'
            }
        ]
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
        visited: false,
        instagram_photos: [
            {
                url: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=200&h=200&fit=crop',
                username: 'mediterranean_vibes',
                timestamp: '12 hours ago'
            },
            {
                url: 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=200&h=200&fit=crop',
                username: 'greek_foodie',
                timestamp: '4 days ago'
            },
            {
                url: 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=200&h=200&fit=crop',
                username: 'healthy_eats_sf',
                timestamp: '1 week ago'
            }
        ]
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
        visitDate: '2024-08-18',
        instagram_photos: [
            {
                url: 'https://images.unsplash.com/photo-1496412705862-e0088f16f791?w=200&h=200&fit=crop',
                username: 'dimsum_daily',
                timestamp: '4 hours ago'
            },
            {
                url: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=200&h=200&fit=crop',
                username: 'chinese_food_love',
                timestamp: '1 day ago'
            },
            {
                url: 'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=200&h=200&fit=crop',
                username: 'sf_brunch',
                timestamp: '6 days ago'
            }
        ]
    },
    {
        id: '11',
        name: 'Anchor Brewing Taproom',
        image_url: 'https://images.unsplash.com/photo-1559526324-593bc073d938?w=300&h=300&fit=crop',
        categories: [{ title: 'Brewery' }, { title: 'Craft Beer' }],
        rating: 4.4,
        review_count: 312,
        price: '$$',
        location: {
            address1: '1705 Mariposa Street',
            city: 'San Francisco',
            state: 'CA',
            zip_code: '94107'
        },
        coordinates: {
            latitude: 37.7639,
            longitude: -122.3964
        },
        display_phone: '(415) 555-0811',
        distance: 1350,
        url: 'https://www.yelp.com',
        tags: ['Chill', 'Craft Beer'],
        visited: false,
        instagram_photos: [
            {
                url: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=200&h=200&fit=crop',
                username: 'craftbeer_sf',
                timestamp: '5 hours ago'
            }
        ]
    },
    {
        id: '12',
        name: 'The Bourbon Lounge',
        image_url: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=300&h=300&fit=crop',
        categories: [{ title: 'Bar' }, { title: 'Cocktail Bar' }],
        rating: 4.3,
        review_count: 278,
        price: '$$$',
        location: {
            address1: '501 Jones Street',
            city: 'San Francisco',
            state: 'CA',
            zip_code: '94102'
        },
        coordinates: {
            latitude: 37.7859,
            longitude: -122.4124
        },
        display_phone: '(415) 555-0812',
        distance: 620,
        url: 'https://www.yelp.com',
        tags: ['Nightlife', 'Chill'],
        visited: true,
        visitDate: '2024-11-14',
        instagram_photos: [
            {
                url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=200&h=200&fit=crop',
                username: 'cocktail_culture',
                timestamp: '2 hours ago'
            },
            {
                url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=200&h=200&fit=crop',
                username: 'sf_nightlife',
                timestamp: '1 day ago'
            }
        ]
    },
    {
        id: '13',
        name: 'Temple Nightclub',
        image_url: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=300&h=300&fit=crop',
        categories: [{ title: 'Club' }, { title: 'Dance Club' }],
        rating: 4.0,
        review_count: 445,
        price: '$$$',
        location: {
            address1: '540 Howard Street',
            city: 'San Francisco',
            state: 'CA',
            zip_code: '94105'
        },
        coordinates: {
            latitude: 37.7879,
            longitude: -122.3964
        },
        display_phone: '(415) 555-0813',
        distance: 890,
        url: 'https://www.yelp.com',
        tags: ['Nightlife', 'Fun'],
        visited: false,
        instagram_photos: [
            {
                url: 'https://images.unsplash.com/photo-1571266028253-6f88503e7e87?w=200&h=200&fit=crop',
                username: 'sf_clubbing',
                timestamp: '8 hours ago'
            }
        ]
    },
    {
        id: '14',
        name: 'Cellarmaker Brewing',
        image_url: 'https://images.unsplash.com/photo-1532634993-15f421e42ec0?w=300&h=300&fit=crop',
        categories: [{ title: 'Brewery' }, { title: 'Gastropub' }],
        rating: 4.6,
        review_count: 287,
        price: '$$',
        location: {
            address1: '1150 Howard Street',
            city: 'San Francisco',
            state: 'CA',
            zip_code: '94103'
        },
        coordinates: {
            latitude: 37.7769,
            longitude: -122.4114
        },
        display_phone: '(415) 555-0814',
        distance: 410,
        url: 'https://www.yelp.com',
        tags: ['Craft Beer', 'Local Spots'],
        visited: true,
        visitDate: '2025-01-20',
        instagram_photos: [
            {
                url: 'https://images.unsplash.com/photo-1558642452-9d2a7deb7f62?w=200&h=200&fit=crop',
                username: 'hophead_sf',
                timestamp: '3 hours ago'
            },
            {
                url: 'https://images.unsplash.com/photo-1575037614876-c38a4c44f5b8?w=200&h=200&fit=crop',
                username: 'beer_explorer',
                timestamp: '2 days ago'
            }
        ]
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
        coordinates: { latitude: 37.7856, longitude: -122.4023 },
        startDate: '2024-11-12',
        endDate: '2024-11-16',
        purpose: 'Business',
        hotel: 'The St. Regis San Francisco',
        restaurantsVisited: ['1', '7'],
        diningExpenses: [
            { restaurantId: '1', amount: 85.50, date: '2024-11-13' },
            { restaurantId: '7', amount: 215.00, date: '2024-11-14' }
        ]
    },
    {
        id: 'trip2',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        coordinates: { latitude: 40.7645, longitude: -73.9744 },
        startDate: '2024-10-20',
        endDate: '2024-10-24',
        purpose: 'Business',
        hotel: 'The Plaza Hotel',
        restaurantsVisited: ['2'],
        diningExpenses: [
            { restaurantId: '2', amount: 142.75, date: '2024-10-21' }
        ]
    },
    {
        id: 'trip3',
        city: 'Chicago',
        state: 'IL',
        country: 'USA',
        coordinates: { latitude: 41.8887, longitude: -87.6354 },
        startDate: '2024-09-01',
        endDate: '2024-09-06',
        purpose: 'Business',
        hotel: 'The Langham Chicago',
        restaurantsVisited: ['6'],
        diningExpenses: [
            { restaurantId: '6', amount: 178.25, date: '2024-09-03' }
        ]
    },
    {
        id: 'trip4',
        city: 'Los Angeles',
        state: 'CA',
        country: 'USA',
        coordinates: { latitude: 34.0816, longitude: -118.4130 },
        startDate: '2024-08-15',
        endDate: '2024-08-20',
        purpose: 'Business',
        hotel: 'The Beverly Hills Hotel',
        restaurantsVisited: ['10'],
        diningExpenses: [
            { restaurantId: '10', amount: 67.30, date: '2024-08-17' }
        ]
    },
    {
        id: 'trip5',
        city: 'Miami',
        state: 'FL',
        country: 'USA',
        coordinates: { latitude: 25.8139, longitude: -80.1229 },
        startDate: '2025-01-08',
        endDate: '2025-01-12',
        purpose: 'Business',
        hotel: 'Fontainebleau Miami Beach',
        restaurantsVisited: ['4'],
        diningExpenses: [
            { restaurantId: '4', amount: 93.60, date: '2025-01-09' }
        ]
    }
];

// Mock Upcoming Trips Data
const MOCK_UPCOMING_TRIPS = [
    {
        id: 'upcoming1',
        city: 'Seattle',
        state: 'WA',
        country: 'USA',
        coordinates: { latitude: 47.6076, longitude: -122.3385 },
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
        coordinates: { latitude: 30.2672, longitude: -97.7394 },
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
        coordinates: { latitude: 42.3625, longitude: -71.0661 },
        startDate: '2026-05-05',
        endDate: '2026-05-09',
        purpose: 'Business',
        hotel: 'The Liberty Hotel',
        confirmedReservations: []
    }
];

// User account state
const USER_ACCOUNT = {
    name: '',
    email: '',
    phone: '',
    concurConnected: false,
    tripitConnected: false,
    marriottConnected: false,
    hiltonConnected: false,
    lastSync: null
};
