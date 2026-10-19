"""Uses LOCAL already-preprocessed test features. FastAPI must be running."""
from pathlib import Path
import requests
import pandas as pd

BACKEND = Path(__file__).resolve().parents[1]
features = pd.read_csv(BACKEND / "saved_models/xgboost_final_tuned/xgboost_final_tuned_candidate_features.csv")["feature"].tolist()
test_data = pd.read_csv(BACKEND / "data/final_model_ready_test.csv", nrows=1)
payload = {name: float(test_data.iloc[0][name]) for name in features}
response = requests.post("http://127.0.0.1:8000/api/forecast/predict", json={"features": payload}, timeout=30)
print("Status:", response.status_code, "Body:", response.text)
response.raise_for_status()
result = response.json()
expected = pd.read_csv(BACKEND / "data/xgboost_final_tuned_test_predictions.csv", nrows=1).iloc[0]
actual = result["predicted_chl_mg_m3"]
reference = float(expected["predicted_chl_mg_m3"])
print("API prediction:", actual, "Tuned reference:", reference, "difference:", abs(actual - reference))
assert abs(actual - reference) < 1e-5
assert result["features_used"] == 69
print("=== TUNED DIRECT API TEST PASSED ===")
