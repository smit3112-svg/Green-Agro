// ── API base — routes served directly by FastAPI (no /api prefix) ─────────────
const API_BASE = '/api';

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function today() {
    return new Date().toISOString().split('T')[0];
}

function showStatus(id, msg, ok = true) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerText = msg;
    el.style.color = ok ? 'var(--eco-leaf)' : 'var(--eco-earth)';
}

// ── Translation System ────────────────────────────────────────────────────────
let currentLang = 'en';

function changeLanguage(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) {
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = translations[lang][key];
            } else {
                el.innerText = translations[lang][key];
            }
        }
    });
}

// ── Login / Logout ────────────────────────────────────────────────────────────
async function handleLogin() {
    const user   = document.getElementById('login-user').value.trim();
    const pass   = document.getElementById('login-pass').value.trim();
    const errEl  = document.getElementById('login-error');
    const btn    = document.querySelector('#login-container .cyber-btn.primary');

    if (!user || !pass) {
        errEl.innerText = 'Please enter your Admin ID and password.';
        errEl.style.display = 'block';
        return;
    }

    btn.innerText = 'Authenticating...';
    btn.disabled  = true;
    errEl.style.display = 'none';

    try {
        const res  = await fetch('/api/login', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ username: user, password: pass }),
        });
        const data = await res.json();

        if (res.ok && data.success) {
            document.getElementById('login-container').style.display = 'none';
            document.getElementById('app-container').style.display   = 'flex';
            document.getElementById('nav-dashboard-btn').click();
        } else {
            errEl.innerText = 'Invalid credentials. Please try again.';
            errEl.style.display = 'block';
        }
    } catch (e) {
        errEl.innerText = 'Server unreachable. Please try again.';
        errEl.style.display = 'block';
    } finally {
        btn.innerText = 'Access Console';
        btn.disabled  = false;
    }
}

function handleLogout() {
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('login-container').style.display = 'flex';
}

// ── Tab Switching ─────────────────────────────────────────────────────────────
function switchTab(tab, btn) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`${tab}-view`).classList.add('active');
    if (btn) btn.classList.add('active');

    if (tab === 'seller')    loadSellerDashboard();
    if (tab === 'buyer')     loadBuyerDashboard();
    if (tab === 'transport') loadTracking();
    if (tab === 'finance')   loadFinance();
    if (tab === 'dashboard') loadDashboard();
}

// ── Stepper renderer ──────────────────────────────────────────────────────────
function renderStepper(steps, currentStep) {
    let html = '<div class="stepper">';
    steps.forEach((step, i) => {
        let cls = '';
        if (i < currentStep) cls = 'completed';
        else if (i === currentStep) cls = 'active';
        const icon = i <= currentStep ? "<i class='bx bx-check'></i>" : '';
        html += `<div class="step ${cls}"><div class="step-circle">${icon}</div><div class="step-label">${step}</div></div>`;
    });
    html += '</div>';
    return html;
}

// ── 0. Admin Dashboard ────────────────────────────────────────────────────────
async function loadDashboard() {
    try {
        const [prices, impact] = await Promise.all([
            fetch(`${API_BASE}/prices`).then(r => r.json()),
            fetch(`${API_BASE}/impact`).then(r => r.json()),
        ]);

        document.getElementById('dash-co2').innerText = impact.co2_reduced_tons + ' T';
        document.getElementById('finance-co2') && (document.getElementById('finance-co2').innerText = impact.co2_reduced_tons + ' T');
        document.getElementById('finance-farmers') && (document.getElementById('finance-farmers').innerText = impact.farmers_impacted);

        // Live prices list
        const names = { wheat_straw: 'Wheat Straw', rice_straw: 'Rice Straw', sugarcane_bagasse: 'Sugarcane Bagasse', cotton_stalks: 'Cotton Stalks' };
        const liveEl = document.getElementById('live-prices');
        if (liveEl) {
            liveEl.innerHTML = Object.entries(prices).map(([k, v]) =>
                `<div class="list-item">
                    <div><h4>${names[k] || k}</h4></div>
                    <div style="text-align:right">
                        <h4 class="eco-text-green">₹${v.price.toLocaleString('en-IN')}/MT</h4>
                        <p style="font-size:0.8rem; color:${v.change.startsWith('+') ? 'var(--eco-leaf)' : 'var(--eco-earth)'}">${v.change}</p>
                    </div>
                </div>`
            ).join('');
        }
    } catch (e) {
        console.error('Dashboard load error', e);
    }
}

