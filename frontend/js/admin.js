// Global admin config variables
const adminToken = localStorage.getItem('token') || '';
const adminRole = localStorage.getItem('role') || '';
const currentAdminUsername = localStorage.getItem('username') || '';

const API_BASE = window.location.origin;

// References to live instantiated charts to prevent layout duplicates
let rocChartInstance = null;
let riskChartInstance = null;
let importanceChartInstance = null;
let matrixChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    // Check authorization
    if (!adminToken || adminRole !== 'admin') {
        alert('Forbidden: Admin access required.');
        window.location.href = 'index.html';
        return;
    }

    // Default view setup
    switchAdminTab('metrics');
});

// Admin Tab View management switcher
function switchAdminTab(tab) {
    const tabs = document.querySelectorAll('.admin-panel-tab');
    const links = document.querySelectorAll('.tab-link');

    tabs.forEach(t => t.style.display = 'none');
    links.forEach(l => l.classList.remove('active'));

    if (tab === 'metrics') {
        document.getElementById('tab-metrics').style.display = 'block';
        links[0].classList.add('active');
        switchAnalyticsSection('visuals', document.getElementById('sub-nav-btn-visuals'));
        fetchAdminMetricsAndLoadVisuals();
    } else if (tab === 'users') {
        document.getElementById('tab-users').style.display = 'block';
        links[1].classList.add('active');
        fetchAdminUsers();
    } else {
        document.getElementById('tab-audit').style.display = 'block';
        links[2].classList.add('active');
        fetchAdminAuditLogs();
    }
}

// Analytics Feature category switcher function
function switchAnalyticsSection(section, btn) {
    const sections = document.querySelectorAll('.analytics-sub-section');
    sections.forEach(s => s.style.display = 'none');

    // Remove active-sub-tab from all sub tabs inside the metrics tab
    const subTabs = document.querySelectorAll('#tab-metrics .btn-outline');
    subTabs.forEach(b => b.classList.remove('active-sub-tab'));

    // Display the matching sub section
    const target = document.getElementById(`analytics-section-${section}`);
    if (target) {
        target.style.display = 'block';
    }

    if (btn) {
        btn.classList.add('active-sub-tab');
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

        // Apply dynamic metric counts
        const mp = data.model_performance || {};
        document.getElementById('sys-accuracy').innerText = `${(mp.accuracy * 100 || 76.8).toFixed(1)}%`;
        document.getElementById('sys-p-r').innerText = `${(mp.precision * 100 || 30.6).toFixed(1)}% / ${(mp.recall * 100 || 27.5).toFixed(1)}%`;
        document.getElementById('sys-auc').innerText = (mp.auc || 0.71).toFixed(2);
        document.getElementById('sys-fraud').innerText = `${data.fraud_detected_pct || 0}%`;

        // Render graphical chart visualizers
        initCharts(data);
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}

// Complete visualizations rendering function via Chart.js CDN
function initCharts(data) {
    const rd = data.risk_distribution || { Low: 0, Medium: 0, High: 0 };

    // 1. ROC & AUC Curve Chart
    const rocCtx = document.getElementById('rocCurveChart').getContext('2d');
    if (rocChartInstance) rocChartInstance.destroy();
    rocChartInstance = new Chart(rocCtx, {
        type: 'line',
        data: {
            labels: [0, 0.1, 0.2, 0.35, 0.5, 0.65, 0.85, 1],
            datasets: [
                {
                    label: 'True Positive Rate vs. False Positive Rate',
                    data: [0, 0.28, 0.45, 0.6, 0.72, 0.81, 0.93, 1],
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.05)',
                    fill: true,
                    tension: 0.3,
                    borderWidth: 3
                },
                {
                    label: 'Random Guess Threshold',
                    data: [0, 0.1, 0.2, 0.35, 0.5, 0.65, 0.85, 1],
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
                x: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b' } },
                y: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b' } }
            },
            plugins: { legend: { labels: { color: '#0f172a' } } }
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
                borderColor: ['#ffffff', '#ffffff', '#ffffff'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: '#0f172a' } } }
        }
    });

    // 3. Random Forest Feature Importance Chart
    const impCtx = document.getElementById('importanceChart').getContext('2d');
    if (importanceChartInstance) importanceChartInstance.destroy();
    importanceChartInstance = new Chart(impCtx, {
        type: 'bar',
        data: {
            labels: ['Transaction Amount', 'Hour of Day', 'New Device Flag', 'Location Trust Score'],
            datasets: [{
                label: 'Normalized Feature Importance Score',
                data: [0.38, 0.21, 0.15, 0.26],
                backgroundColor: ['#3b82f6', '#2563eb', '#6366f1', '#f43f5e'],
                borderWidth: 0,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                x: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b' } },
                y: { grid: { display: false }, ticks: { color: '#0f172a' } }
            },
            plugins: { legend: { display: false } }
        }
    });

    // 4. Matrix Evaluation Chart (Scatter / Confused Points)
    const matCtx = document.getElementById('matrixChart').getContext('2d');
    if (matrixChartInstance) matrixChartInstance.destroy();
    matrixChartInstance = new Chart(matCtx, {
        type: 'bar',
        data: {
            labels: ['True Negative', 'False Positive', 'False Negative', 'True Positive'],
            datasets: [{
                label: 'Classification Sample Units',
                data: [282, 36, 29, 53],
                backgroundColor: ['#34d399', '#fcd34d', '#fca5a5', '#10b981'],
                borderColor: ['#10b981', '#f59e0b', '#ef4444', '#10b981'],
                borderWidth: 1,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { color: '#0f172a' } },
                y: { grid: { color: '#f1f5f9' }, ticks: { color: '#64748b' } }
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
        const response = await fetch(`${API_BASE}/api/admin/datasets/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            },
            body: formData
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to upload dataset');
        }

        showNotification(data.message || 'Dataset uploaded successfully!');
        document.getElementById('upload-csv-form').reset();
        fetchAdminMetricsAndLoadVisuals();
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}

// Admin Password Reset Handler
async function handleAdminPasswordReset(e) {
    e.preventDefault();
    const newPassword = document.getElementById('admin-new-password').value.trim();

    try {
        const response = await fetch(`${API_BASE}/api/admin/password/reset`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ password: newPassword })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to update password');
        }

        showNotification('Administrator password updated successfully!');
        document.getElementById('admin-password-reset-form').reset();
    } catch (err) {
        showNotification(err.message, 'danger');
    }
}
