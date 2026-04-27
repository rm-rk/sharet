/* ============================================
   SHARET — Firebase Config & App Logic
   ============================================ */

// ==========================================
// STEP 1: PASTE YOUR FIREBASE CONFIG HERE
// ==========================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ==========================================
// Access Control (LocalStorage)
// ==========================================
const STORAGE_KEY = 'sharet_hasSubmitted';

function hasSubmitted() {
    return localStorage.getItem(STORAGE_KEY) === 'true';
}

function setSubmitted() {
    localStorage.setItem(STORAGE_KEY, 'true');
}

// ==========================================
// Page Router — Run on every page load
// ==========================================
const page = document.body.dataset.page;

// Home & Thank You pages require submission
if ((page === 'home' || page === 'thankyou') && !hasSubmitted()) {
    window.location.replace('index.html');
}

// ==========================================
// Entry Page Logic (index.html)
// ==========================================
if (page === 'entry') {
    const form = document.getElementById('wifiForm');
    const ssidInput = document.getElementById('ssid');
    const passwordInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirmPassword');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');

    // Password visibility toggles
    setupToggle('togglePassword', 'password');
    setupToggle('toggleConfirm', 'confirmPassword');

    function setupToggle(btnId, inputId) {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        btn.addEventListener('click', () => {
            const isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            btn.style.color = isHidden ? 'var(--accent-light)' : 'var(--text-muted)';
        });
    }

    // Real-time validation clearing
    [ssidInput, passwordInput, confirmInput].forEach(input => {
        input.addEventListener('input', () => {
            input.classList.remove('error');
            const errorEl = document.getElementById(input.id + 'Error');
            if (errorEl) errorEl.classList.remove('visible');
        });
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Clear previous errors
        clearErrors();

        const ssid = ssidInput.value.trim();
        const password = passwordInput.value;
        const confirm = confirmInput.value;

        let hasError = false;

        // Validate SSID
        if (!ssid) {
            showError('ssid', 'Please enter your Wi-Fi name');
            hasError = true;
        }

        // Validate Password
        if (!password) {
            showError('password', 'Please enter a password');
            hasError = true;
        }

        // Validate Confirm
        if (!confirm) {
            showError('confirmPassword', 'Please confirm your password');
            hasError = true;
        }

        // Match check
        if (password && confirm && password !== confirm) {
            showError('confirmPassword', 'Passwords do not match');
            hasError = true;
        }

        if (hasError) return;

        // Show loading
        setLoading(true);

        try {
            // Save to Firestore
            await db.collection('wifiShares').add({
                ssid: ssid,
                password: password,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Mark as submitted
            setSubmitted();

            // Redirect to thank you page
            window.location.href = 'thankyou.html';

        } catch (err) {
            console.error('Error saving:', err);
            showError('ssid', 'Something went wrong. Please try again.');
            setLoading(false);
        }
    });

    function showError(fieldId, message) {
        const input = document.getElementById(fieldId);
        const errorEl = document.getElementById(fieldId + 'Error');
        input.classList.add('error');
        errorEl.textContent = message;
        errorEl.classList.add('visible');
    }

    function clearErrors() {
        document.querySelectorAll('.error-msg').forEach(el => {
            el.classList.remove('visible');
            el.textContent = '';
        });
        document.querySelectorAll('input').forEach(el => el.classList.remove('error'));
    }

    function setLoading(isLoading) {
        submitBtn.disabled = isLoading;
        btnText.classList.toggle('hidden', isLoading);
        btnLoader.classList.toggle('hidden', !isLoading);
    }
}

// ==========================================
// Home Page Logic (home.html)
// ==========================================
if (page === 'home') {
    const wifiList = document.getElementById('wifiList');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');

    // Fetch Wi-Fi networks
    async function loadNetworks() {
        try {
            const snapshot = await db.collection('wifiShares')
                .orderBy('createdAt', 'desc')
                .get();

            loadingState.classList.add('hidden');

            if (snapshot.empty) {
                emptyState.classList.remove('hidden');
                return;
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                const card = createWifiCard(doc.id, data.ssid, data.password);
                wifiList.appendChild(card);
            });

        } catch (err) {
            console.error('Error loading:', err);
            loadingState.innerHTML = '<p style="color: var(--error)">Failed to load networks.<br>Check your connection.</p>';
        }
    }

    function createWifiCard(id, ssid, password) {
        const card = document.createElement('div');
        card.className = 'wifi-card';
        card.dataset.revealed = 'false';

        card.innerHTML = `
            <div class="card-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
                    <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
                    <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                    <line x1="12" y1="20" x2="12.01" y2="20"/>
                </svg>
            </div>
            <div class="card-info">
                <h3>${escapeHtml(ssid)}</h3>
                <div class="password-row">
                    <span class="password-masked" id="mask-${id}">••••••••</span>
                    <span class="password-text" id="pass-${id}">${escapeHtml(password)}</span>
                </div>
                <p class="reveal-hint" id="hint-${id}">Tap to reveal password</p>
            </div>
        `;

        // Tap to reveal
        card.addEventListener('click', () => {
            const isRevealed = card.dataset.revealed === 'true';
            const mask = document.getElementById(`mask-${id}`);
            const pass = document.getElementById(`pass-${id}`);
            const hint = document.getElementById(`hint-${id}`);

            if (!isRevealed) {
                mask.classList.add('hidden');
                pass.classList.add('revealed');
                hint.textContent = 'Tap to hide';
                card.dataset.revealed = 'true';
            } else {
                mask.classList.remove('hidden');
                pass.classList.remove('revealed');
                hint.textContent = 'Tap to reveal password';
                card.dataset.revealed = 'false';
            }
        });

        return card;
    }

    // Prevent XSS in displayed SSID/password
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Load on page open
    loadNetworks();
}

// ==========================================
// Thank You Page Logic (thankyou.html)
// ==========================================
if (page === 'thankyou') {
    const burstContainer = document.getElementById('particleBurst');
    const timerEl = document.getElementById('timer');
    let seconds = 4;

    // Generate CSS particle burst
    function createParticles() {
        const colors = ['#8b5cf6', '#6366f1', '#a78bfa', '#34d399', '#f472b6', '#60a5fa'];
        
        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            
            const angle = (i / 30) * Math.PI * 2;
            const distance = 60 + Math.random() * 80;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const delay = Math.random() * 0.3;
            const size = 4 + Math.random() * 4;

            particle.style.cssText = `
                --angle: ${angle}rad;
                --distance: ${distance}px;
                background: ${color};
                width: ${size}px;
                height: ${size}px;
                animation-delay: ${delay}s;
            `;

            burstContainer.appendChild(particle);
        }
    }

    createParticles();

    // Auto-redirect countdown
    const countdown = setInterval(() => {
        seconds--;
        timerEl.textContent = seconds;
        if (seconds <= 0) {
            clearInterval(countdown);
            window.location.href = 'home.html';
        }
    }, 1000);
}