// ── 1. Seller / Farmer Dashboard ──────────────────────────────────────────────
async function loadSellerDashboard() {
    try {
        const data = await fetch(`${API_BASE}/farmer/F1/dashboard`).then(r => r.json());
        document.getElementById('farmer-name').innerText    = data.name;
        document.getElementById('farmer-location').innerText = data.location;
        document.getElementById('farmer-wallet').innerText   = formatCurrency(data.wallet_balance);
        document.getElementById('f-total-pickups').innerText = data.total_pickups;
        document.getElementById('f-total-mt').innerText      = data.total_collected_mt + ' MT';
        document.getElementById('f-total-earned').innerText  = formatCurrency(data.total_earned);
        loadTransactions();
    } catch (e) { console.error('Farmer dash error', e); }
}

async function loadTransactions() {
    try {
        const data = await fetch(`${API_BASE}/transactions`).then(r => r.json());
        const el = document.getElementById('f-transactions');
        if (!el) return;
        if (!data.transactions.length) {
            el.innerHTML = '<div class="list-item"><p>No transactions yet.</p></div>';
            return;
        }
        el.innerHTML = data.transactions.map(tx => {
            const isCredit = tx.type === 'credit';
            return `
                <div class="list-item">
                    <div>
                        <h4>${tx.label}</h4>
                        <p>${tx.date} • ${tx.method}</p>
                    </div>
                    <h3 class="${isCredit ? 'text-green' : 'text-red'}">${isCredit ? '+' : '-'}${formatCurrency(tx.amount)}</h3>
                </div>`;
        }).join('');
    } catch (e) { console.error('TX error', e); }
}

async function bookPickup() {
    const material = document.getElementById('pickup-material').value;
    const qty      = parseFloat(document.getElementById('pickup-qty').value);
    const loc      = document.getElementById('pickup-location').value.trim();
    const date     = document.getElementById('pickup-date').value || today();

    if (!loc || isNaN(qty) || qty <= 0) {
        showStatus('pickup-status', '❌ Please fill all fields.', false); return;
    }
    showStatus('pickup-status', 'Booking...', true);
    try {
        const res  = await fetch(`${API_BASE}/pickups`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ farmer: 'Ramesh Patel', material, quantity: qty, location: loc, date }),
        });
        const data = await res.json();
        if (res.ok) {
            showStatus('pickup-status', `✅ Pickup ${data.pickup_id} booked!`, true);
            setTimeout(() => { showStatus('pickup-status', '', true); loadSellerDashboard(); }, 2000);
        } else { showStatus('pickup-status', '❌ ' + (data.detail || 'Error'), false); }
    } catch (e) { showStatus('pickup-status', '❌ Network error', false); }
}

async function trackPickup() {
    const id = document.getElementById('track-pickup-id').value.trim().toUpperCase();
    const resultEl = document.getElementById('pickup-track-result');
    if (!id) { resultEl.innerHTML = '<p style="color:var(--eco-earth)">Enter a pickup ID.</p>'; return; }
    try {
        const res  = await fetch(`${API_BASE}/pickups/${id}/track`);
        const data = await res.json();
        if (!res.ok) { resultEl.innerHTML = `<p style="color:var(--eco-earth)">❌ ${data.detail}</p>`; return; }
        resultEl.innerHTML = `
            <div class="tracking-card">
                <div class="tracking-header">
                    <h4>Pickup #${data.id} <span style="margin-left:1rem; color:var(--eco-leaf)">${data.material}</span></h4>
                    <span>${data.location}</span>
                </div>
                <p style="margin-bottom:1rem; color:var(--text-light)">Qty: ${data.quantity} MT &nbsp;|&nbsp; Amount: ${formatCurrency(data.amount)} &nbsp;|&nbsp; Date: ${data.date}</p>
                ${renderStepper(data.steps, data.current_step)}
            </div>`;
    } catch (e) { resultEl.innerHTML = '<p style="color:var(--eco-earth)">❌ Network error</p>'; }
}

function calculateWaste() {
    const harvest = parseFloat(document.getElementById('calc-harvest').value);
    const ratio   = parseFloat(document.getElementById('calc-crop').value);
    if (isNaN(harvest) || harvest <= 0) {
        document.getElementById('calc-waste-out').innerText = '0 MT';
        document.getElementById('calc-earn-out').innerText  = '₹0';
        return;
    }
    const waste    = harvest * ratio;
    const earnings = waste * 2150;
    document.getElementById('calc-waste-out').innerText = waste.toFixed(1) + ' MT';
    document.getElementById('calc-earn-out').innerText  = formatCurrency(earnings);
}

