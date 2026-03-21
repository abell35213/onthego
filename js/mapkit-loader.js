// Shared Apple MapKit JS loader singleton
const MapKitLoader = {
    /** @type {Promise<boolean>|null} */
    _mapkitInitPromise: null,
    _requestedLibraries: new Set(),
    _initializedLibraries: new Set(),
    _isInitialized: false,

    _normalizeLibraries(libraries) {
        if (!Array.isArray(libraries)) return [];
        return libraries
            .filter((library) => typeof library === 'string')
            .map((library) => library.trim())
            .filter(Boolean);
    },

    /**
     * Initialize Apple MapKit JS (idempotent).
     * Merges requested libraries and performs a single mapkit.init() call.
     * @param {string[]} requestedLibraries
     * @returns {Promise<boolean>} true when MapKit JS is ready to use
     */
    async init(requestedLibraries = []) {
        for (const library of this._normalizeLibraries(requestedLibraries)) {
            this._requestedLibraries.add(library);
        }

        if (this._mapkitInitPromise) return this._mapkitInitPromise;

        this._mapkitInitPromise = (async () => {
            try {
                if (typeof mapkit === 'undefined') return false;

                const response = await fetch(CONFIG.MAPKIT_TOKEN_URL);
                if (!response.ok) throw new Error(`Token endpoint returned ${response.status}`);
                const { token } = await response.json();
                if (!token) throw new Error('No token in server response');

                const mergedLibraries = Array.from(this._requestedLibraries);
                mapkit.init({
                    authorizationCallback: (done) => done(token),
                    language: 'en',
                    libraries: mergedLibraries
                });

                this._initializedLibraries = new Set(mergedLibraries);
                this._isInitialized = true;
                return true;
            } catch (error) {
                console.warn('MapKit JS initialization failed:', error.message);
                this._mapkitInitPromise = null; // allow retry on next call
                this._isInitialized = false;
                this._initializedLibraries.clear();
                return false;
            }
        })();

        return this._mapkitInitPromise;
    },

    isReady() {
        return this._isInitialized;
    },

    hasLibraries(libraries) {
        if (!this.isReady()) return false;
        return this.getMissingLibraries(libraries).length === 0;
    },

    getMissingLibraries(libraries) {
        const normalized = this._normalizeLibraries(libraries);
        return normalized.filter((library) => !this._initializedLibraries.has(library));
    }
};
