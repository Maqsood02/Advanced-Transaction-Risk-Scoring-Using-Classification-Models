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
base_dir = os.path.dirname(os.path.abspath(__file__))
if base_dir not in sys.path:
    sys.path.append(base_dir)

from security_aes import encrypt_field, decrypt_field
import db_mongo as db
import train_model

static_dir = os.path.abspath(os.path.join(base_dir, "../frontend"))
app = Flask(__name__, static_folder=static_dir, static_url_path="")
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
                current_user = {"username": data["username"], "role": data.get("role", "user")}
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
                current_user = {"username": data["username"], "role": data.get("role", "user")}
        except Exception as e:
            return jsonify({"error": "Invalid token", "details": str(e)}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# ==================== AUTH ENDPOINTS ====================
pending_otps = {}
import random

@app.route('/api/register/request-otp', methods=['POST'])
def request_otp():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '').strip()
    role = data.get('role', 'user').strip()
    
    if role not in ["admin", "user"]:
        role = "user"
        
    if not username or not password or not email:
        return jsonify({"error": "Username, email, and password are required"}), 400
        
    existing = db.find_user_by_username(username)
    if existing:
        return jsonify({"error": "Username already exists"}), 400
        
    otp_code = str(random.randint(100000, 999999))
    pending_otps[email] = {
        "username": username,
        "password": password,
        "role": role,
        "otp": otp_code,
        "expires": datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
    }
    
    # Always print and save the OTP to a local log file for development and troubleshooting
    try:
        log_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "otp_debug.log")
        with open(log_path, "w") as f:
            f.write(f"OTP Code for {email}: {otp_code}\n")
        print(f"[OTP LOG] Generated OTP {otp_code} for {email} (saved to {log_path})")
    except Exception as le:
        print(f"[ERROR] Failed to write OTP to log file: {le}")

    import smtplib
    from email.mime.text import MIMEText
    smtp_server = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", 587))
    smtp_user = os.environ.get("SMTP_USER", "atrsc.ac.in@gmail.com")
    smtp_password = os.environ.get("SMTP_PASSWORD", "uhkr jvih rkgf eifx")
    
    if smtp_user and smtp_password:
        try:
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #f8fafc;">
                <h2 style="color: #2563eb; text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Email Verification Code</h2>
                <p style="font-size: 16px; color: #333;">Hello <strong>{username}</strong>,</p>
                <p style="font-size: 16px; color: #333;">Please use the following 6-digit code to verify your email and complete your registration:</p>
                <h1 style="color: #059669; text-align: center; font-size: 36px; letter-spacing: 8px; margin: 25px 0;">{otp_code}</h1>
                <p style="font-size: 14px; color: #64748b;">This code is valid for 10 minutes. Do not share it with anyone.</p>
                <br>
                <p style="font-size: 14px; color: #64748b;">Best Regards,<br><strong>ATRSC Security Team</strong></p>
            </div>
            """
            msg = MIMEText(html_content, 'html')
            msg['Subject'] = 'Your ATRSC Verification Code'
            msg['From'] = f"ATRSC System <{smtp_user}>"
            msg['To'] = email
            
            if smtp_port == 465:
                server = smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=10)
            else:
                server = smtplib.SMTP(smtp_server, smtp_port, timeout=10)
                server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
            server.quit()
            print(f"[SUCCESS] OTP email sent to {email}")
            return jsonify({"message": "Verification code sent to your email. Please check your inbox."}), 200
        except Exception as e:
            print(f"[ERROR] Failed to send OTP email: {e}")
            return jsonify({"error": f"Failed to send email: {str(e)}. You can find your verification code in 'otp_debug.log' at the project root."}), 500
    else:
        return jsonify({"error": "Email service is offline (credentials not configured). You can find your verification code in 'otp_debug.log' at the project root."}), 500

@app.route('/api/register/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json() or {}
    email = data.get('email', '').strip()
    otp = data.get('otp', '').strip()
    
    if not email or not otp:
        return jsonify({"error": "Email and OTP are required"}), 400
        
    pending = pending_otps.get(email)
    if not pending:
        return jsonify({"error": "No pending registration found for this email, or it expired"}), 400
        
    if pending["expires"] < datetime.datetime.utcnow():
        del pending_otps[email]
        return jsonify({"error": "OTP has expired. Please request a new one."}), 400
        
    if pending["otp"] != otp:
        return jsonify({"error": "Invalid verification code"}), 400
        
    username = pending["username"]
    password = pending["password"]
    role = pending["role"]
    
    existing = db.find_user_by_username(username)
    if existing:
        return jsonify({"error": "Username already exists"}), 400
        
    hashed_pwd = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    new_user = {
        "username": username,
        "email": email,
        "password": hashed_pwd,
        "role": role
    }
    db.add_user(new_user)
    db.add_audit_log("User registration", username, "success")
    
    # Send welcome email
    import smtplib
    from email.mime.text import MIMEText
    smtp_server = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", 587))
    smtp_user = os.environ.get("SMTP_USER", "atrsc.ac.in@gmail.com")
    smtp_password = os.environ.get("SMTP_PASSWORD", "uhkr jvih rkgf eifx")
    
    if smtp_user and smtp_password:
        try:
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #f8fafc;">
                <h2 style="color: #2563eb; text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Welcome to ATRSC System!</h2>
                <p style="font-size: 16px; color: #333;">Hello <strong>{username}</strong>,</p>
                <p style="font-size: 16px; color: #333;">Your account has been successfully created and your email is fully verified.</p>
                <p style="font-size: 16px; color: #333;">You are now ready to log in to the portal and access the machine learning automated risk predictions.</p>
                <br>
                <p style="font-size: 14px; color: #64748b;">Best Regards,<br><strong>ATRSC Security Team</strong></p>
            </div>
            """
            msg = MIMEText(html_content, 'html')
            msg['Subject'] = 'Account Verification & Welcome to ATRSC'
            msg['From'] = f"ATRSC System <{smtp_user}>"
            msg['To'] = email
            
            if smtp_port == 465:
                server = smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=10)
            else:
                server = smtplib.SMTP(smtp_server, smtp_port, timeout=10)
                server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
            server.quit()
        except Exception as e:
            print(f"[ERROR] Failed to send welcome email: {e}")
            
    del pending_otps[email]
    return jsonify({"message": "Account successfully verified and registered", "username": username}), 201

