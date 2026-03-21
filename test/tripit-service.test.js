const test = require('node:test');
const assert = require('node:assert/strict');
const { TripItService } = require('../js/tripit');

test('TripItService.normalizeResponse normalizes nested Trip and lodging objects', () => {
    const payload = {
        Trip: {
            id: '12345',
            display_name: 'Q2 Sales Kickoff',
            start_date: '2026-04-10',
            end_date: '2026-04-14',
            PrimaryLocationAddress: {
                city: 'Austin',
                state: 'TX',
                country: 'USA'
            },
            LodgingObject: {
                hotel_name: 'The Driskill',
                Address: {
                    address1: '604 Brazos St',
                    city: 'Austin',
                    state: 'TX',
                    zip: '78701',
                    country: 'USA'
                }
            }
        }
    };

    const result = TripItService.normalizeResponse(payload);

    assert.equal(result.isEmpty, false);
    assert.equal(result.trips.length, 1);
    assert.deepEqual(result.trips[0], {
        id: '12345',
        name: 'Q2 Sales Kickoff',
        startDate: '2026-04-10',
        endDate: '2026-04-14',
        primaryLocation: {
            label: 'Austin, TX',
            city: 'Austin',
            state: 'TX',
            country: 'USA',
            address: {
                line1: '',
                line2: '',
                city: 'Austin',
                state: 'TX',
                country: 'USA',
                postalCode: '',
                full: 'Austin, TX, USA'
            }
        },
        lodging: {
            name: 'The Driskill',
            address: {
                line1: '604 Brazos St',
                line2: '',
                city: 'Austin',
                state: 'TX',
                country: 'USA',
                postalCode: '78701',
                full: '604 Brazos St, Austin, TX, 78701, USA'
            },
            city: 'Austin',
            state: 'TX',
            country: 'USA',
            phone: '',
            confirmationNumber: ''
        },
        source: payload.Trip
    });
});

test('TripItService.normalizeResponse returns empty metadata when no trips exist', () => {
    const payload = { Trip: [] };

    const result = TripItService.normalizeResponse(payload);

    assert.deepEqual(result, {
        trips: [],
        isEmpty: true
    });
});
