// Global Variables and states
let userToken = localStorage.getItem('token') || '';
let userRole = localStorage.getItem('role') || '';
let currentUsername = localStorage.getItem('username') || '';

const API_BASE = window.location.origin;

document.addEventListener('DOMContentLoaded', () => {
    initView();
    // Initialize wizard elements if the prediction form exists on the page
    if (document.getElementById('prediction-form')) {
        detectDeviceAndContext();
        setupDragAndDrop();
    }
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

// Action Handler - Request Password Reset
window.handleForgotPasswordRequest = async function(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    
    const btn = document.getElementById('btn-forgot-password');
    btn.disabled = true;
    btn.innerText = 'Sending...';

    try {
        const response = await fetch(`${API_BASE}/api/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to request password reset');
        }

        showNotification('Password reset instructions have been sent to ' + email, 'success');
        document.getElementById('forgot-email').value = '';
        switchAuthTab('login');
    } catch (err) {
        showNotification(err.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Send Reset Link';
    }
};

// Switch visual Auth Tabs
function switchAuthTab(tab) {
    const loginWrapper = document.getElementById('login-form-wrapper');
    const registerWrapper = document.getElementById('register-form-wrapper');
    const forgotWrapper = document.getElementById('forgot-password-form-wrapper');

    loginWrapper.style.display = 'none';
    registerWrapper.style.display = 'none';
    if (forgotWrapper) forgotWrapper.style.display = 'none';

    if (tab === 'login') {
        loginWrapper.style.display = 'block';
    } else if (tab === 'register') {
        registerWrapper.style.display = 'block';
        
        const step1 = document.getElementById('register-step-1');
        const step2 = document.getElementById('register-step-2');
        if (step1 && step2) {
            step1.style.display = 'block';
            step2.style.display = 'none';
        }
    } else if (tab === 'forgot') {
        if (forgotWrapper) forgotWrapper.style.display = 'block';
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

        // Reset dropzones visual state
        const dropzoneQr = document.getElementById('dropzone-qr');
        const dropzoneReceipt = document.getElementById('dropzone-receipt');
        if (dropzoneQr) {
            dropzoneQr.classList.remove('has-file');
            document.getElementById('file-info-qr').innerText = 'No file selected';
        }
        if (dropzoneReceipt) {
            dropzoneReceipt.classList.remove('has-file');
            document.getElementById('file-info-receipt').innerText = 'No file selected';
        }

        // Return user to Step 1 (Details) on wizard
        goToWizardStep(0);

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

// ==================== WIZARD FORM LOGIC ====================
let currentWizardStep = 0;

window.goToWizardStep = function(stepIndex) {
    // Only allow moving forward if current step is validated
    if (stepIndex > currentWizardStep) {
        for (let i = currentWizardStep; i < stepIndex; i++) {
            if (!validateStep(i)) return;
        }
    }
    
    // Update step visibility
    const steps = document.querySelectorAll('.wizard-step-panel');
    steps.forEach((panel, idx) => {
        if (idx === stepIndex) {
            panel.style.display = 'block';
            panel.classList.add('active');
        } else {
            panel.style.display = 'none';
            panel.classList.remove('active');
        }
    });

    // Update progress stepper visually
    const stepIndicators = document.querySelectorAll('.stepper-step');
    stepIndicators.forEach((indicator, idx) => {
        indicator.classList.remove('active', 'completed');
        if (idx === stepIndex) {
            indicator.classList.add('active');
        } else if (idx < stepIndex) {
            indicator.classList.add('completed');
        }
    });

    const lines = document.querySelectorAll('.stepper-line');
    lines.forEach((line, idx) => {
        line.classList.remove('active', 'completed');
        if (idx < stepIndex) {
            line.classList.add('completed');
        } else if (idx === stepIndex) {
            line.classList.add('active');
        }
    });

    // Update buttons in actions footer
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnPredict = document.getElementById('btn-predict');

    if (stepIndex === 0) {
        btnPrev.style.display = 'none';
        btnNext.style.display = 'block';
        btnPredict.style.display = 'none';
    } else if (stepIndex === 1) {
        btnPrev.style.display = 'block';
        btnNext.style.display = 'block';
        btnPredict.style.display = 'none';
    } else if (stepIndex === 2) {
        btnPrev.style.display = 'block';
        btnNext.style.display = 'none';
        btnPredict.style.display = 'block';
    }

    currentWizardStep = stepIndex;
};

window.nextWizardStep = function() {
    if (currentWizardStep < 2) {
        goToWizardStep(currentWizardStep + 1);
    }
};

window.prevWizardStep = function() {
    if (currentWizardStep > 0) {
        goToWizardStep(currentWizardStep - 1);
    }
};

function validateStep(stepIndex) {
    if (stepIndex === 0) {
        const amountInput = document.getElementById('tx-amount');
        if (!amountInput.value || parseFloat(amountInput.value) <= 0) {
            showNotification('Please enter a valid transaction amount.', 'danger');
            amountInput.focus();
            return false;
        }
    } else if (stepIndex === 1) {
        // Step 2 uploads are optional
        return true;
    } else if (stepIndex === 2) {
        const locationInput = document.getElementById('tx-location');
        if (!locationInput.value.trim()) {
            showNotification('Region/City is required.', 'danger');
            locationInput.focus();
            return false;
        }
        const deviceInput = document.getElementById('tx-device-name');
        if (!deviceInput.value.trim()) {
            showNotification('Device Identity is required.', 'danger');
            deviceInput.focus();
            return false;
        }
    }
    return true;
}

// Drag & Drop Area Click
window.triggerFileInput = function(id) {
    document.getElementById(id).click();
};

// File Selection Handler
window.handleFileSelect = function(type) {
    const inputId = type === 'qr' ? 'tx-qr-upload' : 'tx-receipt-upload';
    const dropzoneId = type === 'qr' ? 'dropzone-qr' : 'dropzone-receipt';
    const infoId = type === 'qr' ? 'file-info-qr' : 'file-info-receipt';
    
    const input = document.getElementById(inputId);
    const dropzone = document.getElementById(dropzoneId);
    const info = document.getElementById(infoId);
    
    if (input.files && input.files.length > 0) {
        const file = input.files[0];
        info.innerText = `${file.name} (${formatBytes(file.size)})`;
        dropzone.classList.add('has-file');
    } else {
        info.innerText = 'No file selected';
        dropzone.classList.remove('has-file');
    }
};

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Set up drag-and-drop file inputs
function setupDragAndDrop() {
    const dropzones = [
        { id: 'dropzone-qr', inputId: 'tx-qr-upload', type: 'qr' },
        { id: 'dropzone-receipt', inputId: 'tx-receipt-upload', type: 'receipt' }
    ];

    dropzones.forEach(zone => {
        const el = document.getElementById(zone.id);
        const input = document.getElementById(zone.inputId);
        if (!el || !input) return;

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            el.addEventListener(eventName, e => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // Add visual styles on dragover
        ['dragenter', 'dragover'].forEach(eventName => {
            el.addEventListener(eventName, () => {
                el.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            el.addEventListener(eventName, () => {
                el.classList.remove('dragover');
            }, false);
        });

        // Handle dropped files
        el.addEventListener('drop', e => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                input.files = files;
                handleFileSelect(zone.type);
            }
        }, false);
    });
}

// Hour dynamic label display
window.updateHourLabel = function(val) {
    const display = document.getElementById('hour-readout');
    const hour = parseInt(val);
    if (hour === 0) {
        display.innerText = '12:00 AM (Midnight)';
    } else if (hour === 12) {
        display.innerText = '12:00 PM (Noon)';
    } else if (hour > 12) {
        display.innerText = `${hour - 12}:00 PM`;
    } else {
        display.innerText = `${hour}:00 AM`;
    }
};

// Sync with actual client time
window.syncCurrentHour = function() {
    const currentHour = new Date().getHours();
    const slider = document.getElementById('tx-hour');
    if (slider) {
        slider.value = currentHour;
        updateHourLabel(currentHour);
        showNotification('Synchronized to current device time.');
    }
};

// Location Risk slider label updates
window.updateLocRiskLabel = function(val) {
    const score = parseFloat(val);
    const display = document.getElementById('loc-risk-readout');
    if (!display) return;
    display.innerText = score.toFixed(2);
    
    if (score < 0.3) {
        display.style.background = '#fee2e2';
        display.style.color = 'var(--danger-color)';
    } else if (score <= 0.7) {
        display.style.background = '#fef3c7';
        display.style.color = 'var(--warning-color)';
    } else {
        display.style.background = '#d1fae5';
        display.style.color = 'var(--success-color)';
    }
};

// Device risk segmented toggles updater
window.updateDeviceRisk = function(val) {
    const hiddenInput = document.getElementById('tx-device-risk');
    if (hiddenInput) {
        hiddenInput.value = val;
    }
};

// Autofill/Auto-detect device metadata
function detectDeviceAndContext() {
    // 1. Detect browser user agent and set Device Identity
    const deviceInput = document.getElementById('tx-device-name');
    if (deviceInput && !deviceInput.value) {
        const ua = navigator.userAgent;
        let device = "Desktop PC";
        if (/android/i.test(ua)) device = "Android Mobile";
        else if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) device = "iOS Device";
        else if (/Macintosh/i.test(ua)) device = "macOS Workstation";
        else if (/Linux/i.test(ua)) device = "Linux Workstation";
        else if (/Windows/i.test(ua)) device = "Windows PC";
        
        let browser = "Browser";
        if (ua.indexOf("Firefox") > -1) browser = "Firefox";
        else if (ua.indexOf("SamsungBrowser") > -1) browser = "Samsung Browser";
        else if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) browser = "Opera";
        else if (ua.indexOf("Trident") > -1) browser = "Internet Explorer";
        else if (ua.indexOf("Edge") > -1 || ua.indexOf("Edg") > -1) browser = "Edge";
        else if (ua.indexOf("Chrome") > -1) browser = "Chrome";
        else if (ua.indexOf("Safari") > -1) browser = "Safari";
        
        deviceInput.value = `${device} (${browser})`;
    }

    // 2. Set Hour slider default value to current hour
    const hourSlider = document.getElementById('tx-hour');
    if (hourSlider) {
        const currentHour = new Date().getHours();
        hourSlider.value = currentHour;
        updateHourLabel(currentHour);
    }
    
    // 3. Set Location Trust default
    const locSlider = document.getElementById('tx-loc-risk');
    if (locSlider) {
        updateLocRiskLabel(locSlider.value);
    }

    // 4. Default simulated city/region if empty
    const locInput = document.getElementById('tx-location');
    if (locInput && !locInput.value) {
        locInput.value = "San Francisco, USA";
    }
}
