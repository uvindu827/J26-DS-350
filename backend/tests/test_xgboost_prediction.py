
from pathlib import Path
import json

import numpy as np
import pandas as pd
import xgboost as xgb


BACKEND_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = BACKEND_DIR / "saved_models" / "xgboost"
DATA_FILE = BACKEND_DIR / "data" / "final_model_ready_test.csv"


print("\n=== COMPONENT 2: XGBOOST PREDICTION TEST ===\n")

# 1. Load trained model
model = xgb.XGBRegressor()
model.load_model(
    MODEL_DIR / "xgboost_chlorophyll_model_early_stopping.json"
)

# 2. Load the 69 feature names in their original order
feature_df = pd.read_csv(
    MODEL_DIR / "final_model_feature_columns.csv"
)
features = feature_df["feature"].tolist()

assert len(features) == 69
assert features == model.get_booster().feature_names

# 3. Load original productivity thresholds
with open(
    MODEL_DIR / "productivity_thresholds_training_only.json",
    encoding="utf-8",
) as file:
    thresholds = json.load(file)

low_threshold = thresholds["low_medium_threshold_mg_m3"]
high_threshold = thresholds["medium_high_threshold_mg_m3"]

# 4. Load ALREADY PREPROCESSED test data
if not DATA_FILE.exists():
    raise FileNotFoundError(
        f"Test sample not found: {DATA_FILE}"
    )

data = pd.read_csv(DATA_FILE)

missing_features = [
    feature for feature in features
    if feature not in data.columns
]

if missing_features:
    raise ValueError(
        f"Missing model features: {missing_features}"
    )

X_test = data.loc[:, features].copy()

if X_test.isna().any().any():
    raise ValueError(
        "Test sample contains missing feature values."
    )

print("Test rows:", len(X_test))
print("Model features:", X_test.shape[1])

# IMPORTANT:
# These features are already imputed and scaled.
# Do NOT apply the saved imputer/scaler again.

# 5. Predict using the best early-stopping iteration
prediction_log = model.predict(
    X_test,
    iteration_range=(0, model.best_iteration + 1)
)

# 6. Convert log1p(CHL) back to mg/m3
prediction_chl = np.expm1(prediction_log)

prediction_chl = np.maximum(prediction_chl, 0)

# 7. Classify predicted productivity potential
def classify_productivity(chl):
    if chl < low_threshold:
        return "Low"
    elif chl <= high_threshold:
        return "Medium"
    else:
        return "High"


classifications = [
    classify_productivity(value)
    for value in prediction_chl
]

# 8. Prepare result table
results = pd.DataFrame({
    "predicted_chl_mg_m3": prediction_chl,
    "productivity_class": classifications,
})

for column in ["date", "latitude", "longitude"]:
    if column in data.columns:
        results.insert(
            0, column, data[column].values
        )

if "chlorophyll_a" in data.columns:
    results["actual_chl_mg_m3"] = data[
        "chlorophyll_a"
    ].values

# 9. Display results
print("\n=== FIRST 10 PREDICTIONS ===")
print(results.head(10).to_string(index=False))

print("\n=== PRODUCTIVITY CLASSIFICATION COUNTS ===")
print(results["productivity_class"].value_counts())

print("\n=== PREDICTION SUMMARY ===")
print(
    "Minimum predicted CHL:",
    round(float(prediction_chl.min()), 4)
)

print(
    "Maximum predicted CHL:",
    round(float(prediction_chl.max()), 4)
)

print(
    "Mean predicted CHL:",
    round(float(prediction_chl.mean()), 4)
)

# 10. Save prediction results
output_file = BACKEND_DIR / "data" / "xgboost_test_predictions.csv"
results.to_csv(output_file, index=False)


from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)

if "actual_chl_mg_m3" in results.columns:
    y_true = results["actual_chl_mg_m3"]
    y_pred = results["predicted_chl_mg_m3"]

    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2 = r2_score(y_true, y_pred)

    print("\n=== MODEL EVALUATION ===")
    print(f"MAE:  {mae:.6f} mg/m³")
    print(f"RMSE: {rmse:.6f} mg/m³")
    print(f"R²:   {r2:.6f}")


print("\nPredictions saved to:", output_file)
print("\n=== PREDICTION TEST COMPLETED ===")
