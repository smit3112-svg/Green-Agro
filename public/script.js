const API_BASE = '/api';

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
}

// Translation System
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

// Login System
function handleLogin() {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
    document.getElementById('nav-dashboard-btn').click();
}

function handleLogout() {
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('login-container').style.display = 'flex';
}
// Tab Switching
function switchTab(tab) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`${tab}-view`).classList.add('active');
    event.currentTarget.classList.add('active');

    if(tab === 'farmer') loadFarmerDashboard();
    if(tab === 'buyer') loadBuyerDashboard();
    if(tab === 'transport') loadTracking();
    if(tab === 'sustain') loadImpact();
}

function renderStepper(steps, currentStep) {
    let html = '<div class="stepper">';
    steps.forEach((step, index) => {
        let statusClass = '';
        if (index < currentStep) statusClass = 'completed';
        else if (index === currentStep) statusClass = 'active';
        
        let icon = index <= currentStep ? "<i class='bx bx-check'></i>" : "";

        html += `
            <div class="step ${statusClass}">
                <div class="step-circle">${icon}</div>
                <div class="step-label">${step}</div>
            </div>
        `;
    });
    html += '</div>';
    return html;
}

// 1. Farmer Dashboard
async function loadFarmerDashboard() {
    try {
        const res = await fetch(`${API_BASE}/farmer/F1/dashboard`);
        const data = await res.json();
        
        document.getElementById('farmer-name').innerText = data.name;
        document.getElementById('farmer-location').innerText = data.location;
        document.getElementById('farmer-wallet').innerText = formatCurrency(data.wallet_balance);
        document.getElementById('f-total-pickups').innerText = data.total_pickups;
        document.getElementById('f-total-mt').innerText = data.total_collected_mt;

        loadTransactions();
    } catch(e) { console.error("Error loading farmer dash", e); }
}

async function loadTransactions() {
    try {
        const res = await fetch(`${API_BASE}/transactions`);
        const data = await res.json();
        const txList = document.getElementById('f-transactions');
        txList.innerHTML = '';
        
        data.transactions.forEach(tx => {
            const isCredit = tx.type === 'credit';
            const colorClass = isCredit ? 'text-green' : 'text-red';
            const sign = isCredit ? '+' : '-';
            
            txList.innerHTML += `
                <div class="list-item">
                    <div>
                        <h4>${tx.label}</h4>
                        <p>${tx.date} • ${tx.method}</p>
                    </div>
                    <h3 class="${colorClass}">${sign}${formatCurrency(tx.amount)}</h3>
                </div>
            `;
        });
    } catch(e) { console.error("Error loading tx", e); }
}

function calculateWaste() {
    const harvestStr = document.getElementById('calc-harvest').value;
    const ratioStr = document.getElementById('calc-crop').value;
    if(!harvestStr || !ratioStr) return;
    const harvestMT = parseFloat(harvestStr);
    const ratio = parseFloat(ratioStr);
    
    if (isNaN(harvestMT) || harvestMT <= 0) {
        document.getElementById('calc-waste-out').innerText = "0 MT";
        document.getElementById('calc-earn-out').innerText = "₹0";
        return;
    }
    const estimatedWaste = harvestMT * ratio;
    const potentialEarnings = estimatedWaste * 2150;
    
    document.getElementById('calc-waste-out').innerText = estimatedWaste.toFixed(1) + " MT";
    document.getElementById('calc-earn-out').innerText = formatCurrency(potentialEarnings);
}

// 2. Buyer Dashboard
async function loadBuyerDashboard() {
    try {
        const res = await fetch(`${API_BASE}/buyer/B1/dashboard`);
        const data = await res.json();
        
        document.getElementById('buyer-name').innerText = data.name;
        document.getElementById('buyer-company').innerText = data.company;
        document.getElementById('buyer-location').innerText = data.location;
        document.getElementById('buyer-outstanding').innerText = formatCurrency(data.outstanding);
        document.getElementById('b-total-mt').innerText = data.current_order_mt;
        
        const nextInfo = document.getElementById('next-delivery-info');
        if (data.next_delivery) {
            nextInfo.innerHTML = `
                <h4 style="color:white">Order #${data.next_delivery.id}</h4>
                <p style="color:var(--text-light)">${data.next_delivery.quantity} MT - ${data.next_delivery.pellet}</p>
                <h3 class="neon-text-blue" style="margin-top:0.5rem">${data.next_delivery.status}</h3>
            `;
        } else {
            nextInfo.innerHTML = `<p style="color:var(--text-light)">No active deliveries.</p>`;
        }
    } catch(e) { console.error("Error loading buyer dash", e); }
}

