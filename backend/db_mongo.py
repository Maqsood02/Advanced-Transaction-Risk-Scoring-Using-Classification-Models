import os
import json
import datetime
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = "transaction_risk_db"

if os.environ.get("VERCEL"):
    FALLBACK_FILE = "/tmp/db_fallback.json"
else:
    FALLBACK_FILE = "db_fallback.json"

_fallback_db = {
    "users": [],
    "transactions": [],
    "audit_logs": []
}

def load_fallback():
    global _fallback_db
    if os.path.exists(FALLBACK_FILE):
        try:
            with open(FALLBACK_FILE, "r") as f:
                _fallback_db = json.load(f)
        except Exception:
            pass

def save_fallback():
    try:
        with open(FALLBACK_FILE, "w") as f:
            json.dump(_fallback_db, f, indent=2)
    except Exception:
        pass

load_fallback()

use_mongo = False
try:
    from pymongo.server_api import ServerApi
    if "mongodb+srv" in MONGO_URI:
        client = MongoClient(MONGO_URI, server_api=ServerApi('1'), serverSelectionTimeoutMS=2500)
    else:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2500)
    # Ping the database
    client.admin.command('ping')
    db = client[DB_NAME]
    use_mongo = True
    print("[INFO] MongoDB successfully connected.")
except Exception as e:
    print(f"[WARNING] MongoDB not reachable. Using JSON file fallback. Error: {e}")

# Collections
def get_users_collection():
    return db["users"] if use_mongo else None

def get_transactions_collection():
    return db["transactions"] if use_mongo else None

def get_audit_logs_collection():
    return db["audit_logs"] if use_mongo else None

# ==================== USER CRUD ====================
def add_user(user_data):
    if use_mongo:
        try:
            get_users_collection().insert_one(user_data)
            return user_data
        except Exception as e:
            print(f"[WARNING] MongoDB user insert failed, falling back: {e}")
    _fallback_db["users"].append(user_data)
    save_fallback()
    return user_data

def find_user_by_username(username):
    if use_mongo:
        try:
            res = get_users_collection().find_one({"username": username})
            if res:
                return dict(res)
        except Exception as e:
            print(f"[WARNING] MongoDB user find failed, falling back: {e}")
    for u in _fallback_db["users"]:
        if u["username"] == username:
            return dict(u)
    return None

def find_user_by_email(email):
    if use_mongo:
        try:
            res = get_users_collection().find_one({"email": email})
            if res:
                return dict(res)
        except Exception as e:
            print(f"[WARNING] MongoDB user find by email failed, falling back: {e}")
    for u in _fallback_db["users"]:
        if u.get("email") == email:
            return dict(u)
    return None

def find_all_users():
    if use_mongo:
        try:
            users_list = list(get_users_collection().find({}))
            for u in users_list:
                if "_id" in u:
                    u["_id"] = str(u["_id"])
            return users_list
        except Exception as e:
            print(f"[WARNING] MongoDB find all users failed, falling back: {e}")
    return [dict(u) for u in _fallback_db["users"]]

def delete_user_by_username(username):
    if use_mongo:
        try:
            get_users_collection().delete_one({"username": username})
            return
        except Exception as e:
            print(f"[WARNING] MongoDB delete user failed, falling back: {e}")
    _fallback_db["users"] = [u for u in _fallback_db["users"] if u["username"] != username]
    save_fallback()

# ==================== TRANSACTION CRUD ====================
def add_transaction(tx_data):
    tx_data["timestamp"] = tx_data.get("timestamp", datetime.datetime.now().isoformat())
    if use_mongo:
        try:
            get_transactions_collection().insert_one(tx_data)
            return tx_data
        except Exception as e:
            print(f"[WARNING] MongoDB add transaction failed, falling back: {e}")
    _fallback_db["transactions"].append(tx_data)
    save_fallback()
    return tx_data

def get_transactions(filters=None):
    if not filters:
        filters = {}
    if use_mongo:
        try:
            tx_list = list(get_transactions_collection().find(filters))
            for t in tx_list:
                if "_id" in t:
                    t["_id"] = str(t["_id"])
            return tx_list
        except Exception as e:
            print(f"[WARNING] MongoDB get transactions failed, falling back: {e}")
    results = _fallback_db["transactions"]
    for k, v in filters.items():
        results = [r for r in results if r.get(k) == v]
    return results

def delete_all_transactions():
    if use_mongo:
        try:
            get_transactions_collection().delete_many({})
            return
        except Exception as e:
            print(f"[WARNING] MongoDB delete all transactions failed, falling back: {e}")
    _fallback_db["transactions"] = []
    save_fallback()

# ==================== AUDIT LOG CRUD ====================
def add_audit_log(action, username, status="success"):
    log = {
        "action": action,
        "username": username,
        "status": status,
        "timestamp": datetime.datetime.now().isoformat()
    }
    if use_mongo:
        try:
            get_audit_logs_collection().insert_one(log)
            return log
        except Exception as e:
            print(f"[WARNING] MongoDB add audit log failed, falling back: {e}")
    _fallback_db["audit_logs"].append(log)
    save_fallback()
    return log

def get_all_audit_logs():
    if use_mongo:
        try:
            logs_list = list(get_audit_logs_collection().find({}))
            for l in logs_list:
                if "_id" in l:
                    l["_id"] = str(l["_id"])
            return logs_list
        except Exception as e:
            print(f"[WARNING] MongoDB get all audit logs failed, falling back: {e}")
    return _fallback_db["audit_logs"]
