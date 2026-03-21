// Account Module - Handles user profile, Concur/TripIt account connections, and settings
const Account = {
    tripitAuthHandled: false,

    /**
     * Initialize account modal and event listeners
     */
    init() {
        this.setupEventListeners();
        this.setupTabs();
        this.setupProfileForm();
        this.setupSettings();
        this.setupTripItMessageListener();
        void this.updateConnectionStatus();
        this.loadProfile();
        this.loadSettings();
    },

    /**
     * Setup event listeners for account modal
     */
    setupEventListeners() {
        const modal = document.getElementById('accountModal');
        const accountBtn = document.getElementById('accountBtn');
        const closeBtn = modal.querySelector('.close');

        // Open modal
        accountBtn.addEventListener('click', () => {
            modal.style.display = 'block';
        });

        // Close modal
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        // Close modal when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Concur connection
        const concurConnectBtn = document.getElementById('concurConnect');
        concurConnectBtn.addEventListener('click', () => {
            this.connectAccount('concur');
        });

        // TripIt connection
        const tripitConnectBtn = document.getElementById('tripitConnect');
        tripitConnectBtn.addEventListener('click', () => {
            this.connectAccount('tripit');
        });

        // Marriott Bonvoy connection
        const marriottConnectBtn = document.getElementById('marriottConnect');
        if (marriottConnectBtn) {
            marriottConnectBtn.addEventListener('click', () => {
                this.connectAccount('marriott');
            });
        }

        // Hilton Honors connection
        const hiltonConnectBtn = document.getElementById('hiltonConnect');
        if (hiltonConnectBtn) {
            hiltonConnectBtn.addEventListener('click', () => {
                this.connectAccount('hilton');
            });
        }

        // Disconnect buttons (delegated event)
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('disconnect-btn')) {
                const accountCard = e.target.closest('.account-card');
                const accountType = accountCard.getAttribute('data-account-type');
                this.disconnectAccount(accountType);
            }
        });
    },

    /**
     * Listen for OAuth completion messages from the TripIt popup callback page.
     */
    setupTripItMessageListener() {
        window.addEventListener('message', (event) => {
            if (event.origin !== window.location.origin) {
                return;
            }

            if (event.data?.type !== 'tripit_oauth_complete') {
                return;
            }

            const connectBtn = document.getElementById('tripitConnect');
            const statusDiv = document.getElementById('tripitStatus');
            void this.finalizeTripItConnection(connectBtn, statusDiv, event.data.errorCode || null);
        });
    },

    /**
     * Setup tab navigation
     */
    setupTabs() {
        const tabs = document.querySelectorAll('.account-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active from all tabs and contents
                tabs.forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => {
                    c.style.display = 'none';
                    c.classList.remove('active');
                });

                // Activate clicked tab
                tab.classList.add('active');
                const tabId = tab.getAttribute('data-tab') + 'Tab';
                const tabContent = document.getElementById(tabId);
                if (tabContent) {
                    tabContent.style.display = 'block';
                    tabContent.classList.add('active');
                }
            });
        });
    },

    /**
     * Setup profile form submission
     */
    setupProfileForm() {
        const form = document.getElementById('accountForm');
        if (!form) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProfile();
        });
    },

    /**
     * Save user profile to localStorage
     */
    saveProfile() {
        const name = document.getElementById('userName').value.trim();
        const email = document.getElementById('userEmail').value.trim();
        const phone = document.getElementById('userPhone').value.trim();

        if (!name || !email || !phone) {
            this.showNotification('Please fill in all required fields.');
            return;
        }

        const profile = { name, email, phone };
        localStorage.setItem('onthego_profile', JSON.stringify(profile));

        // Update global state
        USER_ACCOUNT.name = name;
        USER_ACCOUNT.email = email;
        USER_ACCOUNT.phone = phone;

        // Show success message
        const msg = document.getElementById('profileSavedMsg');
        if (msg) {
            msg.style.display = 'flex';
            setTimeout(() => { msg.style.display = 'none'; }, 3000);
        }

        this.showNotification('Profile saved successfully!');
    },

    /**
     * Load user profile from localStorage
     */
    loadProfile() {
        const saved = localStorage.getItem('onthego_profile');
        if (saved) {
            try {
                const profile = JSON.parse(saved);
                const nameInput = document.getElementById('userName');
                const emailInput = document.getElementById('userEmail');
                const phoneInput = document.getElementById('userPhone');

                if (nameInput) nameInput.value = profile.name || '';
                if (emailInput) emailInput.value = profile.email || '';
                if (phoneInput) phoneInput.value = profile.phone || '';

                USER_ACCOUNT.name = profile.name;
                USER_ACCOUNT.email = profile.email;
                USER_ACCOUNT.phone = profile.phone;
            } catch (e) {
                console.error('Error loading profile:', e);
            }
        }
    },

    /**
     * Setup settings save handler
     */
    setupSettings() {
        const saveBtn = document.getElementById('saveSettingsBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveSettings();
            });
        }
    },

    /**
     * Save settings to localStorage
     */
    async saveSettings() {
        const homeCityInput = document.getElementById('settingHomeCity')?.value.trim() || '';

        const settings = {
            textAlerts: document.getElementById('settingTextAlerts')?.checked || false,
            emailAlerts: document.getElementById('settingEmailAlerts')?.checked || false,
            dealAlerts: document.getElementById('settingDealAlerts')?.checked || false,
            searchRadius: document.getElementById('settingRadius')?.value || '5000',
            defaultCuisine: document.getElementById('settingCuisine')?.value || '',
            defaultPrice: document.getElementById('settingPrice')?.value || '',
            accessibility: document.getElementById('settingAccessibility')?.checked || false,
            homeCity: homeCityInput
        };

        // Geocode the home city and store coordinates so the world map can use them
        if (homeCityInput) {
            const coords = await this.geocodeCity(homeCityInput);
            if (coords) {
                settings.homeCityCoords = coords;
            } else {
                // Geocoding failed — preserve any previously saved coordinates so the
                // map keeps working, but warn the user
                const prevSaved = localStorage.getItem('onthego_settings');
                if (prevSaved) {
                    try {
                        const prev = JSON.parse(prevSaved);
                        if (prev.homeCityCoords) settings.homeCityCoords = prev.homeCityCoords;
                    } catch (_) { /* ignore */ }
                }
                this.showNotification('Could not find coordinates for that city. Please check the spelling and try again.');
                return;
            }
        }

        localStorage.setItem('onthego_settings', JSON.stringify(settings));

        // Show success message
        const msg = document.getElementById('settingsSavedMsg');
        if (msg) {
            msg.style.display = 'flex';
            setTimeout(() => { msg.style.display = 'none'; }, 3000);
        }

        this.showNotification('Settings saved successfully!');

        // Refresh world map flight paths if it has been initialized
        if (typeof WorldMap !== 'undefined') {
            WorldMap.refresh();
        }
    },

    /**
     * Geocode a city string to lat/lng coordinates using the Nominatim API.
     * @param {string} cityString - City name, e.g. "Atlanta, GA"
     * @returns {Promise<{latitude: number, longitude: number}|null>}
     */
    async geocodeCity(cityString) {
        try {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityString)}&format=json&limit=1`;
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'OnTheGo-App'
                }
            });
            if (!response.ok) throw new Error(`Geocode error: ${response.status}`);
            const data = await response.json();
            if (data && data.length > 0) {
                return {
                    latitude: parseFloat(data[0].lat),
                    longitude: parseFloat(data[0].lon)
                };
            }
        } catch (e) {
            console.error('Geocoding failed:', e);
        }
        return null;
    },

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        const saved = localStorage.getItem('onthego_settings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                const textAlerts = document.getElementById('settingTextAlerts');
                const emailAlerts = document.getElementById('settingEmailAlerts');
                const dealAlerts = document.getElementById('settingDealAlerts');
                const radius = document.getElementById('settingRadius');
                const cuisine = document.getElementById('settingCuisine');
                const price = document.getElementById('settingPrice');
                const accessibility = document.getElementById('settingAccessibility');
                const homeCity = document.getElementById('settingHomeCity');

                if (textAlerts) textAlerts.checked = settings.textAlerts !== false;
                if (emailAlerts) emailAlerts.checked = settings.emailAlerts !== false;
                if (dealAlerts) dealAlerts.checked = settings.dealAlerts || false;
                if (radius) radius.value = settings.searchRadius || '5000';
                if (cuisine) cuisine.value = settings.defaultCuisine || '';
                if (price) price.value = settings.defaultPrice || '';
                if (accessibility) accessibility.checked = settings.accessibility || false;
                if (homeCity) homeCity.value = settings.homeCity || '';
            } catch (e) {
                console.error('Error loading settings:', e);
            }
        }
    },

    /**
     * Connect to an account
     * @param {string} accountType - 'concur', 'tripit', 'marriott', or 'hilton'
     */
    connectAccount(accountType) {
        if (accountType === 'tripit') {
            this.connectTripIt();
            return;
        }

        // Simulate API call delay for other account types
        const connectBtn = document.getElementById(`${accountType}Connect`);
        const statusDiv = document.getElementById(`${accountType}Status`);
        
        connectBtn.disabled = true;
        connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';

        setTimeout(() => {
            // Update user account state
            if (accountType === 'concur') {
                USER_ACCOUNT.concurConnected = true;
            } else if (accountType === 'marriott') {
                USER_ACCOUNT.marriottConnected = true;
            } else if (accountType === 'hilton') {
                USER_ACCOUNT.hiltonConnected = true;
            }
            USER_ACCOUNT.lastSync = new Date().toISOString();

            // Update UI
            connectBtn.style.display = 'none';
            statusDiv.style.display = 'flex';
            this.updateSyncInfo();

            const displayNames = {
                concur: 'Concur',
                marriott: 'Marriott Bonvoy',
                hilton: 'Hilton Honors'
            };

            console.log(`${accountType} connected successfully`);
            
            // Show success message
            this.showNotification(`${displayNames[accountType] || accountType} connected successfully!`);
        }, 1500);
    },

    /**
     * Initiate TripIt OAuth 1.0 connection flow.
     * Requests a TripIt authorization URL from the server, then opens it
     * so the user can authorize this application. After authorization,
     * TripIt redirects back to our callback page which exchanges tokens.
     */
    async connectTripIt() {
        const connectBtn = document.getElementById('tripitConnect');
        const statusDiv = document.getElementById('tripitStatus');
        this.tripitAuthHandled = false;

        connectBtn.disabled = true;
        connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';

        // Build the OAuth callback URL that TripIt will redirect to
        const callbackUrl = `${window.location.origin}${CONFIG.TRIPIT_CALLBACK_URL}`;

        try {
            const response = await fetch(
                `${CONFIG.TRIPIT_CONNECT_URL}?callback=${encodeURIComponent(callbackUrl)}`,
                {
                    headers: {
                        'x-onthego-user-ref': USER_ACCOUNT.userRef
                    }
                }
            );

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `Server error: ${response.status}`);
            }

            const data = await response.json();

            if (!data.authorizeUrl) {
                throw new Error('No authorization URL returned from server');
            }

            // Open TripIt authorization page in a popup
            const width = 600;
            const height = 700;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;
            const popup = window.open(
                data.authorizeUrl,
                'tripit_auth',
                `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
            );

            // Poll for the popup to close or for the callback page to notify us
            const maxPollTime = 5 * 60 * 1000; // 5 minute timeout
            const pollStart = Date.now();
            const pollTimer = setInterval(() => {
                if (!popup || popup.closed || Date.now() - pollStart > maxPollTime) {
                    clearInterval(pollTimer);
                    void this.finalizeTripItConnection(connectBtn, statusDiv);
                }
            }, 500);
        } catch (error) {
            console.error('TripIt connect error:', error);
            connectBtn.disabled = false;
            connectBtn.innerHTML = '<i class="fas fa-plug"></i> <span class="connect-text">Connect TripIt</span>';
            this.showNotification(`Failed to connect TripIt: ${error.message}`);
        }
    },

    /**
     * Finalize TripIt connection after the OAuth popup closes.
     * @param {HTMLElement} connectBtn - The connect button element
     * @param {HTMLElement} statusDiv - The status display element
     * @param {string|null} authError - Optional callback error code
     */
    async finalizeTripItConnection(connectBtn, statusDiv, authError = null) {
        if (this.tripitAuthHandled && USER_ACCOUNT.tripitConnected) {
            return;
        }

        try {
            const response = await fetch(CONFIG.TRIPIT_STATUS_URL, {
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`TripIt status check failed: ${response.status}`);
            }

            const { connected } = await response.json();

            if (connected) {
                this.tripitAuthHandled = true;
                USER_ACCOUNT.tripitConnected = true;
                USER_ACCOUNT.lastSync = new Date().toISOString();

                connectBtn.style.display = 'none';
                statusDiv.style.display = 'flex';
                this.updateSyncInfo();
                this.showNotification('TripIt connected successfully!');
                return;
            }
        } catch (error) {
            console.error('TripIt status check error:', error);
        }

        USER_ACCOUNT.tripitConnected = false;
        this.tripitAuthHandled = true;
        if (connectBtn) {
            connectBtn.disabled = false;
            connectBtn.innerHTML = '<i class="fas fa-plug"></i> <span class="connect-text">Connect TripIt</span>';
            connectBtn.style.display = 'flex';
        }
        if (statusDiv) {
            statusDiv.style.display = 'none';
        }

        if (authError === 'validation_failed') {
            this.showNotification('TripIt authorization failed, please retry.');
        } else if (authError === 'config_error' || authError === 'access_token_error') {
            this.showNotification('TripIt authorization failed. Please try again.');
        } else {
            this.showNotification('TripIt authorization was cancelled or failed.');
        }
    },

    /**
     * Update a single account connection indicator in the UI.
     * @param {string} accountType - Account key
     * @param {boolean} isConnected - Whether the account is connected
     */
    setConnectionDisplay(accountType, isConnected) {
        const connectBtn = document.getElementById(`${accountType}Connect`);
        const statusDiv = document.getElementById(`${accountType}Status`);

        if (connectBtn) {
            connectBtn.style.display = isConnected ? 'none' : 'flex';
            if (!isConnected && accountType === 'tripit') {
                connectBtn.disabled = false;
                connectBtn.innerHTML = '<i class="fas fa-plug"></i> <span class="connect-text">Connect TripIt</span>';
            }
        }

        if (statusDiv) {
            statusDiv.style.display = isConnected ? 'flex' : 'none';
        }
    },

    /**
     * Fetch current TripIt cookie-backed status from the server.
     * @returns {Promise<boolean>}
     */
    async fetchTripItStatus() {
        try {
            const response = await fetch(CONFIG.TRIPIT_STATUS_URL, {
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`TripIt status check failed: ${response.status}`);
            }

            const data = await response.json();
            return Boolean(data.connected);
        } catch (error) {
            console.error('Error fetching TripIt status:', error);
            return false;
        }
    },

    /**
     * Sync TripIt connection state from the server session.
     * @returns {Promise<void>}
     */
    async syncTripItConnectionStatus() {
        USER_ACCOUNT.tripitConnected = await this.fetchTripItStatus();
        this.setConnectionDisplay('tripit', USER_ACCOUNT.tripitConnected);

        if (USER_ACCOUNT.tripitConnected) {
            USER_ACCOUNT.lastSync = new Date().toISOString();
        }
    },

    /**
     * Disconnect from an account
     * @param {string} accountType - 'concur', 'tripit', 'marriott', or 'hilton'
     */
    disconnectAccount(accountType) {
        const connectBtn = document.getElementById(`${accountType}Connect`);
        const statusDiv = document.getElementById(`${accountType}Status`);

        // Update user account state
        if (accountType === 'concur') {
            USER_ACCOUNT.concurConnected = false;
        } else if (accountType === 'tripit') {
            USER_ACCOUNT.tripitConnected = false;
            this.disconnectTripIt();
        } else if (accountType === 'marriott') {
            USER_ACCOUNT.marriottConnected = false;
        } else if (accountType === 'hilton') {
            USER_ACCOUNT.hiltonConnected = false;
        }

        const displayNames = {
            concur: 'Concur',
            tripit: 'TripIt',
            marriott: 'Marriott Bonvoy',
            hilton: 'Hilton Honors'
        };

        // Update UI
        connectBtn.style.display = 'flex';
        statusDiv.style.display = 'none';
        connectBtn.disabled = false;
        connectBtn.innerHTML = '<i class="fas fa-plug"></i> <span class="connect-text">Connect ' + 
                               (displayNames[accountType] || accountType) + '</span>';

        this.updateSyncInfo();

        console.log(`${accountType} disconnected`);
        this.showNotification(`${displayNames[accountType] || accountType} disconnected.`);
    },

    /**
     * Update connection status on page load
     */
    async updateConnectionStatus() {
        this.setConnectionDisplay('concur', USER_ACCOUNT.concurConnected);
        this.setConnectionDisplay('marriott', USER_ACCOUNT.marriottConnected);
        this.setConnectionDisplay('hilton', USER_ACCOUNT.hiltonConnected);
        await this.syncTripItConnectionStatus();

        this.updateSyncInfo();
    },

    /**
     * Update sync information display
     */
    updateSyncInfo() {
        const syncInfo = document.getElementById('syncInfo');
        const lastSyncTime = document.getElementById('lastSyncTime');

        if (USER_ACCOUNT.concurConnected || USER_ACCOUNT.tripitConnected || USER_ACCOUNT.marriottConnected || USER_ACCOUNT.hiltonConnected) {
            syncInfo.style.display = 'block';
            
            if (USER_ACCOUNT.lastSync) {
                const syncDate = new Date(USER_ACCOUNT.lastSync);
                const formattedDate = syncDate.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                });
                lastSyncTime.textContent = `Last synced: ${formattedDate}`;
            } else {
                lastSyncTime.textContent = 'Last synced: Never';
            }
        } else {
            syncInfo.style.display = 'none';
        }
    },

    /**
     * Revoke the stored TripIt access token on the server and clear local state.
     */
    async disconnectTripIt() {
        const token = localStorage.getItem('onthego_tripit_token');
        if (token) {
            try {
                await fetch(CONFIG.TRIPIT_DISCONNECT_URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'x-onthego-user-ref': USER_ACCOUNT.userRef
                    }
                });
            } catch (error) {
                console.error('Error disconnecting TripIt:', error);
            }
            localStorage.removeItem('onthego_tripit_token');
        }
    },

    /**
     * Show notification message
     * @param {string} message - Message to display
     */
    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.animation = 'slideIn 0.3s ease-out';

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
};