// ── 2. Buyer Dashboard ────────────────────────────────────────────────────────
async function loadBuyerDashboard() {
    try {
        const data = await fetch(`${API_BASE}/buyer/B1/dashboard`).then(r => r.json());
        document.getElementById('buyer-name').innerText           = data.name;
        document.getElementById('buyer-company').innerText        = data.company;
        document.getElementById('buyer-location').innerText       = data.location;
        document.getElementById('buyer-outstanding').innerText    = formatCurrency(data.outstanding);
        document.getElementById('buyer-outstanding-stat').innerText = formatCurrency(data.outstanding);
        document.getElementById('b-total-mt').innerText           = data.current_order_mt + ' MT';

        const nextEl = document.getElementById('next-delivery-info');
        if (data.next_delivery) {
            nextEl.innerHTML = `
                <h4 style="color:var(--text-main)">Order #${data.next_delivery.id}</h4>
                <p style="color:var(--text-light)">${data.next_delivery.quantity} MT — ${data.next_delivery.pellet}</p>
                <h3 class="eco-text-leaf" style="margin-top:0.5rem">${data.next_delivery.status}</h3>
                <p style="color:var(--text-light); font-size:0.85rem">To: ${data.next_delivery.destination}</p>`;
        } else {
            nextEl.innerHTML = `<p style="color:var(--text-light)">No active deliveries.</p>`;
        }
    } catch (e) { console.error('Buyer dash error', e); }
}

function calculateOrderCost() {
    const qty = parseFloat(document.getElementById('order-qty').value);
    document.getElementById('order-cost-out').innerText = isNaN(qty) || qty <= 0 ? '₹0' : formatCurrency(qty * 6000);
}

async function placeOrder() {
    const buyer  = document.getElementById('order-buyer').value.trim() || 'Arjun Industries';
    const pellet = document.getElementById('order-pellet').value;
    const qty    = parseFloat(document.getElementById('order-qty').value);
    const dest   = document.getElementById('order-dest').value.trim();
    const date   = document.getElementById('order-date').value || today();

    if (isNaN(qty) || qty <= 0 || !dest) {
        showStatus('order-status', '❌ Fill quantity and destination.', false); return;
    }
    showStatus('order-status', 'Placing order...', true);
    try {
        const res  = await fetch(`${API_BASE}/orders`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ buyer, pellet, quantity: qty, destination: dest, date }),
        });
        const data = await res.json();
        if (res.ok) {
            showStatus('order-status', `✅ Order ${data.order_id} placed!`, true);
            setTimeout(() => { showStatus('order-status', '', true); loadBuyerDashboard(); }, 2000);
        } else { showStatus('order-status', '❌ ' + (data.detail || 'Error'), false); }
    } catch (e) { showStatus('order-status', '❌ Network error', false); }
}

async function trackOrder() {
    const id = document.getElementById('track-order-id').value.trim().toUpperCase();
    const resultEl = document.getElementById('order-track-result');
    if (!id) { resultEl.innerHTML = '<p style="color:var(--eco-earth)">Enter an order ID.</p>'; return; }
    try {
        const res  = await fetch(`${API_BASE}/orders/${id}/track`);
        const data = await res.json();
        if (!res.ok) { resultEl.innerHTML = `<p style="color:var(--eco-earth)">❌ ${data.detail}</p>`; return; }
        resultEl.innerHTML = `
            <div class="tracking-card">
                <div class="tracking-header">
                    <h4>Order #${data.id} <span style="margin-left:1rem; color:var(--eco-gold)">${data.pellet}</span></h4>
                    <span>To: ${data.destination}</span>
                </div>
                <p style="margin-bottom:1rem; color:var(--text-light)">Qty: ${data.quantity} MT &nbsp;|&nbsp; Amount: ${formatCurrency(data.amount)} &nbsp;|&nbsp; Date: ${data.date}</p>
                ${renderStepper(data.steps, data.current_step)}
            </div>`;
    } catch (e) { resultEl.innerHTML = '<p style="color:var(--eco-earth)">❌ Network error</p>'; }
}

