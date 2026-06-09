// Global admin config variables
const adminToken = localStorage.getItem('token') || '';
const adminRole = localStorage.getItem('role') || '';
const currentAdminUsername = localStorage.getItem('username') || '';

const API_BASE = window.location.port && window.location.port !== '5000'
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : window.location.origin;

// References to live instantiated charts to prevent layout duplicates
let rocChartInstance = null;
let riskChartInstance = null;
let importanceChartInstance = null;
let matrixChartInstance = null;

let adminMetricsCached = null;
let currentMetricsView = 'upi';

window.switchAdminMetricsView = function(view) {
    currentMetricsView = view;
    renderPerformanceMetrics();
};

function renderPerformanceMetrics() {
    if (!adminMetricsCached) return;
    
    const mp = currentMetricsView === 'credit_card' 
        ? (adminMetricsCached.model_performance_cc || {}) 
        : (adminMetricsCached.model_performance_upi || {});
        
    document.getElementById('sys-accuracy').innerText = `${(mp.accuracy * 100 || 75.0).toFixed(1)}%`;
    document.getElementById('sys-p-r').innerText = `${(mp.precision * 100 || 30.0).toFixed(1)}% / ${(mp.recall * 100 || 30.0).toFixed(1)}%`;
    document.getElementById('sys-auc').innerText = (mp.auc || 0.70).toFixed(2);
    document.getElementById('sys-fraud').innerText = `${adminMetricsCached.fraud_detected_pct || 0}%`;
    
    initCharts(adminMetricsCached);
}

// Custom Drag and Drop and UI utilities
window.triggerFileInput = function(id) {
    document.getElementById(id).click();
};

window.handleCSVSelect = function() {
    const input = document.getElementById('csv-file-input');
    const info = document.getElementById('file-info-csv');
    const dropzone = document.getElementById('dropzone-csv');
    
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

function setupCSVDragAndDrop() {
    const el = document.getElementById('dropzone-csv');
    const input = document.getElementById('csv-file-input');
    if (!el || !input) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        el.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

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

    el.addEventListener('drop', e => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            input.files = files;
            window.handleCSVSelect();
        }
    }, false);
}

document.addEventListener('DOMContentLoaded', () => {
    // Check authorization
    if (!adminToken || adminRole !== 'admin') {
        alert('Forbidden: Admin access required.');
        window.location.href = 'index.html';
        return;
    }

    // Default view setup
    switchAdminTab('analytics');
    setupCSVDragAndDrop();
});

// Admin Tab View management switcher
function switchAdminTab(tab) {
    const tabs = document.querySelectorAll('.admin-panel-tab');
    const links = document.querySelectorAll('.tab-link');

    tabs.forEach(t => t.style.display = 'none');
    links.forEach(l => l.classList.remove('active'));

    const tabMap = {
        'analytics': { id: 'tab-analytics', index: 0, load: fetchAdminMetricsAndLoadVisuals },
        'transactions': { id: 'tab-transactions', index: 1, load: fetchAdminTransactions },
        'users': { id: 'tab-users', index: 2, load: fetchAdminUsers },
        'train': { id: 'tab-train', index: 3 },
        'upload': { id: 'tab-upload', index: 4 },
        'audit': { id: 'tab-audit', index: 5, load: fetchAdminAuditLogs },
        'reset': { id: 'tab-reset', index: 6 }
    };

    const target = tabMap[tab];
    if (target) {
        const el = document.getElementById(target.id);
        if (el) el.style.display = 'block';
        if (links[target.index]) links[target.index].classList.add('active');
        if (target.load) {
            target.load();
        }
        if (tab === 'reset') {
            const resetUsernameInput = document.getElementById('admin-new-username');
            if (resetUsernameInput) {
                resetUsernameInput.value = localStorage.getItem('username') || 'admin';
            }
        }
    }
}

// Global alert popup utility
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

// Signs out administrative session
function handleLogout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

async function apiFetch(url, options = {}) {
    const response = await fetch(url, options);
    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        if (!response.ok) {
            throw new Error(`Server Error (${response.status}): ${text.substring(0, 80)}`);
        }
        throw new Error('Invalid response from server');
    }
    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }
    return data;
}

