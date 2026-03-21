// TripIt Service Module - Fetches and normalizes TripIt trips for the app.
(function(globalScope) {
    const toArray = (value) => {
        if (Array.isArray(value)) {
            return value;
        }
        if (value === null || value === undefined) {
            return [];
        }
        return [value];
    };

    const firstNonEmptyString = (...values) => {
        for (const value of values) {
            if (typeof value === 'string' && value.trim()) {
                return value.trim();
            }
        }
        return '';
    };

    const normalizeAddress = (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }

        const line1 = firstNonEmptyString(value.address, value.address1, value.street, value.street1, value.line1);
        const line2 = firstNonEmptyString(value.address2, value.street2, value.line2);
        const city = firstNonEmptyString(value.city, value.city_name, value.locality);
        const state = firstNonEmptyString(value.state, value.state_code, value.region, value.province);
        const country = firstNonEmptyString(value.country, value.country_code, value.country_name);
        const postalCode = firstNonEmptyString(value.zip, value.zip_code, value.postal_code);

        const hasData = line1 || line2 || city || state || country || postalCode;
        if (!hasData) {
            return null;
        }

        return {
            line1,
            line2,
            city,
            state,
            country,
            postalCode,
            full: [line1, line2, city, state, postalCode, country].filter(Boolean).join(', ')
        };
    };

    const normalizeLodging = (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }

        const address = normalizeAddress(
            value.Address || value.address || value.Location || value.location || value.PrimaryLocationAddress || value.primary_location_address
        );

        const lodging = {
            name: firstNonEmptyString(value.display_name, value.hotel_name, value.name, value.supplier_name),
            address,
            city: firstNonEmptyString(value.city, address?.city),
            state: firstNonEmptyString(value.state, value.state_code, address?.state),
            country: firstNonEmptyString(value.country, value.country_code, address?.country),
            phone: firstNonEmptyString(value.phone, value.phone_number),
            confirmationNumber: firstNonEmptyString(value.confirmation_num, value.confirmation_number)
        };

        if (!lodging.name && !lodging.address && !lodging.city && !lodging.state && !lodging.country) {
            return null;
        }

        return lodging;
    };

    const pickLodgingObject = (trip) => {
        const candidates = [
            ...toArray(trip.LodgingObject),
            ...toArray(trip.lodging_object),
            ...toArray(trip.Lodging),
            ...toArray(trip.lodging)
        ];

        for (const candidate of candidates) {
            const lodging = normalizeLodging(candidate);
            if (lodging) {
                return lodging;
            }
        }

        return null;
    };

    const normalizePrimaryLocation = (trip, lodging) => {
        const address = normalizeAddress(
            trip.PrimaryLocationAddress || trip.primary_location_address || trip.Location || trip.location
        ) || lodging?.address || null;

        const city = firstNonEmptyString(
            trip.primary_location_city,
            trip.primary_location,
            address?.city,
            lodging?.city,
            trip.destination_city
        );
        const state = firstNonEmptyString(
            trip.primary_location_state,
            address?.state,
            lodging?.state,
            trip.destination_state
        );
        const country = firstNonEmptyString(
            trip.primary_location_country,
            address?.country,
            lodging?.country,
            trip.destination_country
        );

        const label = firstNonEmptyString(
            trip.primary_location,
            trip.primary_location_name,
            [city, state].filter(Boolean).join(', '),
            [city, country].filter(Boolean).join(', '),
            address?.full,
            lodging?.name
        );

        if (!label && !city && !state && !country && !address) {
            return null;
        }

        return {
            label,
            city,
            state,
            country,
            address
        };
    };

    const normalizeTrip = (trip, index = 0) => {
        const lodging = pickLodgingObject(trip);
        const primaryLocation = normalizePrimaryLocation(trip, lodging);
        const startDate = firstNonEmptyString(trip.start_date, trip.startDate);
        const endDate = firstNonEmptyString(trip.end_date, trip.endDate, startDate);
        const name = firstNonEmptyString(
            trip.display_name,
            trip.primary_location,
            trip.trip_name,
            lodging?.name,
            primaryLocation?.label,
            `Trip ${index + 1}`
        );

        return {
            id: String(firstNonEmptyString(trip.id, trip.trip_id, `${Date.now()}_${index}`)),
            name,
            startDate,
            endDate,
            primaryLocation,
            lodging,
            source: trip
        };
    };

    const isUpcomingTrip = (trip) => {
        const comparisonDate = trip.endDate || trip.startDate;
        const date = new Date(comparisonDate);
        if (Number.isNaN(date.getTime())) {
            return true;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);
        return date >= today;
    };

    const extractTrips = (payload) => {
        if (!payload || typeof payload !== 'object') {
            return [];
        }

        if (Array.isArray(payload)) {
            return payload;
        }

        const directTripKeys = [payload.Trip, payload.trip, payload.trips];
        for (const candidate of directTripKeys) {
            const list = toArray(candidate).filter(Boolean);
            if (list.length > 0) {
                return list;
            }
        }

        for (const value of Object.values(payload)) {
            if (!value || typeof value !== 'object') {
                continue;
            }
            const nestedTrip = value.Trip || value.trip || value.trips;
            const list = toArray(nestedTrip).filter(Boolean);
            if (list.length > 0) {
                return list;
            }
        }

        return [];
    };

    const TripItService = {
        normalizeResponse(payload) {
            const trips = extractTrips(payload)
                .map((trip, index) => normalizeTrip(trip, index))
                .filter(trip => trip.startDate)
                .filter(isUpcomingTrip);

            return {
                trips,
                isEmpty: trips.length === 0
            };
        },

        async fetchTrips() {
            const response = await fetch(CONFIG.TRIPIT_TRIPS_URL, {
                credentials: 'same-origin',
                headers: {
                    'x-onthego-user-ref': USER_ACCOUNT.userRef
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `TripIt trips request failed: ${response.status}`);
            }

            const payload = await response.json();
            return this.normalizeResponse(payload);
        }
    };

    globalScope.TripItService = TripItService;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { TripItService };
    }
})(typeof window !== 'undefined' ? window : globalThis);