async function makePayment() {
    const order_id = document.getElementById('pay-order-id').value.trim().toUpperCase();
    const amount   = parseFloat(document.getElementById('pay-amount').value);
    const method   = document.getElementById('pay-method').value;

    if (!order_id || isNaN(amount) || amount <= 0) {
        showStatus('payment-status', '❌ Fill Order ID and Amount.', false); return;
    }
    showStatus('payment-status', `Processing via ${method}...`, true);
    try {
        const res  = await fetch(`${API_BASE}/payments`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id, amount, method }),
        });
        const data = await res.json();
        if (res.ok) {
            showStatus('payment-status', `✅ ${data.message} | Txn: ${data.txn_id}`, true);
            setTimeout(() => { showStatus('payment-status', '', true); loadBuyerDashboard(); loadFinance(); }, 2500);
        } else { showStatus('payment-status', '❌ ' + (data.detail || 'Error'), false); }
    } catch (e) { showStatus('payment-status', '❌ Network error', false); }
}

// ── 3. Tracking ───────────────────────────────────────────────────────────────
async function loadTracking() {
    try {
        const pickupEl = document.getElementById('tracking-pickups');
        const orderEl  = document.getElementById('tracking-deliveries');

        const [pRes, oRes] = await Promise.all([
            fetch(`${API_BASE}/pickups/PKP001/track`),
            fetch(`${API_BASE}/orders/GA1256/track`),
        ]);

        if (pRes.ok) {
            const p = await pRes.json();
            pickupEl.innerHTML = `
                <div class="tracking-card">
                    <div class="tracking-header">
                        <h4>Pickup #${p.id} <span style="margin-left:0.5rem;color:var(--eco-leaf)">${p.material}</span></h4>
                        <span>${p.location}</span>
                    </div>
                    ${renderStepper(p.steps, p.current_step)}
                </div>`;
        }

        if (oRes.ok) {
            const o = await oRes.json();
            orderEl.innerHTML = `
                <div class="tracking-card">
                    <div class="tracking-header">
                        <h4>Order #${o.id} <span style="margin-left:0.5rem;color:var(--eco-gold)">${o.pellet}</span></h4>
                        <span>To: ${o.destination}</span>
                    </div>
                    ${renderStepper(o.steps, o.current_step)}
                </div>`;
        }
    } catch (e) { console.error('Tracking error', e); }
}

// ── 4. Finance ────────────────────────────────────────────────────────────────
async function loadFinance() {
    try {
        const [txData, impact] = await Promise.all([
            fetch(`${API_BASE}/transactions`).then(r => r.json()),
            fetch(`${API_BASE}/impact`).then(r => r.json()),
        ]);

        const el = document.getElementById('finance-transactions');
        if (el) {
            el.innerHTML = txData.transactions.map(tx => {
                const isCredit = tx.type === 'credit';
                return `
                    <div class="list-item">
                        <div>
                            <h4>${tx.label}</h4>
                            <p>${tx.date} • ${tx.method}</p>
                        </div>
                        <h3 class="${isCredit ? 'text-green' : 'text-red'}">${isCredit ? '+' : '-'}${formatCurrency(tx.amount)}</h3>
                    </div>`;
            }).join('') || '<div class="list-item"><p>No transactions.</p></div>';
        }

        const co2El = document.getElementById('finance-co2');
        if (co2El) co2El.innerText = impact.co2_reduced_tons + ' T';
        const farmEl = document.getElementById('finance-farmers');
        if (farmEl) farmEl.innerText = impact.farmers_impacted;

    } catch (e) { console.error('Finance error', e); }
}

async function withdrawWallet() {
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    const method = document.getElementById('withdraw-method').value;
    if (isNaN(amount) || amount <= 0) {
        showStatus('withdraw-status', '❌ Enter a valid amount.', false); return;
    }
    showStatus('withdraw-status', 'Processing...', true);
    try {
        const res  = await fetch(`${API_BASE}/wallet/withdraw`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, method }),
        });
        const data = await res.json();
        if (res.ok) {
            showStatus('withdraw-status', `✅ ${data.message} | New balance: ${formatCurrency(data.new_balance)}`, true);
            setTimeout(() => loadFinance(), 1500);
        } else { showStatus('withdraw-status', '❌ ' + (data.detail || 'Error'), false); }
    } catch (e) { showStatus('withdraw-status', '❌ Network error', false); }
}

