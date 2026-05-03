import os
import sys
import jwt
import datetime
import bcrypt
import joblib
import pandas as pd
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# Add current path to sys.path to resolve local imports correctly
sys.path.append(os.path.dirname(__file__))

from security_aes import encrypt_field, decrypt_field
import db_mongo as db
import train_model

app = Flask(__name__, static_folder="../frontend", static_url_path="")
CORS(app)

JWT_SECRET = "atrsc_security_secret_key"

# ==================== Initial DB Seeding ====================
# Add default admin and user if not already existing
def seed_default_users():
    admin = db.find_user_by_username("admin")
    if not admin or "password" not in admin:
        hashed = bcrypt.hashpw("admin123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        if admin: db.delete_user_by_username("admin")
        db.add_user({"username": "admin", "password": hashed, "role": "admin"})
        
    user = db.find_user_by_username("user")
    if not user or "password" not in user:
        hashed = bcrypt.hashpw("user123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        if user: db.delete_user_by_username("user")
        db.add_user({"username": "user", "password": hashed, "role": "user"})

seed_default_users()

# ==================== AUTH DECORATOR ====================
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({"error": "Token is missing"}), 401
        try:
            if token.startswith("Bearer "):
                token = token.split(" ")[1]
            data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            current_user = db.find_user_by_username(data["username"])
            if not current_user:
                return jsonify({"error": "Invalid token user"}), 401
        except Exception as e:
            return jsonify({"error": "Invalid token", "details": str(e)}), 401
        return f(current_user, *args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({"error": "Token is missing"}), 401
        try:
            if token.startswith("Bearer "):
                token = token.split(" ")[1]
            data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            if data.get("role") != "admin":
                return jsonify({"error": "Forbidden. Admin access required."}), 403
            current_user = db.find_user_by_username(data["username"])
            if not current_user:
                return jsonify({"error": "Invalid token user"}), 401
        except Exception as e:
            return jsonify({"error": "Invalid token", "details": str(e)}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# ==================== AUTH ENDPOINTS ====================
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '').strip()
    role = data.get('role', 'user').strip() # Default role is user
    
    if role not in ["admin", "user"]:
        role = "user"
        
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
        
    existing = db.find_user_by_username(username)
    if existing:
        return jsonify({"error": "User already exists"}), 400
        
    hashed_pwd = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    new_user = {
        "username": username,
        "email": email,
        "password": hashed_pwd,
        "role": role
    }
    db.add_user(new_user)
    db.add_audit_log("User registration", username, "success")
    return jsonify({"message": "User successfully registered", "username": username}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400
        
    user = db.find_user_by_username(username)
    if not user:
        db.add_audit_log("Failed login attempt", username, "failed")
        return jsonify({"error": "Invalid username or password"}), 401
        
    if bcrypt.checkpw(password.encode('utf-8'), user["password"].encode('utf-8')):
        token = jwt.encode({
            "username": user["username"],
            "role": user["role"],
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, JWT_SECRET, algorithm="HS256")
        
        db.add_audit_log("Successful login", username, "success")
        
        # Email notification simulation
        email_to = user.get("email", "")
        print(f"[SIMULATION] Sending login alert email to {username} ({email_to if email_to else 'no email provided'})...")
        try:
            with open("mail_notifications.log", "a") as f:
                f.write(f"[{datetime.datetime.now().isoformat()}] User logged in: {username} ({email_to})\n")
        except Exception:
            pass
            
        return jsonify({
            "token": token,
            "role": user["role"],
            "username": user["username"]
        }), 200
        
    db.add_audit_log("Failed login attempt", username, "failed")
    return jsonify({"error": "Invalid username or password"}), 401

# ==================== TRANSACTION / RISK ENDPOINTS ====================
@app.route('/api/predict', methods=['POST'])
@token_required
def predict_risk(current_user):
    data = request.get_json() or {}
    
    # ML model inputs
    amount = float(data.get('amount', 0.0))
    hour_of_day = int(data.get('hour_of_day', 12))
    device_risk = int(data.get('device_risk', 0))
    location_risk = float(data.get('location_risk', 0.1))
    
    # Extra fields for AES encryption
    location = data.get('location', 'Unknown').strip()
    device_name = data.get('device_name', 'Unknown Device').strip()
    
    try:
        model = joblib.load(os.path.join(os.path.dirname(__file__), "model.pkl"))
        # Format input exactly as it was trained
        X = [[amount, hour_of_day, device_risk, location_risk]]
        score = float(model.predict_proba(X)[0][1])
    except Exception as e:
        # Fallback in case of model error (e.g. not loaded)
        print(f"[WARNING] Model inference failed. Using fallback calculation. Error: {e}")
        score = 0.25 + 0.3 * (amount > 500) + 0.15 * device_risk + 0.3 * (location_risk > 0.6)
        score = min(max(score, 0.0), 1.0)
        
    # Classification logic
    if score < 0.3:
        level = "Low"
    elif score <= 0.7:
        level = "Medium"
    else:
        level = "High"
        
    # AES-256 Encryption for sensitive input data fields
    encrypted_location = encrypt_field(location)
    encrypted_device_name = encrypt_field(device_name)
    
    tx = {
        "username": current_user["username"],
        "amount": amount,
        "hour_of_day": hour_of_day,
        "device_risk": device_risk,
        "location_risk": location_risk,
        "encrypted_location": encrypted_location,
        "encrypted_device_name": encrypted_device_name,
        "risk_score": round(score, 4),
        "risk_level": level,
        "timestamp": datetime.datetime.now().isoformat()
    }
    db.add_transaction(tx)
    db.add_audit_log(f"Inference run: risk={level}, score={round(score,4)}", current_user["username"])
    
    # Decrypt sensitive text before returning in prediction results
    tx_return = tx.copy()
    tx_return["location"] = location
    tx_return["device_name"] = device_name
    
    return jsonify({
        "message": "Risk assessed successfully",
        "score": tx_return["risk_score"],
        "risk_level": tx_return["risk_level"],
        "transaction": tx_return
    }), 200

@app.route('/api/transactions', methods=['GET'])
@token_required
def get_user_transactions(current_user):
    risk_level = request.args.get('risk_level', '').strip()
    
    filters = {}
    if current_user["role"] != "admin":
        filters["username"] = current_user["username"]
        
    if risk_level:
        filters["risk_level"] = risk_level
        
    txs = db.get_transactions(filters)
    # Decrypt sensitive info for output
    for t in txs:
        t["location"] = decrypt_field(t.get("encrypted_location", ""))
        t["device_name"] = decrypt_field(t.get("encrypted_device_name", ""))
        if "encrypted_location" in t: del t["encrypted_location"]
        if "encrypted_device_name" in t: del t["encrypted_device_name"]
        
    return jsonify(txs), 200

# ==================== ADMIN ENDPOINTS ====================
@app.route('/api/admin/metrics', methods=['GET'])
@admin_required
def get_admin_metrics(current_user):
    txs = db.get_transactions({})
    total_tx = len(txs)
    
    # Count distributions
    low = sum(1 for t in txs if t.get("risk_level") == "Low")
    med = sum(1 for t in txs if t.get("risk_level") == "Medium")
    high = sum(1 for t in txs if t.get("risk_level") == "High")
    
    # Fraud predicted is risk level "High"
    fraud_pct = (high / total_tx * 100) if total_tx > 0 else 0
    
    # Audit log access
    logs = db.get_all_audit_logs()
    
    # Model info from train_model metrics
    model_metrics = {
        "accuracy": 0.7675,
        "precision": 0.3064,
        "recall": 0.2753,
        "auc": 0.7064
    }
    
    return jsonify({
        "total_transactions": total_tx,
        "risk_distribution": {"Low": low, "Medium": med, "High": high},
        "fraud_detected_pct": round(fraud_pct, 2),
        "model_performance": model_metrics,
        "audit_logs": logs
    }), 200

@app.route('/api/admin/model/train', methods=['POST'])
@admin_required
def admin_train_model(current_user):
    data = request.get_json() or {}
    algorithm = data.get('algorithm', 'rf').strip()
    if algorithm not in ["rf", "lr"]:
        algorithm = "rf"
        
    metrics = train_model.train_and_evaluate(algorithm)
    db.add_audit_log(f"Admin retrained model using {algorithm}", current_user["username"])
    return jsonify({
        "message": f"Model successfully trained with {algorithm}",
        "metrics": metrics
    }), 200

@app.route('/api/admin/users', methods=['GET', 'POST'])
@admin_required
def admin_users(current_user):
    if request.method == 'GET':
        users = db.find_all_users()
        # hide password hashes
        for u in users:
            if "password" in u: del u["password"]
        return jsonify(users), 200
        
    elif request.method == 'POST':
        data = request.get_json() or {}
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        role = data.get('role', 'user').strip()
        
        if not username or not password:
            return jsonify({"error": "Username and password required"}), 400
            
        existing = db.find_user_by_username(username)
        if existing:
            return jsonify({"error": "Username already exists"}), 400
            
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        db.add_user({"username": username, "password": hashed, "role": role})
        db.add_audit_log(f"Admin added user {username}", current_user["username"])
        return jsonify({"message": f"User {username} added successfully"}), 201

@app.route('/api/admin/users/<username>', methods=['DELETE'])
@admin_required
def admin_delete_user(current_user, username):
    if username == current_user["username"]:
        return jsonify({"error": "Cannot delete current logged in admin"}), 400
        
    db.delete_user_by_username(username)
    db.add_audit_log(f"Admin deleted user {username}", current_user["username"])
    return jsonify({"message": f"User {username} successfully deleted"}), 200

@app.route('/api/admin/datasets/upload', methods=['POST'])
@admin_required
def admin_upload_dataset(current_user):
    if 'file' not in request.files:
        return jsonify({"error": "No file included in upload"}), 400
        
    f = request.files['file']
    if not f.filename.endswith('.csv'):
        return jsonify({"error": "File must be a CSV file"}), 400
        
    try:
        df = pd.read_csv(f)
        required_cols = ["amount", "hour_of_day", "device_risk", "location_risk"]
        for c in required_cols:
            if c not in df.columns:
                return jsonify({"error": f"CSV missing required column: {c}"}), 400
                
        for _, r in df.iterrows():
            loc = encrypt_field(str(r.get("location", "Unknown")))
            dev = encrypt_field(str(r.get("device_name", "Unknown Device")))
            
            amt = float(r.get("amount", 0))
            hr = int(r.get("hour_of_day", 12))
            d_risk = int(r.get("device_risk", 0))
            l_risk = float(r.get("location_risk", 0.1))
            
            try:
                model = joblib.load(os.path.join(os.path.dirname(__file__), "model.pkl"))
                score = float(model.predict_proba([[amt, hr, d_risk, l_risk]])[0][1])
            except Exception:
                score = 0.25 + 0.3 * (amt > 500) + 0.15 * d_risk + 0.3 * (l_risk > 0.6)
                score = min(max(score, 0.0), 1.0)
                
            level = "Low" if score < 0.3 else "Medium" if score <= 0.7 else "High"
            
            db.add_transaction({
                "username": current_user["username"],
                "amount": amt,
                "hour_of_day": hr,
                "device_risk": d_risk,
                "location_risk": l_risk,
                "encrypted_location": loc,
                "encrypted_device_name": dev,
                "risk_score": round(score, 4),
                "risk_level": level,
                "timestamp": datetime.datetime.now().isoformat()
            })
            
        db.add_audit_log(f"Admin uploaded trained dataset CSV with {len(df)} transactions", current_user["username"])
        return jsonify({"message": f"Dataset uploaded and {len(df)} transactions processed successfully"}), 200
    except Exception as e:
        return jsonify({"error": f"Processing error: {str(e)}"}), 500

@app.route('/api/admin/password/reset', methods=['POST'])
@admin_required
def admin_password_reset(current_user):
    data = request.get_json() or {}
    new_password = data.get("password", "").strip()
    if not new_password:
        return jsonify({"error": "New password is required"}), 400
        
    hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    user_data = db.find_user_by_username(current_user["username"])
    user_data["password"] = hashed
    db.delete_user_by_username(current_user["username"])
    db.add_user(user_data)
    
    db.add_audit_log("Admin successfully reset their account password", current_user["username"])
    return jsonify({"message": "Password updated successfully"}), 200

@app.route('/api/admin/transactions/clear', methods=['POST'])
@admin_required
def admin_clear_transactions(current_user):
    db.delete_all_transactions()
    db.add_audit_log("Admin wiped all transaction datasets", current_user["username"])
    return jsonify({"message": "All transactions wiped successfully"}), 200

# ==================== FRONTEND STATIC PROXY ====================
@app.route('/')
def serve_index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/admin')
def serve_admin():
    return send_from_directory('../frontend', 'admin.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend', path)

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
