// Account Module - Handles user profile, Concur/TripIt account connections, and settings
const Account = {
    /**
     * Initialize account modal and event listeners
     */
    init() {
        this.setupEventListeners();
        this.setupTabs();
        this.setupProfileForm();
        this.setupSettings();
        this.updateConnectionStatus();
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
    saveSettings() {
        const settings = {
            textAlerts: document.getElementById('settingTextAlerts')?.checked || false,
            emailAlerts: document.getElementById('settingEmailAlerts')?.checked || false,
            dealAlerts: document.getElementById('settingDealAlerts')?.checked || false,
            searchRadius: document.getElementById('settingRadius')?.value || '5000',
            defaultCuisine: document.getElementById('settingCuisine')?.value || '',
            defaultPrice: document.getElementById('settingPrice')?.value || '',
            accessibility: document.getElementById('settingAccessibility')?.checked || false
        };

        localStorage.setItem('onthego_settings', JSON.stringify(settings));

        // Show success message
        const msg = document.getElementById('settingsSavedMsg');
        if (msg) {
            msg.style.display = 'flex';
            setTimeout(() => { msg.style.display = 'none'; }, 3000);
        }

        this.showNotification('Settings saved successfully!');
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

                if (textAlerts) textAlerts.checked = settings.textAlerts !== false;
                if (emailAlerts) emailAlerts.checked = settings.emailAlerts !== false;
                if (dealAlerts) dealAlerts.checked = settings.dealAlerts || false;
                if (radius) radius.value = settings.searchRadius || '5000';
                if (cuisine) cuisine.value = settings.defaultCuisine || '';
                if (price) price.value = settings.defaultPrice || '';
                if (accessibility) accessibility.checked = settings.accessibility || false;
            } catch (e) {
                console.error('Error loading settings:', e);
            }
        }
    },

    /**
     * Simulate connecting to an account
     * @param {string} accountType - 'concur' or 'tripit'
     */
    connectAccount(accountType) {
        // Simulate API call delay
        const connectBtn = document.getElementById(`${accountType}Connect`);
        const statusDiv = document.getElementById(`${accountType}Status`);
        
        connectBtn.disabled = true;
        connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';

        setTimeout(() => {
            // Update user account state
            if (accountType === 'concur') {
                USER_ACCOUNT.concurConnected = true;
            } else {
                USER_ACCOUNT.tripitConnected = true;
            }
            USER_ACCOUNT.lastSync = new Date().toISOString();

            // Update UI
            connectBtn.style.display = 'none';
            statusDiv.style.display = 'flex';
            this.updateSyncInfo();

            console.log(`${accountType} connected successfully`);
            
            // Show success message
            this.showNotification(`${accountType === 'concur' ? 'Concur' : 'TripIt'} connected successfully!`);
        }, 1500);
    },

    /**
     * Simulate disconnecting from an account
     * @param {string} accountType - 'concur' or 'tripit'
     */
    disconnectAccount(accountType) {
        const connectBtn = document.getElementById(`${accountType}Connect`);
        const statusDiv = document.getElementById(`${accountType}Status`);

        // Update user account state
        if (accountType === 'concur') {
            USER_ACCOUNT.concurConnected = false;
        } else {
            USER_ACCOUNT.tripitConnected = false;
        }

        // Update UI
        connectBtn.style.display = 'flex';
        statusDiv.style.display = 'none';
        connectBtn.disabled = false;
        connectBtn.innerHTML = '<i class="fas fa-plug"></i> <span class="connect-text">Connect ' + 
                               (accountType === 'concur' ? 'Concur' : 'TripIt') + '</span>';

        this.updateSyncInfo();

        console.log(`${accountType} disconnected`);
        this.showNotification(`${accountType === 'concur' ? 'Concur' : 'TripIt'} disconnected.`);
    },

    /**
     * Update connection status on page load
     */
    updateConnectionStatus() {
        if (USER_ACCOUNT.concurConnected) {
            document.getElementById('concurConnect').style.display = 'none';
            document.getElementById('concurStatus').style.display = 'flex';
        }

        if (USER_ACCOUNT.tripitConnected) {
            document.getElementById('tripitConnect').style.display = 'none';
            document.getElementById('tripitStatus').style.display = 'flex';
        }

        this.updateSyncInfo();
    },

    /**
     * Update sync information display
     */
    updateSyncInfo() {
        const syncInfo = document.getElementById('syncInfo');
        const lastSyncTime = document.getElementById('lastSyncTime');

        if (USER_ACCOUNT.concurConnected || USER_ACCOUNT.tripitConnected) {
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
