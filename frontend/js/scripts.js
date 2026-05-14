// Global Variables and states
let userToken = localStorage.getItem('token') || '';
let userRole = localStorage.getItem('role') || '';
let currentUsername = localStorage.getItem('username') || '';

const API_BASE = window.location.origin;

document.addEventListener('DOMContentLoaded', () => {
    initView();
});

// Toggle password visibility
window.togglePasswordVisibility = function(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (input.type === 'password') {
        input.type = 'text';
        icon.name = 'eye-off-outline';
    } else {
        input.type = 'password';
        icon.name = 'eye-outline';
    }
};

// Switch visual Auth Tabs
function switchAuthTab(tab) {
    const loginWrapper = document.getElementById('login-form-wrapper');
    const registerWrapper = document.getElementById('register-form-wrapper');

    if (tab === 'login') {
        loginWrapper.style.display = 'block';
        registerWrapper.style.display = 'none';
    } else {
        loginWrapper.style.display = 'none';
        registerWrapper.style.display = 'block';
        
        const step1 = document.getElementById('register-step-1');
        const step2 = document.getElementById('register-step-2');
        if (step1 && step2) {
            step1.style.display = 'block';
            step2.style.display = 'none';
        }
    }
}

// Global initialization router handler
function initView() {
    const authPanel = document.getElementById('auth-panel');
    const dashboardPanel = document.getElementById('dashboard-panel');
    const navActions = document.getElementById('nav-actions');

    if (!userToken) {
        // Logged out View setup
        authPanel.style.display = 'block';
        dashboardPanel.style.display = 'none';
        navActions.innerHTML = `
            <span style="color: var(--text-secondary); font-size: 0.9rem;">Secured System</span>
        `;
    } else {
        // Logged In View setup
        authPanel.style.display = 'none';
        dashboardPanel.style.display = 'block';
        navActions.innerHTML = `
            <span style="color: var(--text-primary); font-size: 0.95rem; font-weight:600; display:flex; align-items:center; gap:8px">
                <ion-icon name="person-circle-outline"></ion-icon> ${currentUsername}
            </span>
            <button class="btn btn-outline" onclick="handleLogout()" style="padding: 6px 14px; font-size:0.85rem">Sign Out</button>
        `;

        // Load specific dashboard parts or setup buttons
        if (userRole === 'admin') {
            document.getElementById('admin-redirect-btn-wrapper').innerHTML = `
                <a href="admin.html" class="btn btn-primary">
                    <ion-icon name="speedometer-outline"></ion-icon> Open Admin Dashboard
                </a>
            `;
        } else {
            document.getElementById('admin-redirect-btn-wrapper').innerHTML = ``;
        }

        fetchTransactions();
    }
}

// Alert utility function
function showNotification(msg, type = 'success') {
    const cont = document.getElementById('alert-container');
    const alertBox = document.createElement('div');
    alertBox.className = `alert-popup glass level-${type === 'success' ? 'Low' : type === 'warning' ? 'Medium' : 'High'}`;
    alertBox.style.background = type === 'success' ? '#ecfdf5' : type === 'warning' ? '#fffbeb' : '#fef2f2';
    alertBox.style.color = type === 'success' ? 'var(--success-color)' : type === 'warning' ? 'var(--warning-color)' : 'var(--danger-color)';
    alertBox.innerHTML = `
        <ion-icon name="${type === 'success' ? 'checkmark-circle-outline' : type === 'warning' ? 'alert-outline' : 'close-circle-outline'}"></ion-icon>
        <span>${msg}</span>
    `;
    cont.appendChild(alertBox);
    setTimeout(() => alertBox.remove(), 4000);
}

// Action Handler - Request OTP for Register
async function handleRegisterRequest(e) {
    e.preventDefault();
    
    // Intercept if in Step 2 (user pressed Enter in OTP field)
    const step1 = document.getElementById('register-step-1');
    if (step1 && step1.style.display === 'none') {
        return handleRegisterVerify(e);
    }

    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    const confirmPassword = document.getElementById('reg-password-confirm').value.trim();

    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'danger');
        return;
    }

    const btn = document.getElementById('btn-request-otp');
    btn.disabled = true;
    btn.innerText = 'Sending...';

    try {
        const response = await fetch(`${API_BASE}/api/register/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password, role: 'user' })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to request OTP');
        }

        showNotification('Verification code sent to your email!');
        document.getElementById('register-step-1').style.display = 'none';
        document.getElementById('register-step-2').style.display = 'block';
    } catch (err) {
        showNotification(err.message, 'danger');
        btn.disabled = false;
        btn.innerText = 'Send Verification Code';
    }
}

// Action Handler - Verify OTP & Register
async function handleRegisterVerify(e) {
    if (e) e.preventDefault();
    const email = document.getElementById('reg-email').value.trim();
    const otp = document.getElementById('reg-otp').value.trim();

    const btn = document.getElementById('btn-verify-otp');
    btn.disabled = true;
    btn.innerText = 'Verifying...';

    try {
        const response = await fetch(`${API_BASE}/api/register/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to verify OTP');
        }

        showNotification('Registered successfully! Now sign in.');
        
        // Reset form state
        document.getElementById('register-step-1').style.display = 'block';
        document.getElementById('register-step-2').style.display = 'none';
        document.getElementById('reg-username').value = '';
        document.getElementById('reg-email').value = '';
        document.getElementById('reg-password').value = '';
        document.getElementById('reg-password-confirm').value = '';
        document.getElementById('reg-otp').value = '';
        const reqBtn = document.getElementById('btn-request-otp');
        if (reqBtn) {
            reqBtn.disabled = false;
            reqBtn.innerText = 'Send Verification Code';
        }
        
        switchAuthTab('login');
    } catch (err) {
        showNotification(err.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Verify & Create Account';
    }
}

