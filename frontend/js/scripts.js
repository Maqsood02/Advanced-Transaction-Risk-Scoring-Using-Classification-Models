// Global Variables and states
let userToken = localStorage.getItem('token') || '';
let userRole = localStorage.getItem('role') || '';
let currentUsername = localStorage.getItem('username') || '';

const API_BASE = window.location.origin;

// Indian States and Districts Data Map
const indianStatesAndDistricts = {
    "Andhra Pradesh": ["Anantapur", "Chittoor", "East Godavari", "Guntur", "Krishna", "Kurnool", "Prakasam", "Srikakulam", "Sri Potti Sriramulu Nellore", "Visakhapatnam", "Vizianagaram", "West Godavari", "YSR Kadapa"],
    "Assam": ["Baksa", "Barpeta", "Biswanath", "Bongaigaon", "Cachar", "Charaideo", "Chirang", "Darrang", "Dhemaji", "Dhubri", "Dibrugarh", "Dima Hasao", "Goalpara", "Golaghat", "Hailakandi", "Hojai", "Jorhat", "Kamrup", "Kamrup Metropolitan", "Karbi Anglong", "Karimganj", "Kokrajhar", "Lakhimpur", "Majuli", "Morigaon", "Nagaon", "Nalbari", "Sivasagar", "Sonitpur", "South Salmara-Mankachar", "Tinsukia", "Udalguri", "West Karbi Anglong"],
    "Bihar": ["Araria", "Arwal", "Aurangabad", "Banka", "Begusarai", "Bhagalpur", "Bhojpur", "Buxar", "Darbhanga", "East Champaran", "Gaya", "Gopalganj", "Jamui", "Jehanabad", "Kaimur", "Katihar", "Khagaria", "Kishanganj", "Lakhisarai", "Madhepura", "Madhubani", "Munger", "Muzaffarpur", "Nalanda", "Nawada", "Patna", "Purnia", "Rohtas", "Saharsa", "Samastipur", "Saran", "Sheikhpura", "Sheohar", "Sitamarhi", "Siwan", "Supaul", "Vaishali", "West Champaran"],
    "Delhi": ["Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi", "North West Delhi", "Shahdara", "South Delhi", "South East Delhi", "South West Delhi", "West Delhi"],
    "Gujarat": ["Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha", "Bharuch", "Bhavnagar", "Botad", "Chhota Udepur", "Dahod", "Dang", "Devbhumi Dwarka", "Gandhinagar", "Gir Somnath", "Jamnagar", "Junagadh", "Kheda", "Kutch", "Mahisagar", "Mehsana", "Morbi", "Narmada", "Navsari", "Panchmahal", "Patan", "Porbandar", "Rajkot", "Sabarkantha", "Surat", "Surendranagar", "Tapi", "Vadodara", "Valsad"],
    "Haryana": ["Ambala", "Bhiwani", "Charkhi Dadri", "Faridabad", "Fatehabad", "Gurugram", "Hisar", "Jhajjar", "Jind", "Kaithal", "Karnal", "Kurukshetra", "Mahendragarh", "Nuh", "Palwal", "Panchkula", "Panipat", "Rewari", "Rohtak", "Sirsa", "Sonipat", "Yamunanagar"],
    "Karnataka": ["Bagalkot", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban", "Bidar", "Chamarajanagar", "Chikkaballapur", "Chikkamagaluru", "Chitradurga", "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan", "Haveri", "Kalaburagi", "Kodagu", "Kolar", "Koppal", "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada", "Vijayapura", "Yadgir"],
    "Kerala": ["Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad"],
    "Madhya Pradesh": ["Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Rewa", "Satna", "Dhar", "Chhindwara", "Dewas", "Ratlam", "Hoshangabad", "Katni", "Singrauli", "Burhanpur", "Khandwa", "Morena", "Bhind"],
    "Maharashtra": ["Ahmednagar", "Akola", "Amravati", "Aurangabad", "Beed", "Bhandara", "Buldhana", "Chandrapur", "Dhule", "Gadchiroli", "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur", "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded", "Nandurbar", "Nashik", "Osmanabad", "Palghar", "Parbhani", "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara", "Sindhudurg", "Solapur", "Thane", "Wardha", "Washim", "Yavatmal"],
    "Punjab": ["Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib", "Fazilka", "Ferozepur", "Gurdaspur", "Hoshiarpur", "Jalandhar", "Kapurthala", "Ludhiana", "Mansa", "Moga", "Muktsar", "Pathankot", "Patiala", "Rupnagar", "Sahibzada Ajit Singh Nagar", "Sangrur", "Shahid Bhagat Singh Nagar", "Sri Muktsar Sahib", "Tarn Taran"],
    "Rajasthan": ["Ajmer", "Alwar", "Banswara", "Baran", "Barmer", "Bharatpur", "Bhilwara", "Bikaner", "Bundi", "Chittorgarh", "Churu", "Dausa", "Dholpur", "Dungarpur", "Hanumangarh", "Jaipur", "Jaisalmer", "Jalore", "Jhalawar", "Jhunjhunu", "Jodhpur", "Karauli", "Kota", "Nagaur", "Pali", "Pratapgarh", "Rajsamand", "Sawai Madhopur", "Sikar", "Sirohi", "Sri Ganganagar", "Tonk", "Udaipur"],
    "Tamil Nadu": ["Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram", "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram", "Virudhunagar"],
    "Telangana": ["Adilabad", "Bhadradri Kothagudem", "Hyderabad", "Jagtial", "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy", "Karimnagar", "Khammam", "Kumuram Bheem", "Mahabubabad", "Mahabubnagar", "Mancherial", "Medak", "Medchal–Malkajgiri", "Mulugu", "Nagarkurnool", "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli", "Rajanna Sircilla", "Rangareddy", "Sangareddy", "Siddipet", "Suryapet", "Vikarabad", "Wanaparthy", "Warangal Rural", "Warangal Urban", "Yadadri Bhuvanagiri"],
    "Uttar Pradesh": ["Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha", "Auraiya", "Ayodhya", "Azamgarh", "Baghpat", "Bahraich", "Ballia", "Balrampur", "Banda", "Bara Banki", "Bareilly", "Basti", "Bhadohi", "Bijnor", "Budaun", "Bulandshahr", "Chandauli", "Chitrakoot", "Deoria", "Etah", "Etawah", "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar", "Ghaziabad", "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur", "Hapur", "Hardoi", "Hathras", "Jalaun", "Jaunpur", "Jhansi", "Kannauj", "Kanpur Dehat", "Kanpur Nagar", "Kasganj", "Kaushambi", "Kheri", "Kushinagar", "Lalitpur", "Lucknow", "Maharajganj", "Mahoba", "Mainpuri", "Mathura", "Mau", "Meerut", "Mirzapur", "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh", "Prayagraj", "Rae Bareli", "Rampur", "Saharanpur", "Sambhal", "Sant Kabir Nagar", "Shahjahanpur", "Shamli", "Shrawasti", "Siddharthnagar", "Sitapur", "Sonbhadra", "Sultanpur", "Unnao", "Varanasi"],
    "West Bengal": ["Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur", "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram", "Kalimpong", "Kolkata", "Malda", "Murshidabad", "Nadia", "North 24 Parganas", "Paschim Bardhaman", "Paschim Medinipur", "Purba Bardhaman", "Purba Medinipur", "Purulia", "South 24 Parganas", "Uttar Dinajpur"]
};

// Populate States select element
window.populateStatesDropdown = function() {
    const stateSelect = document.getElementById('tx-state');
    if (!stateSelect) return;
    
    stateSelect.innerHTML = '<option value="">Select State</option>';
    
    Object.keys(indianStatesAndDistricts).sort().forEach(state => {
        const option = document.createElement('option');
        option.value = state;
        option.textContent = state;
        stateSelect.appendChild(option);
    });
};

// Populate Districts based on selected State
window.populateDistrictsDropdown = function(state) {
    const districtSelect = document.getElementById('tx-district');
    if (!districtSelect) return;
    
    districtSelect.innerHTML = '<option value="">Select District</option>';
    
    if (state && indianStatesAndDistricts[state]) {
        indianStatesAndDistricts[state].sort().forEach(district => {
            const option = document.createElement('option');
            option.value = district;
            option.textContent = district;
            districtSelect.appendChild(option);
        });
        districtSelect.disabled = false;
    } else {
        districtSelect.disabled = true;
    }
};

// Handle State Selection Change
window.handleStateChange = function() {
    const stateVal = document.getElementById('tx-state').value;
    populateDistrictsDropdown(stateVal);
    const locInput = document.getElementById('tx-location');
    if (locInput) {
        locInput.value = ''; // Reset combined location input until district is selected
    }
};

// Handle District Selection Change
window.handleDistrictChange = function() {
    const stateVal = document.getElementById('tx-state').value;
    const districtVal = document.getElementById('tx-district').value;
    const locInput = document.getElementById('tx-location');
    if (locInput) {
        if (stateVal && districtVal) {
            locInput.value = `${districtVal}, ${stateVal}`;
        } else {
            locInput.value = '';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initView();
    // Initialize wizard elements if the prediction form exists on the page
    if (document.getElementById('prediction-form')) {
        populateStatesDropdown();
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
            <td>₹${parseFloat(t.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
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
    const utr_valid = utr_number.length >= 8 ? 1 : 0;
    
    // Get the decoded QR Code text if uploaded
    const qr_code_text = document.getElementById('tx-qr-upload').dataset.upiUri || '';
    const qr_verified = qr_upload && document.getElementById('tx-qr-upload').dataset.valid === "true" ? 1 : 0;

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
            body: JSON.stringify({ amount, utr_number, upi_id, has_receipt, utr_valid, hour_of_day, device_risk, location_risk, location, device_name, qr_code_text, qr_verified })
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

        // Show evaluation history table card
        const historyCard = document.getElementById('evaluation-history-card');
        if (historyCard) {
            historyCard.style.display = 'block';
        }

        // Clear only non-reusable inputs
        document.getElementById('tx-amount').value = '';
        document.getElementById('tx-utr').value = '';
        document.getElementById('tx-upi').value = '';
        const qrUploadInput = document.getElementById('tx-qr-upload');
        if (qrUploadInput) {
            qrUploadInput.value = '';
            qrUploadInput.dataset.upiUri = '';
            qrUploadInput.dataset.valid = 'false';
        }
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

        // Validate optional UTR Number if entered (must be exactly 12 digits)
        const utrInput = document.getElementById('tx-utr');
        if (utrInput && utrInput.value.trim() !== "") {
            const utrVal = utrInput.value.trim();
            const utrRegex = /^\d{12}$/;
            if (!utrRegex.test(utrVal)) {
                showNotification('UTR Number must be exactly 12 digits.', 'danger');
                utrInput.focus();
                return false;
            }
        }

        // Validate optional UPI ID if entered (must be standard handle@provider format)
        const upiInput = document.getElementById('tx-upi');
        if (upiInput && upiInput.value.trim() !== "") {
            const upiVal = upiInput.value.trim();
            const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
            if (!upiRegex.test(upiVal)) {
                showNotification('Please enter a valid UPI ID (e.g. name@upi).', 'danger');
                upiInput.focus();
                return false;
            }
        }
    } else if (stepIndex === 1) {
        // Step 2 uploads are optional
        return true;
    } else if (stepIndex === 2) {
        const stateSelect = document.getElementById('tx-state');
        const districtSelect = document.getElementById('tx-district');
        if (!stateSelect || !stateSelect.value) {
            showNotification('Please select a State.', 'danger');
            if (stateSelect) stateSelect.focus();
            return false;
        }
        if (!districtSelect || !districtSelect.value) {
            showNotification('Please select a District/City.', 'danger');
            if (districtSelect) districtSelect.focus();
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
        
        if (type === 'qr') {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0, img.width, img.height);
                    
                    const imageData = ctx.getImageData(0, 0, img.width, img.height);
                    const code = jsQR(imageData.data, imageData.width, imageData.height);
                    
                    if (code) {
                        const qrText = code.data;
                        // Enforce that only valid UPI Payment QR codes (start with upi://pay) are accepted
                        if (qrText.startsWith("upi://pay?") || qrText.startsWith("upi://pay")) {
                            info.innerText = `${file.name} (Valid Payment QR)`;
                            dropzone.classList.add('has-file');
                            input.dataset.valid = "true";
                            input.dataset.upiUri = qrText;
                            
                            // Autofill the Merchant UPI ID if parsed
                            try {
                                const urlParams = new URLSearchParams(qrText.split('?')[1]);
                                const upiId = urlParams.get('pa');
                                if (upiId) {
                                    const upiField = document.getElementById('tx-upi');
                                    if (upiField) {
                                        upiField.value = upiId;
                                        showNotification('Autofilled UPI ID from payment QR code!', 'success');
                                    }
                                }
                            } catch (err) {
                                console.log("Failed to parse merchant UPI ID from QR parameters", err);
                            }
                        } else {
                            showNotification('Invalid QR: Image does not contain a valid UPI payment QR code (upi://pay).', 'danger');
                            input.value = '';
                            input.dataset.upiUri = '';
                            info.innerText = 'No file selected';
                            dropzone.classList.remove('has-file');
                            input.dataset.valid = "false";
                        }
                    } else {
                        showNotification('Invalid QR: Could not detect any QR code structure in the uploaded image.', 'danger');
                        input.value = '';
                        input.dataset.upiUri = '';
                        info.innerText = 'No file selected';
                        dropzone.classList.remove('has-file');
                        input.dataset.valid = "false";
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            info.innerText = `${file.name} (${formatBytes(file.size)})`;
            dropzone.classList.add('has-file');
        }
    } else {
        info.innerText = 'No file selected';
        dropzone.classList.remove('has-file');
        if (type === 'qr') {
            input.dataset.valid = "false";
            input.dataset.upiUri = '';
        }
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

// Hide Evaluation History panel
window.hideEvaluationHistory = function() {
    const card = document.getElementById('evaluation-history-card');
    if (card) {
        card.style.display = 'none';
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

    // 4. Default simulated state/district if empty
    const stateSelect = document.getElementById('tx-state');
    const districtSelect = document.getElementById('tx-district');
    const locInput = document.getElementById('tx-location');
    
    if (stateSelect && (!stateSelect.value || stateSelect.value === "")) {
        stateSelect.value = "Maharashtra";
        populateDistrictsDropdown("Maharashtra");
        if (districtSelect) {
            districtSelect.value = "Mumbai City";
        }
        if (locInput) {
            locInput.value = "Mumbai City, Maharashtra";
        }
    }
}
