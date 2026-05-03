import os
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, roc_auc_score

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")
CSV_PATH = os.path.join(DATA_DIR, "transactions.csv")

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
    
    # Target (Fraud)
    # Increase probability of fraud for high amount, late hours, new device, high location risk
    prob = 0.05 + 0.25 * (amount > 300) + 0.2 * np.isin(hour_of_day, [1, 2, 3, 4]) + 0.15 * device_risk + 0.3 * (location_risk > 0.7)
    prob = np.clip(prob, 0.0, 0.95)
    
    is_fraud = (np.random.rand(n_samples) < prob).astype(int)
    
    df = pd.DataFrame({
        "amount": amount,
        "hour_of_day": hour_of_day,
        "device_risk": device_risk,
        "location_risk": location_risk,
        "is_fraud": is_fraud
    })
    
    df.to_csv(CSV_PATH, index=False)
    print(f"[INFO] Generated synthetic dataset with {len(df)} records at {CSV_PATH}")
    return df

def train_and_evaluate(algorithm="rf"):
    if not os.path.exists(CSV_PATH):
        df = generate_synthetic_data()
    else:
        df = pd.read_csv(CSV_PATH)
        
    X = df[["amount", "hour_of_day", "device_risk", "location_risk"]]
    y = df["is_fraud"]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    if algorithm == "lr":
        model = LogisticRegression(random_state=42)
    else:
        model = RandomForestClassifier(n_estimators=100, random_state=42)
        
    model.fit(X_train, y_train)
    
    preds = model.predict(X_test)
    probs = model.predict_proba(X_test)[:, 1]
    
    metrics = {
        "accuracy": float(accuracy_score(y_test, preds)),
        "precision": float(precision_score(y_test, preds, zero_division=0)),
        "recall": float(recall_score(y_test, preds, zero_division=0)),
        "auc": float(roc_auc_score(y_test, probs))
    }
    
    joblib.dump(model, MODEL_PATH)
    print(f"[INFO] Trained {algorithm} and saved to {MODEL_PATH}. Metrics: {metrics}")
    return metrics

if __name__ == "__main__":
    train_and_evaluate("rf")
