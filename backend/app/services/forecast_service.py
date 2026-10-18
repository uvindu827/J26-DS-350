
from functools import lru_cache
from pathlib import Path

import pandas as pd

import json
import math

import numpy as np
import xgboost as xgb

BACKEND_DIR = Path(__file__).resolve().parents[2]

PREDICTION_FILE = (
    BACKEND_DIR / "data" / "xgboost_test_predictions.csv"
)


@lru_cache(maxsize=1)
def load_historical_predictions():
    if not PREDICTION_FILE.exists():
        raise FileNotFoundError(
            f"Historical predictions not found: {PREDICTION_FILE}"
        )

    df = pd.read_csv(PREDICTION_FILE)

    required_columns = [
        "date",
        "latitude",
        "longitude",
        "predicted_chl_mg_m3",
        "productivity_class",
    ]

    missing = [
        col for col in required_columns
        if col not in df.columns
    ]

    if missing:
        raise ValueError(
            f"Missing required columns: {missing}"
        )

    df["date"] = pd.to_datetime(df["date"]).dt.date

    return df


def get_historical_prediction(
    date,
    latitude: float,
    longitude: float,
):
    df = load_historical_predictions()

    # Match the geographical grid coordinates
    matches = df[
        (df["date"] == date)
        & ((df["latitude"] - latitude).abs() < 0.00001)
        & ((df["longitude"] - longitude).abs() < 0.00001)
    ]

    if matches.empty:
        return None

    row = matches.iloc[0]

    actual_chl = None

    if (
        "actual_chl_mg_m3" in df.columns
        and pd.notna(row["actual_chl_mg_m3"])
    ):
        actual_chl = float(row["actual_chl_mg_m3"])

    return {
        "date": str(row["date"]),
        "latitude": float(row["latitude"]),
        "longitude": float(row["longitude"]),
        "predicted_chl_mg_m3": float(
            row["predicted_chl_mg_m3"]
        ),
        "actual_chl_mg_m3": actual_chl,
        "productivity_class": str(
            row["productivity_class"]
        ),
        "prediction_type": "historical_test",
    }


# ======================================================
# DIRECT XGBOOST MODEL INFERENCE
# ======================================================

MODEL_DIR = BACKEND_DIR / "saved_models" / "xgboost"


@lru_cache(maxsize=1)
def load_xgboost_artifacts():
    """Load and cache the trained model and configuration."""

    model = xgb.XGBRegressor()
    model.load_model(
        MODEL_DIR / "xgboost_chlorophyll_model_early_stopping.json"
    )

    feature_df = pd.read_csv(
        MODEL_DIR / "final_model_feature_columns.csv"
    )
    feature_names = feature_df["feature"].tolist()

    with open(
        MODEL_DIR / "productivity_thresholds_training_only.json",
        encoding="utf-8",
    ) as file:
        thresholds = json.load(file)

    if feature_names != model.get_booster().feature_names:
        raise ValueError(
            "Model feature names or order do not match."
        )

    return model, feature_names, thresholds


def predict_chlorophyll(features: dict[str, float]):
    """
    Predict CHL using 69 already-preprocessed features.

    IMPORTANT: Do not impute or scale these inputs again.
    """

    model, feature_names, thresholds = load_xgboost_artifacts()

    missing = sorted(set(feature_names) - set(features))
    unexpected = sorted(set(features) - set(feature_names))

    if missing or unexpected:
        raise ValueError(
            f"Missing features: {missing}. "
            f"Unexpected features: {unexpected}."
        )

    if any(not math.isfinite(value) for value in features.values()):
        raise ValueError("All feature values must be finite.")

    # Preserve the exact model-training feature order
    input_df = pd.DataFrame(
        [[features[name] for name in feature_names]],
        columns=feature_names,
        dtype=float,
    )

    # Predict using the selected early-stopping iteration
    prediction_log = model.predict(
        input_df,
        iteration_range=(0, model.best_iteration + 1),
    )

    # Inverse log1p transformation
    predicted_chl = float(
        np.maximum(np.expm1(prediction_log[0]), 0.0)
    )

    low_threshold = thresholds[
        "low_medium_threshold_mg_m3"
    ]
    high_threshold = thresholds[
        "medium_high_threshold_mg_m3"
    ]

    if predicted_chl < low_threshold:
        productivity_class = "Low"
    elif predicted_chl <= high_threshold:
        productivity_class = "Medium"
    else:
        productivity_class = "High"

    return {
        "predicted_chl_mg_m3": predicted_chl,
        "productivity_class": productivity_class,
        "prediction_type": "direct_model_inference",
        "model_name": "XGBoost",
        "features_used": len(feature_names),
    }