// Action Handler - Authentication Login
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    try {
        const response = await fetch(`${API_BASE}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to login');
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        localStorage.setItem('username', data.username);

        userToken = data.token;
        userRole = data.role;
        currentUsername = data.username;

        showNotification(`Welcome back, ${data.username}!`);
        
        // Auto-redirect admin directly to admin dashboard
        if (data.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            initView();
        }
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}

// Action Handler - Sign Out
function handleLogout() {
    localStorage.clear();
    userToken = '';
    userRole = '';
    currentUsername = '';
    window.location.reload();
}

// Transaction list loader & API consumer
async function fetchTransactions() {
    if (!userToken) return;
    const filterLevel = document.getElementById('filter-level').value;

    try {
        const response = await fetch(`${API_BASE}/api/transactions?risk_level=${filterLevel}`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load evaluation history');
        }

        renderTransactionsTable(data);
        computeUserMetrics(data);
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}

// DOM Rendering function for Transactions
function renderTransactionsTable(transactions) {
    const tbody = document.querySelector('#tx-table tbody');
    tbody.innerHTML = '';

    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; color:var(--text-secondary); padding: 30px;">
                    No transactions evaluated yet.
                </td>
            </tr>
        `;
        return;
    }

    transactions.forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>$${parseFloat(t.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td>${t.utr_number ? t.utr_number : '<span style="color:#aaa">None</span>'}</td>
            <td>${t.upi_id ? t.upi_id : '<span style="color:#aaa">None</span>'}</td>
            <td><strong style="color:var(--primary-color)">${t.risk_score}</strong></td>
            <td>
                <span class="badge level-${t.risk_level}">${t.risk_level} Risk</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Update dashboard metrics numbers
function computeUserMetrics(transactions) {
    if (!transactions) return;
    const total = transactions.length;
    const high = transactions.filter(t => t.risk_level === 'High').length;
    const rate = total > 0 ? ((high / total) * 100).toFixed(1) : '0';

    document.getElementById('user-total-tx').innerText = total;
    document.getElementById('user-high-tx').innerText = high;
    document.getElementById('user-risk-rate').innerText = `${rate}%`;
}

// Add transaction and submit prediction
async function handlePrediction(e) {
    e.preventDefault();
    const amount = document.getElementById('tx-amount').value;
    const utr_number = document.getElementById('tx-utr').value;
    const upi_id = document.getElementById('tx-upi').value;
    const qr_upload = document.getElementById('tx-qr-upload').files.length > 0;
    const receipt_upload = document.getElementById('tx-receipt-upload').files.length > 0;
    
    const has_receipt = receipt_upload ? 1 : 0;
    const qr_verified = qr_upload ? 1 : 0;
    const utr_valid = utr_number.length >= 8 ? 1 : 0;
    const upi_id_risk = upi_id.toLowerCase().includes('spam') ? 0.9 : 0.1;

    const hour_of_day = document.getElementById('tx-hour').value;
    const device_risk = document.getElementById('tx-device-risk').value;
    const location_risk = document.getElementById('tx-loc-risk').value;
    const location = document.getElementById('tx-location').value;
    const device_name = document.getElementById('tx-device-name').value;

    const btn = document.getElementById('btn-predict');
    btn.disabled = true;
    btn.innerText = 'Analyzing with ML Model...';

    try {
        const response = await fetch(`${API_BASE}/api/predict`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({ amount, utr_number, upi_id, has_receipt, qr_verified, utr_valid, upi_id_risk, hour_of_day, device_risk, location_risk, location, device_name })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to complete prediction');
        }

        showNotification('Transaction score predicted and recorded!');
        
        // Output prediction visualization
        const resultPanel = document.getElementById('prediction-result');
        document.getElementById('pred-res-score').innerText = parseFloat(data.score).toFixed(4);
        
        const badge = document.getElementById('pred-res-level-badge');
        badge.className = `prediction-badge level-${data.risk_level}`;
        badge.innerText = `${data.risk_level} Risk`;
        resultPanel.style.display = 'block';

        // Clear only non-reusable inputs
        document.getElementById('tx-amount').value = '';
        document.getElementById('tx-utr').value = '';
        document.getElementById('tx-upi').value = '';
        document.getElementById('tx-qr-upload').value = '';
        document.getElementById('tx-receipt-upload').value = '';

        // Reload data
        fetchTransactions();
    } catch (err) {
        showNotification(err.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Run Machine Learning Prediction';
    }
}

// Function to open the mobile camera for scanning
window.simulateScan = function(type) {
    let inputId = type === 'QR Code' ? 'tx-qr-upload' : 'tx-receipt-upload';
    const input = document.getElementById(inputId);
    
    // Temporarily add capture="environment" to force the back camera on mobile devices
    input.setAttribute('capture', 'environment');
    
    // Trigger the file picker which will now open the camera directly
    input.click();
    
    // Remove the capture attribute after a short delay so the normal file upload button still allows gallery choice
    setTimeout(() => {
        input.removeAttribute('capture');
    }, 1000);
}
