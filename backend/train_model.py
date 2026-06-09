import os
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, roc_auc_score, confusion_matrix, roc_curve

if os.environ.get("VERCEL") or not os.access(os.path.dirname(__file__), os.W_OK):
    DATA_DIR = "/tmp"
    MODEL_PATH = "/tmp/model.pkl"
    MODEL_PATH_CC = "/tmp/model_cc.pkl"
else:
    DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
    MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")
    MODEL_PATH_CC = os.path.join(os.path.dirname(__file__), "model_cc.pkl")

CSV_PATH = os.path.join(DATA_DIR, "transactions.csv")
CSV_PATH_CC = os.path.join(DATA_DIR, "transactions_cc.csv")

def generate_synthetic_data():
    os.makedirs(DATA_DIR, exist_ok=True)
    np.random.seed(42)
    n_samples = 2000
    
    # Generate features
    amount = np.random.exponential(scale=150.0, size=n_samples) + np.random.normal(scale=20, size=n_samples)
    amount = np.maximum(amount, 10.0) # at least 10
    
    hour_of_day = np.random.randint(0, 24, size=n_samples)
    device_risk = np.random.choice([0, 1], size=n_samples, p=[0.85, 0.15])
    location_risk = np.random.uniform(0.0, 1.0, size=n_samples)
    
    # New Features
    has_receipt = np.random.choice([0, 1], size=n_samples, p=[0.3, 0.7])
    qr_verified = np.random.choice([0, 1], size=n_samples, p=[0.2, 0.8])
    utr_valid = np.random.choice([0, 1], size=n_samples, p=[0.1, 0.9])
    upi_id_risk = np.random.uniform(0.0, 1.0, size=n_samples)
    
    # Target (Fraud)
    prob = 0.05 + 0.25 * (amount > 300) + 0.2 * np.isin(hour_of_day, [1, 2, 3, 4]) + 0.15 * device_risk + 0.3 * (location_risk > 0.7)
    prob += 0.2 * (has_receipt == 0) + 0.25 * (qr_verified == 0) + 0.3 * (utr_valid == 0) + 0.2 * upi_id_risk
    
    prob = np.clip(prob, 0.0, 0.95)
    is_fraud = (prob > 0.45).astype(int)
    
    df = pd.DataFrame({
        "amount": amount,
        "hour_of_day": hour_of_day,
        "device_risk": device_risk,
        "location_risk": location_risk,
        "has_receipt": has_receipt,
        "qr_verified": qr_verified,
        "utr_valid": utr_valid,
        "upi_id_risk": upi_id_risk,
        "is_fraud": is_fraud
    })
    
    df.to_csv(CSV_PATH, index=False)
    print(f"[INFO] Generated synthetic dataset with {len(df)} records at {CSV_PATH}")
    return df
 
def generate_synthetic_cc_data():
    os.makedirs(DATA_DIR, exist_ok=True)
    np.random.seed(1337)
    n_samples = 2000
    
    # Generate CC features
    amount = np.random.exponential(scale=250.0, size=n_samples) + np.random.normal(scale=30, size=n_samples)
    amount = np.maximum(amount, 5.0) # at least 5
    
    hour_of_day = np.random.randint(0, 24, size=n_samples)
    device_risk = np.random.choice([0, 1], size=n_samples, p=[0.9, 0.1])
    location_risk = np.random.uniform(0.0, 1.0, size=n_samples)
    
    cvv_match = np.random.choice([0, 1], size=n_samples, p=[0.05, 0.95])
    expiry_valid = np.random.choice([0, 1], size=n_samples, p=[0.02, 0.98])
    billing_zip_match = np.random.choice([0, 1], size=n_samples, p=[0.06, 0.94])
    velocity_risk = np.random.uniform(0.0, 1.0, size=n_samples)
    
    # Target (CC Fraud)
    prob = 0.03 + 0.22 * (amount > 500) + 0.15 * np.isin(hour_of_day, [0, 1, 2, 3, 4, 5]) + 0.2 * device_risk + 0.2 * (location_risk > 0.7)
    prob += 0.35 * (cvv_match == 0) + 0.4 * (expiry_valid == 0) + 0.3 * (billing_zip_match == 0) + 0.2 * velocity_risk
    
    prob = np.clip(prob, 0.0, 0.98)
    is_fraud = (prob > 0.48).astype(int)
    
    df = pd.DataFrame({
        "amount": amount,
        "hour_of_day": hour_of_day,
        "device_risk": device_risk,
        "location_risk": location_risk,
        "cvv_match": cvv_match,
        "expiry_valid": expiry_valid,
        "billing_zip_match": billing_zip_match,
        "velocity_risk": velocity_risk,
        "is_fraud": is_fraud
    })
    
    df.to_csv(CSV_PATH_CC, index=False)
    print(f"[INFO] Generated synthetic Credit Card dataset with {len(df)} records at {CSV_PATH_CC}")
    return df
 