// ==================== ANALYTICS & METRICS TAB ====================
async function fetchAdminMetricsAndLoadVisuals() {
    try {
        const data = await apiFetch(`${API_BASE}/api/admin/metrics`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        adminMetricsCached = data;
        renderPerformanceMetrics();
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}

// Complete visualizations rendering function via Chart.js CDN
function initCharts(data) {
    const mp = currentMetricsView === 'credit_card' 
        ? (data.model_performance_cc || {}) 
        : (data.model_performance_upi || {});
        
    let rd = currentMetricsView === 'credit_card'
        ? (data.risk_distribution_cc || { Low: 0, Medium: 0, High: 0 })
        : (data.risk_distribution_upi || { Low: 0, Medium: 0, High: 0 });
        
    if ((rd.Low || 0) === 0 && (rd.Medium || 0) === 0 && (rd.High || 0) === 0) {
        rd = data.risk_distribution || { Low: 1, Medium: 0, High: 0 };
    }
    
    const gridColor = '#f1f5f9';
    const tickColor = '#64748b';
    const labelColor = '#0f172a';
    const activeBorderColor = '#ffffff';

    // 1. ROC & AUC Curve Chart
    const rocCtx = document.getElementById('rocCurveChart').getContext('2d');
    if (rocChartInstance) rocChartInstance.destroy();
    
    const rocLabels = mp.roc_curve && mp.roc_curve.fpr 
        ? mp.roc_curve.fpr 
        : [0, 0.1, 0.2, 0.35, 0.5, 0.65, 0.85, 1];
        
    const rocData = mp.roc_curve && mp.roc_curve.tpr 
        ? mp.roc_curve.tpr 
        : (currentMetricsView === 'credit_card' 
            ? [0, 0.35, 0.55, 0.7, 0.8, 0.88, 0.96, 1] 
            : [0, 0.28, 0.45, 0.6, 0.72, 0.81, 0.93, 1]);

    rocChartInstance = new Chart(rocCtx, {
        type: 'line',
        data: {
            labels: rocLabels,
            datasets: [
                {
                    label: 'True Positive Rate vs. False Positive Rate',
                    data: rocData,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.05)',
                    fill: true,
                    tension: 0.3,
                    borderWidth: 3
                },
                {
                    label: 'Random Guess Threshold',
                    data: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
                    borderColor: '#cbd5e1',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: tickColor } },
                y: { grid: { color: gridColor }, ticks: { color: tickColor } }
            },
            plugins: { legend: { labels: { color: labelColor } } }
        }
    });

    // 2. Risk Evaluation Pie Chart
    const riskCtx = document.getElementById('riskPieChart').getContext('2d');
    if (riskChartInstance) riskChartInstance.destroy();
    riskChartInstance = new Chart(riskCtx, {
        type: 'doughnut',
        data: {
            labels: ['Low Risk', 'Medium Risk', 'High Risk'],
            datasets: [{
                data: [rd.Low || 1, rd.Medium || 0, rd.High || 0],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderColor: [activeBorderColor, activeBorderColor, activeBorderColor],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: labelColor } } }
        }
    });

    // 3. Random Forest Feature Importance Chart
    const impCtx = document.getElementById('importanceChart').getContext('2d');
    if (importanceChartInstance) importanceChartInstance.destroy();
    
    let labels, impData;
    if (currentMetricsView === 'credit_card') {
        labels = ['Amount', 'Hour of Day', 'New Device Flag', 'Location Score', 'CVV Verification', 'Expiry Check', 'ZIP Verification', 'Velocity Risk'];
        impData = [0.22, 0.15, 0.10, 0.12, 0.18, 0.11, 0.08, 0.04];
    } else {
        labels = ['Amount', 'Hour of Day', 'New Device Flag', 'Location Score', 'Receipt Upload', 'QR Match', 'UTR Verification', 'UPI ID Risk'];
        impData = [0.25, 0.12, 0.08, 0.15, 0.10, 0.05, 0.12, 0.13];
    }
    
    importanceChartInstance = new Chart(impCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Normalized Feature Importance Score',
                data: impData,
                backgroundColor: ['#3b82f6', '#2563eb', '#6366f1', '#f43f5e', '#a855f7', '#ec4899', '#f97316', '#14b8a6'],
                borderWidth: 0,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: tickColor } },
                y: { grid: { display: false }, ticks: { color: labelColor } }
            },
            plugins: { legend: { display: false } }
        }
    });

    // 4. Matrix Evaluation Chart (Scatter / Confused Points)
    const matCtx = document.getElementById('matrixChart').getContext('2d');
    if (matrixChartInstance) matrixChartInstance.destroy();
    
    const matrixData = mp.confusion_matrix || 
        (currentMetricsView === 'credit_card' 
            ? [307, 1, 6, 86] 
            : [211, 4, 2, 183]);

    matrixChartInstance = new Chart(matCtx, {
        type: 'bar',
        data: {
            labels: ['True Negative', 'False Positive', 'False Negative', 'True Positive'],
            datasets: [{
                label: 'Classification Sample Units',
                data: matrixData,
                backgroundColor: ['#34d399', '#fcd34d', '#fca5a5', '#10b981'],
                borderColor: [activeBorderColor, activeBorderColor, activeBorderColor, activeBorderColor],
                borderWidth: 1,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { color: labelColor } },
                y: { grid: { color: gridColor }, ticks: { color: tickColor } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// Retrain model triggers
async function handleTrain(e) {
    e.preventDefault();
    const algorithm = document.getElementById('algorithm-selector').value;
    const btn = document.getElementById('btn-train');

    btn.disabled = true;
    btn.innerText = 'Retraining system weights...';

    try {
        const data = await apiFetch(`${API_BASE}/api/admin/model/train`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ algorithm })
        });

        showNotification(data.message || 'Model weights updated!');
        fetchAdminMetricsAndLoadVisuals();
    } catch (err) {
        showNotification(err.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Train & Update Model Now';
    }
}

// Clears transactions completely
async function wipeTransactions() {
    if (!confirm('Are you sure you want to delete all stored transaction data permanently?')) return;

    try {
        const data = await apiFetch(`${API_BASE}/api/admin/transactions/clear`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        showNotification('Historical evaluation data wiped out.');
        fetchAdminMetricsAndLoadVisuals();
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}

// ==================== USER MANAGEMENT TAB ====================
async function fetchAdminUsers() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/users`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch registered user base');
        }

        renderUsersTable(data);
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}

function renderUsersTable(users) {
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = '';

    if (!users || users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align:center; color: var(--text-secondary); padding:20px;">No registered users</td>
            </tr>
        `;
        return;
    }

    users.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong style="color:var(--text-primary)">${u.username}</strong></td>
            <td>
                <span class="badge ${u.role === 'admin' ? 'level-High' : 'level-Low'}">${u.role}</span>
            </td>
            <td>
                ${u.username === currentAdminUsername 
                    ? `<em style="color:var(--text-secondary)">Current User</em>`
                    : `<button class="btn btn-outline btn-danger" onclick="deleteUser('${u.username}')" style="padding:4px 10px; font-size:0.8rem">Delete</button>`
                }
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function handleAddUser(e) {
    e.preventDefault();
    const username = document.getElementById('new-user-username').value.trim();
    const password = document.getElementById('new-user-password').value.trim();
    const role = document.getElementById('new-user-role').value;

    try {
        const response = await fetch(`${API_BASE}/api/admin/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ username, password, role })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to add user account');
        }

        showNotification('User account successfully added!');
        document.getElementById('admin-user-form').reset();
        fetchAdminUsers();
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}

async function deleteUser(username) {
    if (!confirm(`Are you absolutely sure you want to delete user "${username}"?`)) return;

    try {
        const response = await fetch(`${API_BASE}/api/admin/users/${username}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to remove user account');
        }

        showNotification(`User account "${username}" removed.`);
        fetchAdminUsers();
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}

// ==================== SYSTEM AUDIT TAB ====================
async function fetchAdminAuditLogs() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/metrics`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch transaction metrics');
        }

        const tbody = document.querySelector('#audit-table tbody');
        tbody.innerHTML = '';

        const logs = data.audit_logs || [];
        if (logs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center; color: var(--text-secondary); padding:20px;">No recorded system actions yet.</td>
                </tr>
            `;
            return;
        }

        // Display newest logs first
        logs.reverse().forEach(l => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="color:var(--text-secondary); font-size:0.85rem">${new Date(l.timestamp).toLocaleString()}</td>
                <td><strong style="color:var(--primary-color)">${l.action}</strong></td>
                <td>${l.username || 'System'}</td>
                <td>
                    <span class="badge ${l.status === 'success' ? 'level-Low' : 'level-High'}">${l.status}</span>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}

// CSV File Upload Action Handler
async function handleCSVUpload(e) {
    e.preventDefault();
    const fileInput = document.getElementById('csv-file-input');
    if (!fileInput.files || fileInput.files.length === 0) return;

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
        const data = await apiFetch(`${API_BASE}/api/admin/datasets/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            },
            body: formData
        });

        showNotification(data.message || 'Dataset uploaded successfully!');
        document.getElementById('upload-csv-form').reset();
        fetchAdminMetricsAndLoadVisuals();
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}

// Admin Credentials Reset Handler
async function handleAdminCredentialsReset(e) {
    e.preventDefault();
    const newUsername = document.getElementById('admin-new-username').value.trim();
    const newPassword = document.getElementById('admin-new-password').value.trim();
    const btn = e.target.querySelector('button[type="submit"]');

    if (btn) btn.disabled = true;

    try {
        const response = await fetch(`${API_BASE}/api/admin/credentials/reset`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                username: newUsername,
                password: newPassword || undefined
            })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to update credentials');
        }

        showNotification('Administrator credentials updated successfully!');
        
        if (data.token) {
            localStorage.setItem('token', data.token);
        }
        if (data.username) {
            localStorage.setItem('username', data.username);
            // Refresh current variables
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            document.getElementById('admin-new-password').value = '';
        }
    } catch (err) {
        showNotification(err.message, 'danger');
    } finally {
        if (btn) btn.disabled = false;
    }
}

// ==================== ALL TRANSACTIONS TAB ====================
let allTransactionsCached = [];

async function fetchAdminTransactions() {
    try {
        const response = await fetch(`${API_BASE}/api/transactions`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch transaction logs');
        }

        allTransactionsCached = data || [];
        filterAdminTransactions();
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}

window.filterAdminTransactions = function() {
    const riskFilter = document.getElementById('filter-risk-level').value;
    const typeFilter = document.getElementById('filter-tx-type').value;
    const tbody = document.querySelector('#transactions-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let filtered = allTransactionsCached;
    if (riskFilter) {
        filtered = filtered.filter(t => t.risk_level === riskFilter);
    }
    if (typeFilter) {
        filtered = filtered.filter(t => t.tx_type === typeFilter);
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center; color: var(--text-secondary); padding:20px;">No transaction logs found matching filters.</td>
            </tr>
        `;
        return;
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    filtered.forEach(t => {
        const tr = document.createElement('tr');
        
        let riskClass = 'level-Low';
        if (t.risk_level === 'Medium') riskClass = 'level-Medium';
        if (t.risk_level === 'High') riskClass = 'level-High';

        const typeBadge = t.tx_type === 'upi' 
            ? `<span class="badge" style="background: rgba(37, 99, 235, 0.1); color: var(--primary-color); border: 1px solid rgba(37, 99, 235, 0.2);">UPI</span>`
            : `<span class="badge" style="background: rgba(139, 92, 246, 0.1); color: var(--accent-color); border: 1px solid rgba(139, 92, 246, 0.2);">CARD</span>`;

        let identifier = '';
        let reference = '';
        if (t.tx_type === 'upi') {
            identifier = t.upi_id || 'N/A';
            reference = t.utr_number || 'N/A';
        } else {
            identifier = t.cardholder_name || 'N/A';
            reference = t.card_number || 'N/A';
        }

        tr.innerHTML = `
            <td><strong style="color:var(--text-primary)">${t.username || 'System'}</strong></td>
            <td>${typeBadge}</td>
            <td><strong>$${(t.amount || 0).toFixed(2)}</strong></td>
            <td style="font-family: monospace; font-size: 0.9rem;">${identifier}</td>
            <td style="font-family: monospace; font-size: 0.9rem;">${reference}</td>
            <td><strong>${(t.risk_score || 0).toFixed(4)}</strong></td>
            <td><span class="badge ${riskClass}">${t.risk_level}</span></td>
            <td style="color:var(--text-secondary); font-size:0.85rem">${new Date(t.timestamp).toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
    });
};