@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json() or {}
    email = data.get('email', '').strip()
    
    if not email:
        return jsonify({"error": "Email is required"}), 400
        
    user = db.find_user_by_email(email)
    if not user:
        # Don't leak whether user exists
        return jsonify({"message": "If that email exists, a reset link has been sent."}), 200
        
    # Generate a temporary new password
    import string, random
    new_password = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
    
    import smtplib
    from email.mime.text import MIMEText
    smtp_server = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", 587))
    smtp_user = os.environ.get("SMTP_USER", "atrsc.ac.in@gmail.com")
    smtp_password = os.environ.get("SMTP_PASSWORD", "uhkr jvih rkgf eifx")
    
    if smtp_user and smtp_password:
        try:
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #f8fafc;">
                <h2 style="color: #2563eb; text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Password Reset</h2>
                <p style="font-size: 16px; color: #333;">Hello <strong>{user['username']}</strong>,</p>
                <p style="font-size: 16px; color: #333;">We received a request to reset your password. Here is your new temporary password:</p>
                <h1 style="color: #059669; text-align: center; font-size: 24px; letter-spacing: 4px; margin: 25px 0; background-color: #e2e8f0; padding: 15px; border-radius: 8px;">{new_password}</h1>
                <p style="font-size: 14px; color: #64748b;">Please log in with this temporary password and change it immediately.</p>
                <br>
                <p style="font-size: 14px; color: #64748b;">Best Regards,<br><strong>ATRSC Security Team</strong></p>
            </div>
            """
            msg = MIMEText(html_content, 'html')
            msg['Subject'] = 'ATRSC Password Reset'
            msg['From'] = f"ATRSC System <{smtp_user}>"
            msg['To'] = email
            
            if smtp_port == 465:
                server = smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=10)
            else:
                server = smtplib.SMTP(smtp_server, smtp_port, timeout=10)
                server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
            server.quit()
            print(f"[SUCCESS] Password reset email sent to {email}")
        except Exception as e:
            print(f"[ERROR] Failed to send password reset email: {e}")
            return jsonify({"error": f"Failed to send reset email: {str(e)}. Please try again later."}), 500
    else:
        return jsonify({"error": "Email service is offline (credentials not configured)."}), 500
        
    # Only modify the user's password in the database if the email was successfully sent
    hashed_pwd = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user["password"] = hashed_pwd
    db.delete_user_by_username(user["username"])
    db.add_user(user)
    db.add_audit_log("User requested password reset", user["username"], "success")
            
    return jsonify({"message": "If that email exists, a reset link has been sent."}), 200

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
        
        # Email notification sending
        email_to = user.get("email", "")
        if not email_to and "@" in user.get("username", ""):
            email_to = user["username"]

        if email_to:
            import smtplib
            from email.mime.text import MIMEText
            smtp_server = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
            smtp_port = int(os.environ.get("SMTP_PORT", 587))
            smtp_user = os.environ.get("SMTP_USER", "atrsc.ac.in@gmail.com")
            smtp_password = os.environ.get("SMTP_PASSWORD", "uhkr jvih rkgf eifx")
            
            if smtp_user and smtp_password:
                try:
                    time_str = datetime.datetime.now().strftime('%B %d, %Y at %I:%M %p')
                    html_content = f"""
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #f8fafc;">
                        <h2 style="color: #059669; text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Successful Login Alert</h2>
                        <p style="font-size: 16px; color: #333;">Hello <strong>{user['username']}</strong>,</p>
                        <p style="font-size: 16px; color: #333;">This is a quick notification that you have successfully logged into the ATRSC System.</p>
                        <p style="font-size: 15px; color: #333; background-color: #e2e8f0; padding: 10px; border-radius: 5px;"><strong>Time:</strong> {time_str}</p>
                        <p style="font-size: 14px; color: #64748b; margin-top: 20px;">If this was you, no further action is required. Enjoy your session!</p>
                        <p style="font-size: 14px; color: #64748b;">If you did not initiate this login, please secure your account immediately by contacting the administrator.</p>
                        <br>
                        <p style="font-size: 14px; color: #64748b;">Best Regards,<br><strong>ATRSC Security Team</strong></p>
                    </div>
                    """
                    msg = MIMEText(html_content, 'html')
                    msg['Subject'] = 'ATRSC System - Successful Login Alert'
                    msg['From'] = f"ATRSC System <{smtp_user}>"
                    msg['To'] = email_to
                    
                    if smtp_port == 465:
                        server = smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=10)
                    else:
                        server = smtplib.SMTP(smtp_server, smtp_port, timeout=10)
                        server.starttls()
                    server.login(smtp_user, smtp_password)
                    server.send_message(msg)
                    server.quit()
                    print(f"[SUCCESS] Email successfully sent via SMTP to {email_to}")
                except Exception as e:
                    print(f"[ERROR] Failed to send email: {e}")
            else:
                print(f"[SIMULATION] Email alert to {email_to} (SMTP credentials not set)")
                
        if not os.environ.get("VERCEL"):
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
    tx_type = data.get('tx_type', 'upi').strip().lower()
    if tx_type not in ['upi', 'credit_card']:
        tx_type = 'upi'
        
    amount = float(data.get('amount', 0.0))
    hour_of_day = int(data.get('hour_of_day', 12))
    device_risk = int(data.get('device_risk', 0))
    location_risk = float(data.get('location_risk', 0.1))
    
    # Extra fields for AES encryption
    location = data.get('location', 'Unknown').strip()
    device_name = data.get('device_name', 'Unknown Device').strip()
    
    encrypted_location = encrypt_field(location)
    encrypted_device_name = encrypt_field(device_name)
    
    if tx_type == 'upi':
        has_receipt = int(data.get('has_receipt', 1))
        utr_valid = int(data.get('utr_valid', 1))
        utr_number = data.get('utr_number', '').strip()
        upi_id = data.get('upi_id', '').strip()
        
        # 1. Analyze UPI ID risk on the server side
        upi_id_risk = 0.1  # Default baseline risk
        if upi_id:
            import re
            # Validate format
            if not re.match(r"^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$", upi_id):
                upi_id_risk = 0.8  # Invalid format is highly risky
            else:
                # Check suspicious words
                suspicious_words = ["spam", "fake", "scam", "fraud", "test", "temp", "hack", "dummy"]
                if any(w in upi_id.lower() for w in suspicious_words):
                    upi_id_risk = 0.9
                else:
                    # Check for random/suspicious account generation patterns
                    handle = upi_id.split("@")[0]
                    if handle.isdigit() and len(handle) >= 10:
                        upi_id_risk = 0.7  # Long purely numeric handles are suspicious
                    elif len(handle) > 15 and re.search(r"[0-9]", handle) and re.search(r"[a-zA-Z]", handle):
                        upi_id_risk = 0.6  # Mixed alphanumeric long handles are suspicious
                        
        # 2. Analyze QR Code pattern & verify matching parameters
        qr_code_text = data.get('qr_code_text', '').strip()
        qr_verified = int(data.get('qr_verified', 0))
        if qr_code_text:
            if qr_code_text.startswith("upi://pay?") or qr_code_text.startswith("upi://pay"):
                qr_verified = 1
                try:
                    from urllib.parse import urlparse, parse_qs
                    parsed = urlparse(qr_code_text)
                    query_params = parse_qs(parsed.query)
                    
                    qr_upi_id = query_params.get('pa', [''])[0].strip()
                    if qr_upi_id and upi_id and qr_upi_id.lower() != upi_id.lower():
                        qr_verified = 0
                        print(f"[SECURITY WARNING] Payee swap detected! QR payee={qr_upi_id}, Input={upi_id}")
                        
                    qr_amount_str = query_params.get('am', [''])[0].strip()
                    if qr_amount_str and amount:
                        try:
                            qr_amount = float(qr_amount_str)
                            if abs(qr_amount - amount) > 0.01:
                                qr_verified = 0
                                print(f"[SECURITY WARNING] Amount mismatch! QR amount={qr_amount}, Input={amount}")
                        except ValueError:
                            pass
                except Exception as pe:
                    print(f"[WARNING] QR deep parsing failure: {pe}")
        
        try:
            model = joblib.load(os.path.join(os.path.dirname(__file__), "model.pkl"))
            X = [[amount, hour_of_day, device_risk, location_risk, has_receipt, qr_verified, utr_valid, upi_id_risk]]
            score = float(model.predict_proba(X)[0][1])
        except Exception as e:
            print(f"[WARNING] Model inference failed. Using fallback calculation. Error: {e}")
            score = 0.25 + 0.3 * (amount > 500) + 0.15 * device_risk + 0.3 * (location_risk > 0.6)
            score += 0.2 * (has_receipt == 0) + 0.25 * (qr_verified == 0) + 0.3 * (utr_valid == 0) + 0.2 * upi_id_risk
            score = min(max(score, 0.0), 1.0)
            
        if qr_code_text and qr_verified == 0:
            score = max(score, 0.85)
            
        level = "Low" if score < 0.3 else "Medium" if score <= 0.7 else "High"
            
        encrypted_utr = encrypt_field(utr_number)
        encrypted_upi = encrypt_field(upi_id)
        
        tx = {
            "tx_type": "upi",
            "username": current_user["username"],
            "amount": amount,
            "hour_of_day": hour_of_day,
            "device_risk": device_risk,
            "location_risk": location_risk,
            "has_receipt": has_receipt,
            "qr_verified": qr_verified,
            "utr_valid": utr_valid,
            "upi_id_risk": upi_id_risk,
            "encrypted_location": encrypted_location,
            "encrypted_device_name": encrypted_device_name,
            "encrypted_utr": encrypted_utr,
            "encrypted_upi": encrypted_upi,
            "risk_score": round(score, 4),
            "risk_level": level,
            "timestamp": datetime.datetime.now().isoformat()
        }
        
    else:  # credit_card
        cvv_match = int(data.get('cvv_match', 1))
        expiry_valid = int(data.get('expiry_valid', 1))
        billing_zip_match = int(data.get('billing_zip_match', 1))
        velocity_risk = float(data.get('velocity_risk', 0.1))
        
        cardholder_name = data.get('cardholder_name', 'Unknown Holder').strip()
        card_number = data.get('card_number', '').strip()
        expiry_date = data.get('expiry_date', '').strip()
        billing_zip = data.get('billing_zip', '').strip()
        
        has_receipt = int(data.get('has_receipt', 0))
        
        try:
            model_cc = joblib.load(os.path.join(os.path.dirname(__file__), "model_cc.pkl"))
            X = [[amount, hour_of_day, device_risk, location_risk, cvv_match, expiry_valid, billing_zip_match, velocity_risk]]
            score = float(model_cc.predict_proba(X)[0][1])
        except Exception as e:
            print(f"[WARNING] CC Model inference failed. Using fallback calculation. Error: {e}")
            score = 0.2 + 0.3 * (amount > 1000) + 0.15 * device_risk + 0.25 * (location_risk > 0.6)
            score += 0.25 * (cvv_match == 0) + 0.2 * (expiry_valid == 0) + 0.2 * (billing_zip_match == 0) + 0.2 * velocity_risk
            score = min(max(score, 0.0), 1.0)
            
        level = "Low" if score < 0.3 else "Medium" if score <= 0.7 else "High"
        
        encrypted_cardholder = encrypt_field(cardholder_name)
        encrypted_card_number = encrypt_field(card_number)
        encrypted_expiry_date = encrypt_field(expiry_date)
        encrypted_billing_zip = encrypt_field(billing_zip)
        
        tx = {
            "tx_type": "credit_card",
            "username": current_user["username"],
            "amount": amount,
            "hour_of_day": hour_of_day,
            "device_risk": device_risk,
            "location_risk": location_risk,
            "cvv_match": cvv_match,
            "expiry_valid": expiry_valid,
            "billing_zip_match": billing_zip_match,
            "velocity_risk": velocity_risk,
            "has_receipt": has_receipt,
            "encrypted_location": encrypted_location,
            "encrypted_device_name": encrypted_device_name,
            "encrypted_cardholder": encrypted_cardholder,
            "encrypted_card_number": encrypted_card_number,
            "encrypted_expiry_date": encrypted_expiry_date,
            "encrypted_billing_zip": encrypted_billing_zip,
            "risk_score": round(score, 4),
            "risk_level": level,
            "timestamp": datetime.datetime.now().isoformat()
        }
        
    db.add_transaction(tx)
    db.add_audit_log(f"Inference run ({tx_type}): risk={level}, score={round(score,4)}", current_user["username"])
    
    # Decrypt sensitive text before returning in prediction results
    tx_return = tx.copy()
    tx_return["location"] = location
    tx_return["device_name"] = device_name
    
    if tx_type == 'upi':
        tx_return["utr_number"] = utr_number
        tx_return["upi_id"] = upi_id
    else:
        tx_return["cardholder_name"] = cardholder_name
        masked_card = card_number
        clean_card = "".join(card_number.split())
        if len(clean_card) >= 4:
            masked_card = f"**** **** **** {clean_card[-4:]}"
        tx_return["card_number"] = masked_card
        tx_return["expiry_date"] = expiry_date
        tx_return["billing_zip"] = billing_zip
        
    if "_id" in tx_return:
        tx_return["_id"] = str(tx_return["_id"])
        
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
        t_type = t.get("tx_type", "upi")
        t["tx_type"] = t_type
        t["location"] = decrypt_field(t.get("encrypted_location", ""))
        t["device_name"] = decrypt_field(t.get("encrypted_device_name", ""))
        
        if t_type == "upi":
            t["utr_number"] = decrypt_field(t.get("encrypted_utr", ""))
            t["upi_id"] = decrypt_field(t.get("encrypted_upi", ""))
        elif t_type == "credit_card":
            t["cardholder_name"] = decrypt_field(t.get("encrypted_cardholder", ""))
            card_num = decrypt_field(t.get("encrypted_card_number", ""))
            clean_card = "".join(card_num.split())
            if len(clean_card) >= 4:
                t["card_number"] = f"**** **** **** {clean_card[-4:]}"
            else:
                t["card_number"] = card_num
            t["expiry_date"] = decrypt_field(t.get("encrypted_expiry_date", ""))
            t["billing_zip"] = decrypt_field(t.get("encrypted_billing_zip", ""))
            
        for key in list(t.keys()):
            if key.startswith("encrypted_"):
                del t[key]
        
    return jsonify(txs), 200

# ==================== ADMIN ENDPOINTS ====================
@app.route('/api/admin/metrics', methods=['GET'])
@admin_required
def get_admin_metrics(current_user):
    txs = db.get_transactions({})
    total_tx = len(txs)
    
    low = sum(1 for t in txs if t.get("risk_level") == "Low")
    med = sum(1 for t in txs if t.get("risk_level") == "Medium")
    high = sum(1 for t in txs if t.get("risk_level") == "High")
    
    # Channel specific counts
    low_upi = sum(1 for t in txs if t.get("risk_level") == "Low" and t.get("tx_type") == "upi")
    med_upi = sum(1 for t in txs if t.get("risk_level") == "Medium" and t.get("tx_type") == "upi")
    high_upi = sum(1 for t in txs if t.get("risk_level") == "High" and t.get("tx_type") == "upi")
    
    low_cc = sum(1 for t in txs if t.get("risk_level") == "Low" and t.get("tx_type") == "credit_card")
    med_cc = sum(1 for t in txs if t.get("risk_level") == "Medium" and t.get("tx_type") == "credit_card")
    high_cc = sum(1 for t in txs if t.get("risk_level") == "High" and t.get("tx_type") == "credit_card")
    
    fraud_pct = (high / total_tx * 100) if total_tx > 0 else 0
    logs = db.get_all_audit_logs()
    
    import json
    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    metrics_path = os.path.join(data_dir, "metrics.json")
    
    model_metrics_upi = {
        "accuracy": 0.6475,
        "precision": 0.5818,
        "recall": 0.5714,
        "auc": 0.6913
    }
    model_metrics_cc = {
        "accuracy": 0.7350,
        "precision": 0.6559,
        "recall": 0.4519,
        "auc": 0.7704
    }
    
    if os.path.exists(metrics_path):
        try:
            with open(metrics_path, "r") as f:
                metrics_data = json.load(f)
                if "upi" in metrics_data:
                    model_metrics_upi = metrics_data["upi"]
                if "credit_card" in metrics_data:
                    model_metrics_cc = metrics_data["credit_card"]
        except Exception as e:
            print(f"[WARNING] Failed to load metrics.json: {e}")
            
    return jsonify({
        "total_transactions": total_tx,
        "risk_distribution": {"Low": low, "Medium": med, "High": high},
        "risk_distribution_upi": {"Low": low_upi, "Medium": med_upi, "High": high_upi},
        "risk_distribution_cc": {"Low": low_cc, "Medium": med_cc, "High": high_cc},
        "fraud_detected_pct": round(fraud_pct, 2),
        "model_performance_upi": model_metrics_upi,
        "model_performance_cc": model_metrics_cc,
        "model_performance": model_metrics_upi, # Fallback for old frontend charts
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
    db.add_audit_log(f"Admin retrained models using {algorithm}", current_user["username"])
    return jsonify({
        "message": f"Models successfully trained with {algorithm}",
        "metrics": metrics
    }), 200

@app.route('/api/admin/users', methods=['GET', 'POST'])
@admin_required
def admin_users(current_user):
    if request.method == 'GET':
        users = db.find_all_users()
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
        
        # Normalize column names: strip, lowercase, replace spaces/dashes with underscores
        import re
        df.columns = [re.sub(r'[\s\-]+', '_', str(c).strip().lower().replace("'", "").replace('"', "")) for c in df.columns]
        
        is_cc = "cvv_match" in df.columns
        if is_cc:
            required_cols = ["amount", "hour_of_day", "device_risk", "location_risk", "cvv_match", "expiry_valid", "billing_zip_match", "velocity_risk"]
        else:
            required_cols = ["amount", "hour_of_day", "device_risk", "location_risk", "has_receipt", "qr_verified", "utr_valid", "upi_id_risk"]
            
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
            
            if is_cc:
                cvv_m = int(r.get("cvv_match", 1))
                exp_v = int(r.get("expiry_valid", 1))
                zip_m = int(r.get("billing_zip_match", 1))
                vel_r = float(r.get("velocity_risk", 0.1))
                has_rec = int(r.get("has_receipt", 0))
                
                try:
                    m_path = "/tmp/model_cc.pkl" if (os.environ.get("VERCEL") or not os.access(os.path.dirname(__file__), os.W_OK)) else os.path.join(os.path.dirname(__file__), "model_cc.pkl")
                    if os.path.exists(m_path):
                        model_cc = joblib.load(m_path)
                        score = float(model_cc.predict_proba([[amt, hr, d_risk, l_risk, cvv_m, exp_v, zip_m, vel_r]])[0][1])
                    else:
                        score = 0.2 + 0.3 * (amt > 1000) + 0.15 * d_risk + 0.25 * (l_risk > 0.6)
                        score += 0.25 * (cvv_m == 0) + 0.2 * (exp_v == 0) + 0.2 * (zip_m == 0) + 0.2 * vel_r
                        score = min(max(score, 0.0), 1.0)
                except Exception:
                    score = 0.2 + 0.3 * (amt > 1000) + 0.15 * d_risk + 0.25 * (l_risk > 0.6)
                    score += 0.25 * (cvv_m == 0) + 0.2 * (exp_v == 0) + 0.2 * (zip_m == 0) + 0.2 * vel_r
                    score = min(max(score, 0.0), 1.0)
                    
                level = "Low" if score < 0.3 else "Medium" if score <= 0.7 else "High"
                
                db.add_transaction({
                    "tx_type": "credit_card",
                    "username": current_user["username"],
                    "amount": amt,
                    "hour_of_day": hr,
                    "device_risk": d_risk,
                    "location_risk": l_risk,
                    "cvv_match": cvv_m,
                    "expiry_valid": exp_v,
                    "billing_zip_match": zip_m,
                    "velocity_risk": vel_r,
                    "has_receipt": has_rec,
                    "encrypted_location": loc,
                    "encrypted_device_name": dev,
                    "encrypted_cardholder": encrypt_field(str(r.get("cardholder_name", "Unknown Holder"))),
                    "encrypted_card_number": encrypt_field(str(r.get("card_number", "4111111111111111"))),
                    "encrypted_expiry_date": encrypt_field(str(r.get("expiry_date", "12/29"))),
                    "encrypted_billing_zip": encrypt_field(str(r.get("billing_zip", "400001"))),
                    "risk_score": round(score, 4),
                    "risk_level": level,
                    "timestamp": datetime.datetime.now().isoformat()
                })
            else:
                h_rect = int(r.get("has_receipt", 1))
                q_ver = int(r.get("qr_verified", 1))
                u_val = int(r.get("utr_valid", 1))
                upi_risk = float(r.get("upi_id_risk", 0.0))
                
                try:
                    m_path = "/tmp/model.pkl" if (os.environ.get("VERCEL") or not os.access(os.path.dirname(__file__), os.W_OK)) else os.path.join(os.path.dirname(__file__), "model.pkl")
                    if os.path.exists(m_path):
                        model = joblib.load(m_path)
                        score = float(model.predict_proba([[amt, hr, d_risk, l_risk, h_rect, q_ver, u_val, upi_risk]])[0][1])
                    else:
                        score = 0.25 + 0.3 * (amt > 500) + 0.15 * d_risk + 0.3 * (l_risk > 0.6)
                        score += 0.2 * (h_rect == 0) + 0.25 * (q_ver == 0) + 0.3 * (u_val == 0) + 0.2 * upi_risk
                        score = min(max(score, 0.0), 1.0)
                except Exception:
                    score = 0.25 + 0.3 * (amt > 500) + 0.15 * d_risk + 0.3 * (l_risk > 0.6)
                    score += 0.2 * (h_rect == 0) + 0.25 * (q_ver == 0) + 0.3 * (u_val == 0) + 0.2 * upi_risk
                    score = min(max(score, 0.0), 1.0)
                    
                level = "Low" if score < 0.3 else "Medium" if score <= 0.7 else "High"
                
                db.add_transaction({
                    "tx_type": "upi",
                    "username": current_user["username"],
                    "amount": amt,
                    "hour_of_day": hr,
                    "device_risk": d_risk,
                    "location_risk": l_risk,
                    "has_receipt": h_rect,
                    "qr_verified": q_ver,
                    "utr_valid": u_val,
                    "upi_id_risk": upi_risk,
                    "encrypted_location": loc,
                    "encrypted_device_name": dev,
                    "encrypted_utr": encrypt_field(str(r.get("utr_number", "Unknown UTR"))),
                    "encrypted_upi": encrypt_field(str(r.get("upi_id", "Unknown UPI"))),
                    "risk_score": round(score, 4),
                    "risk_level": level,
                    "timestamp": datetime.datetime.now().isoformat()
                })
                
        db.add_audit_log(f"Admin uploaded trained dataset CSV with {len(df)} transactions", current_user["username"])
        return jsonify({"message": f"Dataset uploaded and {len(df)} transactions processed successfully"}), 200
    except Exception as e:
        return jsonify({"error": f"Processing error: {str(e)}"}), 500

@app.route('/api/admin/credentials/reset', methods=['POST'])
@admin_required
def admin_credentials_reset(current_user):
    data = request.get_json() or {}
    new_username = data.get("username", "").strip()
    new_password = data.get("password", "").strip()
    
    if not new_username and not new_password:
        return jsonify({"error": "Username or password is required"}), 400
        
    user_data = db.find_user_by_username(current_user["username"])
    if not user_data:
        return jsonify({"error": "User not found"}), 404
        
    old_username = current_user["username"]
    updated_username = old_username
    
    if new_username and new_username != old_username:
        existing = db.find_user_by_username(new_username)
        if existing:
            return jsonify({"error": "Username already exists"}), 400
            
        user_data["username"] = new_username
        db.delete_user_by_username(old_username)
        db.add_user(user_data)
        updated_username = new_username
        db.add_audit_log(f"Admin renamed account from {old_username} to {new_username}", new_username)
        
    if new_password:
        user_data = db.find_user_by_username(updated_username)
        hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        user_data["password"] = hashed
        db.delete_user_by_username(updated_username)
        db.add_user(user_data)
        db.add_audit_log("Admin successfully reset password", updated_username)
        
    token = jwt.encode({
        "username": updated_username,
        "role": "admin",
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }, JWT_SECRET, algorithm="HS256")
    
    return jsonify({
        "message": "Account credentials updated successfully",
        "username": updated_username,
        "token": token
    }), 200

@app.route('/api/admin/transactions/clear', methods=['POST'])
@admin_required
def admin_clear_transactions(current_user):
    db.delete_all_transactions()
    db.add_audit_log("Admin wiped all transaction datasets", current_user["username"])
    return jsonify({"message": "All transactions wiped successfully"}), 200

# ==================== FRONTEND STATIC PROXY ====================
@app.route('/')
def serve_index():
    return send_from_directory(static_dir, 'index.html')

@app.route('/admin')
def serve_admin():
    return send_from_directory(static_dir, 'admin.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(static_dir, path)

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
