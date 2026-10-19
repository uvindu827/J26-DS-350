"""Component 2: tuned-model inference and historical test exploration.

Historical test results are NOT operational next-day forecasts.
The /predict endpoint receives 69 ALREADY prepared model features.
"""
from functools import lru_cache
from pathlib import Path
import json
import math

import numpy as np
import pandas as pd
import xgboost as xgb

BACKEND_DIR = Path(__file__).resolve().parents[2]
PREDICTION_FILE = BACKEND_DIR / "data" / "xgboost_final_tuned_test_predictions.csv"
MODEL_DIR = BACKEND_DIR / "saved_models" / "xgboost_final_tuned"

@lru_cache(maxsize=1)
def load_historical_predictions():
    if not PREDICTION_FILE.is_file():
        raise FileNotFoundError(f"Missing historical predictions: {PREDICTION_FILE}")
    df = pd.read_csv(PREDICTION_FILE)
    required = {"date", "latitude", "longitude", "predicted_chl_mg_m3", "actual_chl_mg_m3", "productivity_class"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Historical CSV is missing: {sorted(missing)}")
    df["date"] = pd.to_datetime(df["date"], errors="raise").dt.strftime("%Y-%m-%d")
    if not df["productivity_class"].isin(["Low", "Medium", "High"]).all():
        raise ValueError("Invalid productivity class in predictions CSV")
    return df

def _row_to_dict(row):
    actual = row.get("actual_chl_mg_m3")
    return {
        "date": str(row["date"]),
        "latitude": float(row["latitude"]),
        "longitude": float(row["longitude"]),
        "predicted_chl_mg_m3": float(row["predicted_chl_mg_m3"]),
        "actual_chl_mg_m3": float(actual) if pd.notna(actual) else None,
        "productivity_class": str(row["productivity_class"]),
        "prediction_type": "historical_test",
    }

def get_historical_prediction(date, latitude: float, longitude: float):
    df = load_historical_predictions()
    selected = df.loc[(df["date"] == str(date)) &
                      ((df["latitude"] - latitude).abs() < 1e-5) &
                      ((df["longitude"] - longitude).abs() < 1e-5)]
    return None if selected.empty else _row_to_dict(selected.iloc[0])

def get_available_dates():
    return sorted(load_historical_predictions()["date"].dropna().unique().tolist())

def get_map_predictions(date, limit: int = 3000):
    df = load_historical_predictions()
    subset = df.loc[df["date"] == str(date)].sort_values(["latitude", "longitude"])
    if len(subset) > limit:
        raise ValueError(f"{len(subset)} cells exceed limit {limit}; implement paging or increase limit")
    return [_row_to_dict(row) for _, row in subset.iterrows()]

@lru_cache(maxsize=1)
def load_xgboost_artifacts():
    model_path = MODEL_DIR / "xgboost_final_tuned_candidate.json"
    feature_path = MODEL_DIR / "xgboost_final_tuned_candidate_features.csv"
    threshold_path = MODEL_DIR / "final_tuned_productivity_threshold_record.json"
    model = xgb.XGBRegressor()
    model.load_model(str(model_path))
    feature_df = pd.read_csv(feature_path)
    feature_names = feature_df["feature"].tolist()
    if feature_names != model.get_booster().feature_names:
        raise ValueError("Tuned model feature order disagrees with saved feature CSV")
    if len(feature_names) != 69:
        raise ValueError(f"Expected 69 tuned features; got {len(feature_names)}")
    with open(threshold_path, encoding="utf-8") as handle:
        thresholds = json.load(handle)
    low = float(thresholds["low_medium_boundary_mg_m3"])
    high = float(thresholds["medium_high_boundary_mg_m3"])
    if not 0 <= low < high:
        raise ValueError("Invalid CHL productivity thresholds")
    best = int(model.best_iteration)
    if best != 70:
        raise ValueError(f"Expected tuned model best_iteration=70; got {best}")
    return model, feature_names, low, high

def predict_chlorophyll(features: dict[str, float]):
    model, names, low, high = load_xgboost_artifacts()
    missing = sorted(set(names) - set(features))
    extra = sorted(set(features) - set(names))
    if missing or extra:
        raise ValueError(f"Missing features: {missing}; unexpected features: {extra}")
    if not all(isinstance(value, (int, float)) and not isinstance(value, bool)
               and math.isfinite(value) for value in features.values()):
        raise ValueError("All 69 prepared feature values must be finite numbers")
    frame = pd.DataFrame([[features[name] for name in names]], columns=names, dtype=float)
    pred_log = model.predict(frame, iteration_range=(0, model.best_iteration + 1))
    chl = max(float(np.expm1(pred_log[0])), 0.0)
    category = "Low" if chl < low else "Medium" if chl <= high else "High"
    return {
        "predicted_chl_mg_m3": chl,
        "productivity_class": category,
        "prediction_type": "direct_model_inference",
        "model_name": "XGBoost",
        "features_used": len(names),
    }

# Read-only research analysis, separate from live/next-day inference.
ENVIRONMENT_FIELDS = ('sst', 'sss', 'nitrate', 'phosphate', 'silicate')
READY_TEST_FILE = BACKEND_DIR / 'data' / 'final_model_ready_test.csv'

@lru_cache(maxsize=1)
def load_research_environment():
    if not READY_TEST_FILE.is_file():
        raise FileNotFoundError(f'Missing model-ready historical test data: {READY_TEST_FILE}')
    fields = ['date', 'latitude', 'longitude', *ENVIRONMENT_FIELDS]
    df = pd.read_csv(READY_TEST_FILE, usecols=fields)
    df['date'] = pd.to_datetime(df['date']).dt.strftime('%Y-%m-%d')
    df['lat_key'] = df['latitude'].round(5)
    df['lon_key'] = df['longitude'].round(5)
    if df.duplicated(['date', 'lat_key', 'lon_key']).any():
        raise ValueError('Duplicate date/location keys in model-ready test data')
    return df


def get_research_analysis(latitude: float, longitude: float, until_date: str, days: int = 90):
    """Return available historical test samples, never synthetic or future values.

    Environmental fields are STANDARDIZED model inputs, not original physical units.
    """
    predictions = load_historical_predictions()
    location = predictions.loc[
        (predictions['latitude'] - latitude).abs().lt(1e-5) &
        (predictions['longitude'] - longitude).abs().lt(1e-5) &
        predictions['date'].le(str(until_date))
    ].copy().sort_values('date').tail(days)
    if location.empty:
        return {'latitude': latitude, 'longitude': longitude,
                'until_date': str(until_date), 'environment_units': 'standardized_model_features',
                'count': 0, 'records': []}
    environment = load_research_environment()
    location['lat_key'] = location['latitude'].round(5)
    location['lon_key'] = location['longitude'].round(5)
    merged = location.merge(
        environment[['date', 'lat_key', 'lon_key', *ENVIRONMENT_FIELDS]],
        on=['date', 'lat_key', 'lon_key'], how='left', validate='one_to_one'
    )
    records = []
    for _, row in merged.iterrows():
        actual = row.get('actual_chl_mg_m3')
        predicted = float(row['predicted_chl_mg_m3'])
        values = {
            field: (float(row[field]) if pd.notna(row[field]) else None)
            for field in ENVIRONMENT_FIELDS
        }
        actual_value = float(actual) if pd.notna(actual) else None
        records.append({
            'date': str(row['date']),
            'actual_chl_mg_m3': actual_value,
            'predicted_chl_mg_m3': predicted,
            'absolute_error_mg_m3': abs(predicted - actual_value) if actual_value is not None else None,
            'productivity_class': str(row['productivity_class']),
            'environment': values,
        })
    return {'latitude': latitude, 'longitude': longitude, 'until_date': str(until_date),
            'environment_units': 'standardized_model_features',
            'count': len(records), 'records': records}