def train_and_evaluate(algorithm="rf"):
    # UPI model training (Always force regenerate for updated logic)
    df_upi = generate_synthetic_data()
        
    X_upi = df_upi[["amount", "hour_of_day", "device_risk", "location_risk", "has_receipt", "qr_verified", "utr_valid", "upi_id_risk"]]
    y_upi = df_upi["is_fraud"]
    
    X_train_u, X_test_u, y_train_u, y_test_u = train_test_split(X_upi, y_upi, test_size=0.2, random_state=42)
    
    # CC model training (Always force regenerate for updated logic)
    df_cc = generate_synthetic_cc_data()
        
    X_cc = df_cc[["amount", "hour_of_day", "device_risk", "location_risk", "cvv_match", "expiry_valid", "billing_zip_match", "velocity_risk"]]
    y_cc = df_cc["is_fraud"]
    
    X_train_c, X_test_c, y_train_c, y_test_c = train_test_split(X_cc, y_cc, test_size=0.2, random_state=42)
    
    if algorithm == "lr":
        model_upi = LogisticRegression(random_state=42, max_iter=1000)
        model_cc = LogisticRegression(random_state=42, max_iter=1000)
    else:
        model_upi = RandomForestClassifier(n_estimators=100, random_state=42)
        model_cc = RandomForestClassifier(n_estimators=100, random_state=42)
        
    model_upi.fit(X_train_u, y_train_u)
    preds_u = model_upi.predict(X_test_u)
    probs_u = model_upi.predict_proba(X_test_u)[:, 1]
    
    # Compute metrics for UPI
    tn_u, fp_u, fn_u, tp_u = confusion_matrix(y_test_u, preds_u).ravel()
    fpr_u, tpr_u, _ = roc_curve(y_test_u, probs_u)
    fpr_points = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
    tpr_u_interp = np.interp(fpr_points, fpr_u, tpr_u).tolist()
    
    upi_metrics = {
        "accuracy": float(accuracy_score(y_test_u, preds_u)),
        "precision": float(precision_score(y_test_u, preds_u, zero_division=0)),
        "recall": float(recall_score(y_test_u, preds_u, zero_division=0)),
        "auc": float(roc_auc_score(y_test_u, probs_u)),
        "confusion_matrix": [int(tn_u), int(fp_u), int(fn_u), int(tp_u)],
        "roc_curve": {
            "fpr": fpr_points,
            "tpr": tpr_u_interp
        }
    }
    joblib.dump(model_upi, MODEL_PATH)
    
    model_cc.fit(X_train_c, y_train_c)
    preds_c = model_cc.predict(X_test_c)
    probs_c = model_cc.predict_proba(X_test_c)[:, 1]
    
    # Compute metrics for CC
    tn_c, fp_c, fn_c, tp_c = confusion_matrix(y_test_c, preds_c).ravel()
    fpr_c, tpr_c, _ = roc_curve(y_test_c, probs_c)
    tpr_c_interp = np.interp(fpr_points, fpr_c, tpr_c).tolist()
    
    cc_metrics = {
        "accuracy": float(accuracy_score(y_test_c, preds_c)),
        "precision": float(precision_score(y_test_c, preds_c, zero_division=0)),
        "recall": float(recall_score(y_test_c, preds_c, zero_division=0)),
        "auc": float(roc_auc_score(y_test_c, probs_c)),
        "confusion_matrix": [int(tn_c), int(fp_c), int(fn_c), int(tp_c)],
        "roc_curve": {
            "fpr": fpr_points,
            "tpr": tpr_c_interp
        }
    }
    joblib.dump(model_cc, MODEL_PATH_CC)
    
    metrics = {
        "upi": upi_metrics,
        "credit_card": cc_metrics
    }
    
    try:
        metrics_path = os.path.join(DATA_DIR, "metrics.json")
        with open(metrics_path, "w") as f:
            import json
            json.dump(metrics, f, indent=4)
        print(f"[INFO] Saved training metrics to {metrics_path}")
    except Exception as me:
        print(f"[WARNING] Failed to save metrics: {me}")
        
    print(f"[INFO] Trained {algorithm} models. UPI Metrics: {upi_metrics}. CC Metrics: {cc_metrics}")
    return metrics

if __name__ == "__main__":
    train_and_evaluate("rf")
