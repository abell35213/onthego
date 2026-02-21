// AI Concierge Module — business dining recommendations powered by OpenAI
const Concierge = {
    isOpen: false,
    currentRecommendations: [],
    selectedRestaurant: null,

    /**
     * Initialize the concierge — attach button listeners.
     */
    init() {
        const openBtn = document.getElementById('conciergeOpenBtn');
        const closeBtn = document.getElementById('conciergeCloseBtn');
        const form = document.getElementById('conciergeForm');
        const resetBtn = document.getElementById('conciergeResetBtn');
        const overlay = document.getElementById('conciergeOverlay');

        if (openBtn) openBtn.addEventListener('click', () => this.open());
        if (closeBtn) closeBtn.addEventListener('click', () => this.close());
        if (overlay) overlay.addEventListener('click', () => this.close());
        if (form) form.addEventListener('submit', (e) => { e.preventDefault(); this.getRecommendations(); });
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetToForm());

        // Pre-fill destination from active trip if available
        this.prefillFromActiveTrip();
    },

    /**
     * Pre-fill the destination and date from the currently selected trip.
     */
    prefillFromActiveTrip() {
        const destInput = document.getElementById('conciergeDestination');
        const dateInput = document.getElementById('conciergeDate');
        if (!destInput) return;

        // Try to get active trip from App
        if (window.App && App.activeSearchContext) {
            const ctx = App.activeSearchContext;
            const tripList = ctx.type === 'upcoming' ? MOCK_UPCOMING_TRIPS : MOCK_TRAVEL_HISTORY;
            const trip = tripList ? tripList.find(t => t.id === ctx.tripId) : null;
            if (trip) {
                destInput.value = `${trip.city}, ${trip.state}`;
                if (dateInput && trip.startDate) dateInput.value = trip.startDate;
                return;
            }
        }

        // Fallback: use the next upcoming trip
        if (typeof MOCK_UPCOMING_TRIPS !== 'undefined' && MOCK_UPCOMING_TRIPS.length > 0) {
            const trip = MOCK_UPCOMING_TRIPS[0];
            destInput.value = `${trip.city}, ${trip.state}`;
            if (dateInput && trip.startDate) dateInput.value = trip.startDate;
        }
    },

    /**
     * Open the concierge panel.
     */
    open() {
        const panel = document.getElementById('conciergePanel');
        const overlay = document.getElementById('conciergeOverlay');
        if (panel) panel.classList.add('open');
        if (overlay) overlay.classList.add('visible');
        this.isOpen = true;
        this.prefillFromActiveTrip();
    },

    /**
     * Close the concierge panel.
     */
    close() {
        const panel = document.getElementById('conciergePanel');
        const overlay = document.getElementById('conciergeOverlay');
        if (panel) panel.classList.remove('open');
        if (overlay) overlay.classList.remove('visible');
        this.isOpen = false;
    },

    /**
     * Reset the panel back to the input form.
     */
    resetToForm() {
        this.currentRecommendations = [];
        this.selectedRestaurant = null;
        const formSection = document.getElementById('conciergeFormSection');
        const resultsSection = document.getElementById('conciergeResults');
        const reservationSection = document.getElementById('conciergeReservation');
        if (formSection) formSection.style.display = 'block';
        if (resultsSection) resultsSection.style.display = 'none';
        if (reservationSection) reservationSection.style.display = 'none';
    },

    /**
     * Call the /api/concierge endpoint and display recommendations.
     */
    async getRecommendations() {
        const destination = document.getElementById('conciergeDestination')?.value?.trim();
        const date = document.getElementById('conciergeDate')?.value?.trim();
        const mealType = document.getElementById('conciergeMealType')?.value || 'business dinner';
        const partySize = parseInt(document.getElementById('conciergePartySize')?.value || '2', 10);
        const preferences = document.getElementById('conciergePreferences')?.value?.trim() || '';

        if (!destination) {
            this.showError('Please enter a destination city.');
            return;
        }

        // Show loading
        this.showLoading();

        // Gather nearby restaurants if available
        const restaurants = (window.UI && UI.restaurants) ? UI.restaurants : [];

        try {
            const response = await fetch(CONFIG.CONCIERGE_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ destination, date, mealType, partySize, preferences, restaurants })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `Server error ${response.status}`);
            }

            const data = await response.json();
            this.currentRecommendations = data.recommendations || [];
            this.renderRecommendations(data.message, this.currentRecommendations, mealType);
        } catch (error) {
            console.error('Concierge error:', error);
            this.showError(`Unable to get recommendations: ${error.message}. Please check that the OpenAI API key is configured.`);
        }
    },

    /**
     * Show loading spinner while waiting for AI response.
     */
    showLoading() {
        const formSection = document.getElementById('conciergeFormSection');
        const resultsSection = document.getElementById('conciergeResults');
        if (formSection) formSection.style.display = 'none';
        if (resultsSection) {
            resultsSection.style.display = 'block';
            resultsSection.innerHTML = `
                <div class="concierge-loading">
                    <div class="concierge-loading-orb"></div>
                    <p class="concierge-loading-text">Your concierge is curating the perfect dining experience…</p>
                </div>
            `;
        }
    },

    /**
     * Show an error message in the form.
     */
    showError(message) {
        const formSection = document.getElementById('conciergeFormSection');
        const resultsSection = document.getElementById('conciergeResults');
        if (formSection) formSection.style.display = 'block';
        if (resultsSection) resultsSection.style.display = 'none';
        let errEl = document.getElementById('conciergeError');
        if (!errEl) {
            errEl = document.createElement('div');
            errEl.id = 'conciergeError';
            errEl.className = 'concierge-error';
            if (formSection) formSection.prepend(errEl);
        }
        errEl.textContent = message;
        errEl.style.display = 'block';
        setTimeout(() => { errEl.style.display = 'none'; }, 6000);
    },

    /**
     * Render the top 3 recommendation cards.
     * @param {string} message - AI intro message
     * @param {Array} recommendations - Array of recommendation objects
     * @param {string} mealType - Type of meal
     */
    renderRecommendations(message, recommendations, mealType) {
        const resultsSection = document.getElementById('conciergeResults');
        if (!resultsSection) return;

        resultsSection.style.display = 'block';
        resultsSection.innerHTML = `
            <div class="concierge-ai-message">
                <div class="concierge-avatar"><i data-lucide="bell"></i></div>
                <div class="concierge-bubble">${message || 'Here are my top picks for your business dining experience:'}</div>
            </div>
            <div class="concierge-picks-label">
                <i data-lucide="crown"></i> Top 3 Picks for ${this.escapeHtml(mealType)}
            </div>
            <div class="concierge-cards">
                ${recommendations.map((rec, idx) => this.buildRecommendationCard(rec, idx)).join('')}
            </div>
            <button class="concierge-back-btn" id="conciergeResetBtn">
                <i data-lucide="arrow-left"></i> New Search
            </button>
        `;

        // Attach reset button listener (re-created by innerHTML)
        const resetBtn = document.getElementById('conciergeResetBtn');
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetToForm());

        // Attach select buttons
        recommendations.forEach((rec, idx) => {
            const btn = document.getElementById(`concierge-select-${idx}`);
            if (btn) btn.addEventListener('click', () => this.selectRestaurant(rec));
        });

        // Refresh Lucide icons
        if (window.lucide) lucide.createIcons();
    },

    /**
     * Build HTML for a single recommendation card.
     * @param {Object} rec - Recommendation object
     * @param {number} idx - Index (0-based)
     * @returns {string} HTML string
     */
    buildRecommendationCard(rec, idx) {
        const stars = this.buildStars(rec.rating || 0);
        return `
            <div class="concierge-rec-card" style="animation-delay: ${idx * 0.12}s">
                <div class="concierge-rec-rank">#${rec.rank || idx + 1}</div>
                <div class="concierge-rec-body">
                    <div class="concierge-rec-header">
                        <div class="concierge-rec-name">${this.escapeHtml(rec.name)}</div>
                        <div class="concierge-rec-meta">
                            <span class="concierge-rec-cuisine">${this.escapeHtml(rec.cuisineType || '')}</span>
                            <span class="concierge-rec-price">${this.escapeHtml(rec.priceRange || '')}</span>
                        </div>
                    </div>
                    <div class="concierge-rec-rating">${stars} <span>${rec.rating || ''}</span></div>
                    <div class="concierge-rec-address"><i data-lucide="map-pin"></i> ${this.escapeHtml(rec.address || '')}</div>
                    <p class="concierge-rec-desc">${this.escapeHtml(rec.description || '')}</p>
                    <div class="concierge-rec-why">
                        <i data-lucide="briefcase"></i> ${this.escapeHtml(rec.whyBusinessMeal || '')}
                    </div>
                    ${rec.mustTry ? `<div class="concierge-rec-musttry"><i data-lucide="star"></i> Must Try: ${this.escapeHtml(rec.mustTry)}</div>` : ''}
                    <button class="concierge-select-btn" id="concierge-select-${idx}">
                        <i data-lucide="calendar-check"></i> Reserve This Table
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Build star rating HTML.
     * @param {number} rating - 0-5
     * @returns {string}
     */
    buildStars(rating) {
        const full = Math.floor(rating);
        const half = rating % 1 >= 0.5 ? 1 : 0;
        const empty = 5 - full - half;
        return '<i data-lucide="star" class="star-icon star-filled"></i>'.repeat(full) +
               (half ? '<i data-lucide="star-half" class="star-icon star-half"></i>' : '') +
               '<i data-lucide="star" class="star-icon star-empty"></i>'.repeat(empty);
    },

    /**
     * Handle user selecting a restaurant — show reservation options.
     * @param {Object} rec - Recommendation object
     */
    selectRestaurant(rec) {
        this.selectedRestaurant = rec;
        const resultsSection = document.getElementById('conciergeResults');
        if (!resultsSection) return;

        resultsSection.innerHTML = `
            <div class="concierge-ai-message">
                <div class="concierge-avatar"><i data-lucide="bell"></i></div>
                <div class="concierge-bubble">
                    Excellent choice! <strong>${this.escapeHtml(rec.name)}</strong> is a superb selection.
                    ${rec.reservationTip ? `<br><em>${this.escapeHtml(rec.reservationTip)}</em>` : ''}
                    I've prepared your reservation options below.
                </div>
            </div>
            <div class="concierge-reservation-card">
                <div class="concierge-res-title">
                    <i data-lucide="utensils"></i> ${this.escapeHtml(rec.name)}
                </div>
                <div class="concierge-res-detail"><i data-lucide="map-pin"></i> ${this.escapeHtml(rec.address || '')}</div>
                <div class="concierge-res-detail"><i data-lucide="tag"></i> ${this.escapeHtml(rec.priceRange || '')} · ${this.escapeHtml(rec.cuisineType || '')}</div>
                <div class="concierge-res-actions">
                    <a href="${rec.openTableUrl || `https://www.opentable.com/s?term=${encodeURIComponent(rec.name)}`}" 
                       target="_blank" rel="noopener noreferrer" class="concierge-res-btn opentable">
                        <i data-lucide="calendar-check"></i> Book on OpenTable
                    </a>
                    <a href="${rec.resyUrl || `https://resy.com/?search=${encodeURIComponent(rec.name)}`}" 
                       target="_blank" rel="noopener noreferrer" class="concierge-res-btn resy">
                        <i data-lucide="bookmark"></i> Book on Resy
                    </a>
                    <a href="${rec.googleMapsUrl || `https://maps.google.com/?q=${encodeURIComponent(rec.name)}`}" 
                       target="_blank" rel="noopener noreferrer" class="concierge-res-btn maps">
                        <i data-lucide="navigation"></i> Get Directions
                    </a>
                </div>
                <div class="concierge-res-note">
                    <i data-lucide="info"></i> 
                    Clicking a booking link will open the reservation platform in a new tab. 
                    For same-day reservations, calling the restaurant directly is recommended.
                </div>
            </div>
            <div class="concierge-back-row">
                <button class="concierge-back-btn" id="conciergeBackToRecs">
                    <i data-lucide="arrow-left"></i> Back to Picks
                </button>
                <button class="concierge-back-btn" id="conciergeResetBtn">
                    <i data-lucide="search"></i> New Search
                </button>
            </div>
        `;

        document.getElementById('conciergeBackToRecs')?.addEventListener('click', () => {
            const mealType = document.getElementById('conciergeMealType')?.value || 'business dinner';
            this.renderRecommendations(null, this.currentRecommendations, mealType);
        });
        document.getElementById('conciergeResetBtn')?.addEventListener('click', () => this.resetToForm());

        // Refresh Lucide icons
        if (window.lucide) lucide.createIcons();
    },

    /**
     * Safely escape HTML to prevent XSS.
     * @param {string} str
     * @returns {string}
     */
    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }
};