// ── Notifications ─────────────────────────────────────────────────────────────
function toggleNotifications() {
    const panel = document.getElementById('notifications-panel');
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
        document.getElementById('notif-list').innerHTML = `
            <div class="list-item" style="flex-direction:column; align-items:flex-start;">
                <h4 style="color:var(--eco-green)">Payment Received</h4>
                <p style="margin-bottom:0.3rem">₹1,20,000 via NEFT</p>
                <span style="font-size:0.75rem; color:var(--text-light)">2 hours ago</span>
            </div>
            <div class="list-item" style="flex-direction:column; align-items:flex-start;">
                <h4 style="color:var(--eco-leaf)">Pickup Assigned</h4>
                <p style="margin-bottom:0.3rem">Truck TRK-004 assigned to PKP001.</p>
                <span style="font-size:0.75rem; color:var(--text-light)">5 hours ago</span>
            </div>
            <div class="list-item" style="flex-direction:column; align-items:flex-start;">
                <h4 style="color:var(--eco-gold)">Quality Report Ready</h4>
                <p style="margin-bottom:0.3rem">Order GA1256 meets Grade A specifications.</p>
                <span style="font-size:0.75rem; color:var(--text-light)">1 day ago</span>
            </div>`;
    }
}

// ── Market Price Trends Chart ──────────────────────────────────────────────────
function initCharts() {
    const ctx = document.getElementById('adminMarketChart');
    if (!ctx) return;
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [
                {
                    label: 'Wheat Straw (₹/MT)',
                    data: [1950, 1980, 2050, 2100, 2080, 2150],
                    borderColor: '#d97706',
                    backgroundColor: 'rgba(217,119,6,0.1)',
                    tension: 0.4, fill: true,
                },
                {
                    label: 'Rice Straw (₹/MT)',
                    data: [1800, 1850, 1820, 1900, 1920, 1950],
                    borderColor: '#16a34a',
                    backgroundColor: 'rgba(22,163,74,0.1)',
                    tension: 0.4, fill: true,
                },
                {
                    label: 'Sugarcane Bagasse (₹/MT)',
                    data: [2200, 2250, 2300, 2350, 2380, 2400],
                    borderColor: '#059669',
                    backgroundColor: 'rgba(5,150,105,0.08)',
                    tension: 0.4, fill: true,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#334155', font: { family: 'Inter' } } } },
            scales: {
                y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#64748b' } },
                x: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#64748b' } },
            },
        },
    });
}

// ── Location Autocomplete ─────────────────────────────────────────────────────
function initAutocomplete() {
    const input = document.getElementById('order-dest');
    if (!input) return;
    const indianCities = [
        'Ahmedabad, Gujarat', 'Surat, Gujarat', 'Vadodara, Gujarat', 'Rajkot, Gujarat',
        'Bhavnagar, Gujarat', 'Jamnagar, Gujarat', 'Ankleshwar, Gujarat', 'Vapi, Gujarat',
        'Gandhinagar, Gujarat', 'Mumbai, Maharashtra', 'Pune, Maharashtra', 'Nagpur, Maharashtra',
        'Nashik, Maharashtra', 'Delhi', 'New Delhi', 'Gurugram, Haryana', 'Noida, UP',
        'Bengaluru, Karnataka', 'Mysuru, Karnataka', 'Chennai, Tamil Nadu', 'Coimbatore, Tamil Nadu',
        'Hyderabad, Telangana', 'Kolkata, West Bengal', 'Jaipur, Rajasthan', 'Indore, MP',
        'Bhopal, MP', 'Ludhiana, Punjab', 'Chandigarh', 'Patna, Bihar', 'Lucknow, UP', 'Kanpur, UP',
    ];
    new Awesomplete(input, { list: indianCities, minChars: 1, autoFirst: true });
}

// ── Set default date fields ───────────────────────────────────────────────────
function initDateFields() {
    const t = today();
    ['pickup-date', 'order-date'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = t;
    });
}

// ── API health check ──────────────────────────────────────────────────────────
async function checkApiStatus() {
    try {
        const res = await fetch(`/health`);
        const dot = document.getElementById('api-status-dot');
        if (res.ok && dot) {
            dot.innerHTML = '<span class="pulse"></span> ONLINE';
            dot.style.color = 'var(--eco-leaf)';
        }
    } catch {
        const dot = document.getElementById('api-status-dot');
        if (dot) {
            dot.innerHTML = '⚠ OFFLINE';
            dot.style.color = 'var(--eco-earth)';
        }
    }
}

// ── Init ──────────────────────────────────────────────────────────────────────
window.onload = () => {
    changeLanguage('en');
    calculateWaste();
    calculateOrderCost();
    initCharts();
    initAutocomplete();
    initDateFields();
    checkApiStatus();
};
