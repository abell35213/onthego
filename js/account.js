// Account Module - Handles Concur/TripIt account connections
const Account = {
    /**
     * Initialize account modal and event listeners
     */
    init() {
        this.setupEventListeners();
        this.updateConnectionStatus();
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
                const accountType = e.target.closest('.account-card').querySelector('h3').textContent.toLowerCase();
                this.disconnectAccount(accountType);
            }
        });
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
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background-color: var(--success-color);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 2000;
            animation: slideIn 0.3s ease-out;
        `;

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

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
