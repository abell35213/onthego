const test = require('node:test');
const assert = require('node:assert/strict');

const accountModulePath = require.resolve('../js/account.js');

test('Account.syncTripItTrips revokes the server TripIt session when authorization expires', async () => {
    const fetchCalls = [];

    global.window = {
        location: { origin: 'http://localhost' }
    };
    global.document = {
        getElementById: () => null,
        body: {
            appendChild: () => {},
            removeChild: () => {}
        }
    };

    global.CONFIG = {
        TRIPIT_DISCONNECT_URL: '/api/tripit/disconnect'
    };
    global.USER_ACCOUNT = {
        userRef: 'user-123',
        tripitConnected: true,
        concurConnected: false,
        marriottConnected: false,
        hiltonConnected: false,
        lastSync: null
    };
    global.TripItService = {
        fetchTrips: async () => {
            const error = new Error('Authorization expired');
            error.code = 'tripit_authorization_expired';
            throw error;
        }
    };
    global.MOCK_UPCOMING_TRIPS = [];
    global.fetch = async (url, options) => {
        fetchCalls.push({ url, options });
        return { ok: true };
    };

    delete require.cache[accountModulePath];
    require(accountModulePath);

    const result = await global.window.Account.syncTripItTrips();

    assert.equal(result, false);
    assert.equal(global.USER_ACCOUNT.tripitConnected, false);
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, '/api/tripit/disconnect');
    assert.equal(fetchCalls[0].options.method, 'POST');
});

test('Account.syncTripItTrips preserves unchanged upcoming trips when TripIt returns incremental updates', async () => {
    const syncInfoEl = { style: { display: '' } };
    const lastSyncTimeEl = { textContent: '' };
    global.window = {
        location: { origin: 'http://localhost' }
    };
    global.document = {
        getElementById: (id) => {
            if (id === 'syncInfo') {
                return syncInfoEl;
            }
            if (id === 'lastSyncTime') {
                return lastSyncTimeEl;
            }
            return null;
        },
        body: {
            appendChild: () => {},
            removeChild: () => {}
        }
    };

    global.CONFIG = {
        DEFAULT_LAT: 37.7749,
        DEFAULT_LNG: -122.4194
    };
    global.USER_ACCOUNT = {
        userRef: 'user-123',
        tripitConnected: true,
        concurConnected: false,
        marriottConnected: false,
        hiltonConnected: false,
        lastSync: null
    };
    global.TripItService = {
        fetchTrips: async () => ({
            trips: [
                {
                    id: 'trip-2',
                    name: 'Updated Trip Name',
                    startDate: '2026-05-02',
                    endDate: '2026-05-03',
                    primaryLocation: { city: 'Chicago', state: 'IL', country: 'USA' },
                    lodging: { name: 'Chicago Hotel', city: 'Chicago', state: 'IL', country: 'USA' }
                },
                {
                    id: 'trip-3',
                    name: 'Brand New Trip',
                    startDate: '2026-06-01',
                    endDate: '2026-06-02',
                    primaryLocation: { city: 'Boston', state: 'MA', country: 'USA' },
                    lodging: { name: 'Boston Hotel', city: 'Boston', state: 'MA', country: 'USA' }
                }
            ],
            isEmpty: false
        })
    };
    global.MOCK_UPCOMING_TRIPS = [
        { id: 'tripit_trip-1', name: 'Unchanged Existing Trip', source: 'tripit' },
        { id: 'tripit_trip-2', name: 'Old Trip Name', source: 'tripit' }
    ];
    global.fetch = async () => ({ ok: true });

    delete require.cache[accountModulePath];
    require(accountModulePath);

    const geocodeQueries = [];
    global.window.Account.geocodeCity = async (query) => {
        geocodeQueries.push(query);
        return { latitude: 41.8781, longitude: -87.6298 };
    };

    const result = await global.window.Account.syncTripItTrips();

    assert.equal(result, true);
    assert.deepEqual(global.MOCK_UPCOMING_TRIPS.map((trip) => trip.id), [
        'tripit_trip-1',
        'tripit_trip-2',
        'tripit_trip-3'
    ]);
    assert.equal(global.MOCK_UPCOMING_TRIPS[0].name, 'Unchanged Existing Trip');
    assert.equal(global.MOCK_UPCOMING_TRIPS[1].name, 'Updated Trip Name');
    assert.equal(global.MOCK_UPCOMING_TRIPS[2].name, 'Brand New Trip');
    assert.equal(geocodeQueries.length, 2);
});
