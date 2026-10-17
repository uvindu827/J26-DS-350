
from pathlib import Path
import json
import warnings

import joblib
import pandas as pd
import xgboost as xgb

from sklearn.exceptions import InconsistentVersionWarning


# Locate the saved research artifacts
BACKEND_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = BACKEND_DIR / "saved_models" / "xgboost"

warnings.simplefilter("always", InconsistentVersionWarning)


print("\n=== COMPONENT 2: XGBOOST VERIFICATION ===\n")

# 1. Load the trained model
model = xgb.XGBRegressor()
model.load_model(
    MODEL_DIR / "xgboost_chlorophyll_model_early_stopping.json"
)

print("1. XGBoost model loaded successfully")
print("Model features:", model.n_features_in_)
print("Best iteration:", model.best_iteration)


# 2. Load the feature list
feature_file = MODEL_DIR / "final_model_feature_columns.csv"
feature_df = pd.read_csv(feature_file)

features = feature_df["feature"].tolist()

print("\n2. Feature list loaded")
print("Number of features:", len(features))

assert len(features) == 69, "Expected 69 features"
assert features == model.get_booster().feature_names, (
    "Feature order does not match the trained model"
)

print("Feature names and order match the model")


# 3. Load preprocessing artifacts
imputer = joblib.load(
    MODEL_DIR / "feature_median_imputer.joblib"
)

scaler = joblib.load(
    MODEL_DIR / "feature_standard_scaler.joblib"
)

print("\n3. Preprocessing artifacts loaded")

print("Imputer type:", type(imputer).__name__)
print("Scaler type:", type(scaler).__name__)

print(
    "Imputer feature count:",
    getattr(imputer, "n_features_in_", "Not recorded")
)

print(
    "Scaler feature count:",
    getattr(scaler, "n_features_in_", "Not recorded")
)

for name, transformer in [
    ("Imputer", imputer),
    ("Scaler", scaler),
]:
    count = getattr(transformer, "n_features_in_", None)

    if count is not None:
        assert count == len(features), (
            f"{name} expects {count} features, "
            f"but the model expects {len(features)}"
        )

    saved_names = getattr(
        transformer, "feature_names_in_", None
    )

    if saved_names is not None:
        assert list(saved_names) == features, (
            f"{name} feature order does not match"
        )

print("Preprocessing feature checks passed")


# 4. Verify productivity thresholds
with open(
    MODEL_DIR / "productivity_thresholds_training_only.json",
    encoding="utf-8",
) as file:
    thresholds = json.load(file)

low = thresholds["low_medium_threshold_mg_m3"]
high = thresholds["medium_high_threshold_mg_m3"]

assert 0 < low < high

print("\n4. Productivity thresholds loaded")
print("Low/Medium threshold:", low)
print("Medium/High threshold:", high)


print("\n=== ARTIFACT VERIFICATION PASSED ===")
print("Ready for historical prediction testing.")