function calculateOrderCost() {
    const qtyStr = document.getElementById('order-qty').value;
    const qty = parseFloat(qtyStr);
    if (isNaN(qty) || qty <= 0) {
        document.getElementById('order-cost-out').innerText = "₹0";
        return;
    }
    const estimatedCost = qty * 6000;
    document.getElementById('order-cost-out').innerText = formatCurrency(estimatedCost);
}

async function placeOrder() {
    const pellet = document.getElementById('order-pellet').value;
    const qty = parseFloat(document.getElementById('order-qty').value);
    const dest = document.getElementById('order-dest').value;
    const statusText = document.getElementById('order-status');

    if (isNaN(qty) || qty <= 0 || !dest) {
        statusText.innerText = "Provide valid qty and dest.";
        statusText.style.color = "var(--neon-red)";
        return;
    }

    statusText.innerText = "Placing order...";
    statusText.style.color = "var(--neon-blue)";

    try {
        const payload = { buyer: "Arjun Industries", pellet, quantity: qty, destination: dest, date: new Date().toISOString().split('T')[0] };
        const res = await fetch(`${API_BASE}/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        
        if (res.ok) {
            statusText.innerText = `✅ Order ${data.order_id} Placed!`;
            statusText.style.color = "var(--neon-green)";
            setTimeout(() => { statusText.innerText = ""; loadBuyerDashboard(); }, 1500);
        }
    } catch (e) {
        statusText.innerText = `❌ Error`;
        statusText.style.color = "var(--neon-red)";
    }
}

// Payment Modal Logic
function openPaymentModal() { document.getElementById('payment-modal').classList.add('active'); document.getElementById('payment-status').innerText = ""; }
function closePaymentModal() { document.getElementById('payment-modal').classList.remove('active'); }

async function processPayment(method) {
    const statusText = document.getElementById('payment-status');
    statusText.innerText = `Processing via ${method}...`;
    statusText.style.color = "var(--neon-blue)";
    try {
        const res = await fetch(`${API_BASE}/payments`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: "GA1256", amount: 120000, method })
        });
        const data = await res.json();
        if (res.ok) {
            statusText.innerText = `✅ Txn ID: ${data.txn_id}`;
            statusText.style.color = "var(--neon-green)";
            setTimeout(() => { closePaymentModal(); loadBuyerDashboard(); loadTransactions(); }, 1500);
        }
    } catch (e) { statusText.innerText = `❌ Error`; statusText.style.color = "var(--neon-red)"; }
}

// 3. Tracking View
async function loadTracking() {
    try {
        // Pickups
        const trackPickups = document.getElementById('tracking-pickups');
        trackPickups.innerHTML = '';
        const resP = await fetch(`${API_BASE}/pickups/PKP001/track`);
        if (resP.ok) {
            const data = await resP.json();
            trackPickups.innerHTML += `
                <div class="tracking-card">
                    <div class="tracking-header">
                        <h4>Pickup #${data.id} <span style="margin-left:1rem; color:var(--neon-blue)">${data.material}</span></h4>
                        <span>${data.location}</span>
                    </div>
                    ${renderStepper(data.steps, data.current_step)}
                </div>
            `;
        }
        
        // Deliveries
        const trackDeliveries = document.getElementById('tracking-deliveries');
        trackDeliveries.innerHTML = '';
        const resO = await fetch(`${API_BASE}/orders/GA1256/track`);
        if (resO.ok) {
            const data = await resO.json();
            trackDeliveries.innerHTML += `
                <div class="tracking-card">
                    <div class="tracking-header">
                        <h4>Order #${data.id} <span style="margin-left:1rem; color:var(--neon-purple)">${data.pellet}</span></h4>
                        <span>To: ${data.destination}</span>
                    </div>
                    ${renderStepper(data.steps, data.current_step)}
                </div>
            `;
        }
    } catch(e) { console.error(e); }
}

// 4. Impact
async function loadImpact() {
    try {
        const res = await fetch(`${API_BASE}/impact`);
        const data = await res.json();
        document.getElementById('impact-stats').innerHTML = `
            <div class="stat-card glass-panel neon-border">
                <div class="icon neon-blue"><i class='bx bx-leaf'></i></div>
                <div><p>Straw Recycled</p><h3>${data.total_straw_mt} MT</h3></div>
            </div>
            <div class="stat-card glass-panel neon-border">
                <div class="icon neon-green"><i class='bx bx-cloud'></i></div>
                <div><p>CO2 Reduced</p><h3>${data.co2_reduced_tons} Tons</h3></div>
            </div>
            <div class="stat-card glass-panel neon-border">
                <div class="icon neon-red"><i class='bx bxs-hot'></i></div>
                <div><p>Fires Prevented</p><h3>${data.stubble_burning_prevented}</h3></div>
            </div>
            <div class="stat-card glass-panel neon-border">
                <div class="icon neon-purple"><i class='bx bx-group'></i></div>
                <div><p>Farmers</p><h3>${data.farmers_impacted}</h3></div>
            </div>
        `;
    } catch(e) {}
}

// Notifications Panel
function toggleNotifications() {
    const panel = document.getElementById('notifications-panel');
    panel.classList.toggle('open');
    
    if(panel.classList.contains('open')) {
        const list = document.getElementById('notif-list');
        list.innerHTML = `
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
                <h4 style="color:var(--eco-gold)">Quality Report</h4>
                <p style="margin-bottom:0.3rem">Order GA1256 meets Grade A specifications.</p>
                <span style="font-size:0.75rem; color:var(--text-light)">1 day ago</span>
            </div>
        `;
    }
}

// Market Price Trends Chart
function initCharts() {
    const chartConfig = {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [
                {
                    label: 'Wheat Straw (₹/MT)',
                    data: [1950, 1980, 2050, 2100, 2080, 2150],
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4, fill: true
                },
                {
                    label: 'Rice Straw (₹/MT)',
                    data: [1800, 1850, 1820, 1900, 1920, 1950],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4, fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#e2e8f0' } }
            },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
            }
        }
    };

    const ctx = document.getElementById('adminMarketChart');
    if(ctx) new Chart(ctx, chartConfig);
}

// Location Autocomplete System
function initAutocomplete() {
    const input = document.getElementById("order-dest");
    if (!input) return;
    
    const indianCities = [
        "Ahmedabad, Gujarat", "Surat, Gujarat", "Vadodara, Gujarat", "Rajkot, Gujarat", 
        "Bhavnagar, Gujarat", "Jamnagar, Gujarat", "Ankleshwar, Gujarat", "Vapi, Gujarat", 
        "Gandhinagar, Gujarat", "Mumbai, Maharashtra", "Pune, Maharashtra", "Nagpur, Maharashtra",
        "Nashik, Maharashtra", "Delhi", "New Delhi", "Gurugram, Haryana", "Noida, UP",
        "Bengaluru, Karnataka", "Mysuru, Karnataka", "Chennai, Tamil Nadu", "Coimbatore, Tamil Nadu",
        "Hyderabad, Telangana", "Kolkata, West Bengal", "Jaipur, Rajasthan", "Indore, MP",
        "Bhopal, MP", "Ludhiana, Punjab", "Chandigarh", "Patna, Bihar", "Lucknow, UP", "Kanpur, UP"
    ];

    new Awesomplete(input, {
        list: indianCities,
        minChars: 1,
        autoFirst: true
    });
}

window.onload = () => {
    changeLanguage('en');
    calculateWaste();
    calculateOrderCost();
    initCharts();
    initAutocomplete();
};
