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
