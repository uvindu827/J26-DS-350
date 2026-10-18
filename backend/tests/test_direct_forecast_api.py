
from pathlib import Path

import pandas as pd
import requests


BACKEND_DIR = Path(__file__).resolve().parents[1]

MODEL_DIR = BACKEND_DIR / "saved_models" / "xgboost"
DATA_FILE = BACKEND_DIR / "data" / "final_model_ready_test.csv"

API_URL = "http://127.0.0.1:8000/api/forecast/predict"


print("\n=== DIRECT XGBOOST API TEST ===\n")

# 1. Load the original 69 model features
feature_df = pd.read_csv(
    MODEL_DIR / "final_model_feature_columns.csv"
)

features = feature_df["feature"].tolist()

# 2. Read one historical record
data = pd.read_csv(DATA_FILE, nrows=1)

# 3. Prepare the exact model inputs
feature_values = {
    name: float(data.iloc[0][name])
    for name in features
}

# 4. Send the prediction request
response = requests.post(
    API_URL,
    json={"features": feature_values},
    timeout=30,
)

print("HTTP status:", response.status_code)

response.raise_for_status()

result = response.json()

# 5. Show prediction results
print("\n=== XGBOOST API RESPONSE ===")
print("Predicted CHL:", result["predicted_chl_mg_m3"], "mg/m³")
print("Productivity class:", result["productivity_class"])
print("Model:", result["model_name"])
print("Features used:", result["features_used"])
print("Prediction type:", result["prediction_type"])

# 6. Compare with stored historical prediction
historical_file = (
    BACKEND_DIR / "data" / "xgboost_test_predictions.csv"
)

historical = pd.read_csv(historical_file, nrows=1)

expected = float(
    historical.iloc[0]["predicted_chl_mg_m3"]
)

actual = float(
    result["predicted_chl_mg_m3"]
)

difference = abs(expected - actual)

print("\n=== PREDICTION COMPARISON ===")
print("Stored historical prediction:", expected)
print("Direct API prediction:", actual)
print("Absolute difference:", difference)

assert difference < 1e-5, (
    "Direct API prediction does not match "
    "the previously validated historical prediction."
)

assert result["features_used"] == 69
assert result["productivity_class"] == (
    historical.iloc[0]["productivity_class"]
)

print("\n=== DIRECT API TEST PASSED ===")
