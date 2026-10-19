# """Component 2: historical test-data explorer and direct trained-model inference.

# Historical test results are NOT operational forecasts; all data are local research artifacts.
# """
# from functools import lru_cache
# from pathlib import Path
# import json
# import math
# import numpy as np
# import pandas as pd
# import xgboost as xgb

# BACKEND_DIR = Path(__file__).resolve().parents[2]
# PREDICTION_FILE = BACKEND_DIR / 'data' / 'xgboost_test_predictions.csv'
# MODEL_DIR = BACKEND_DIR / 'saved_models' / 'xgboost'

# @lru_cache(maxsize=1)
# def load_historical_predictions():
#     if not PREDICTION_FILE.is_file():
#         raise FileNotFoundError(f'Missing predictions: {PREDICTION_FILE}')
#     df = pd.read_csv(PREDICTION_FILE)
#     required = {'date', 'latitude', 'longitude', 'predicted_chl_mg_m3', 'productivity_class'}
#     missing = required - set(df.columns)
#     if missing:
#         raise ValueError(f'Missing columns: {sorted(missing)}')
#     df['date'] = pd.to_datetime(df['date'], errors='raise').dt.strftime('%Y-%m-%d')
#     return df

# def _row_to_dict(row):
#     actual = row.get('actual_chl_mg_m3', None)
#     return {
#         'date': str(row['date']),
#         'latitude': float(row['latitude']),
#         'longitude': float(row['longitude']),
#         'predicted_chl_mg_m3': float(row['predicted_chl_mg_m3']),
#         'actual_chl_mg_m3': float(actual) if pd.notna(actual) else None,
#         'productivity_class': str(row['productivity_class']),
#         'prediction_type': 'historical_test',
#     }

# def get_historical_prediction(date, latitude: float, longitude: float):
#     df = load_historical_predictions()
#     selected = df[(df['date'] == str(date)) &
#                   ((df['latitude'] - latitude).abs() < 0.00001) &
#                   ((df['longitude'] - longitude).abs() < 0.00001)]
#     if selected.empty:
#         return None
#     return _row_to_dict(selected.iloc[0])

# def get_available_dates():
#     df = load_historical_predictions()
#     return sorted(df['date'].dropna().unique().tolist())

# def get_map_predictions(date, limit: int = 3000):
#     df = load_historical_predictions()
#     subset = df.loc[df['date'] == str(date)].sort_values(['latitude', 'longitude'])
#     if len(subset) > limit:
#         # Preserve honest semantics: never silently draw a partial region.
#         raise ValueError(f'{len(subset)} cells exceed the map limit of {limit}; increase limit or add paging.')
#     return [_row_to_dict(row) for _, row in subset.iterrows()]

# @lru_cache(maxsize=1)
# def load_xgboost_artifacts():
#     model = xgb.XGBRegressor()
#     model.load_model(str(MODEL_DIR / 'xgboost_chlorophyll_model_early_stopping.json'))
#     features = pd.read_csv(MODEL_DIR / 'final_model_feature_columns.csv')['feature'].tolist()
#     with open(MODEL_DIR / 'productivity_thresholds_training_only.json', encoding='utf-8') as f:
#         thresholds = json.load(f)
#     if features != model.get_booster().feature_names:
#         raise ValueError('Saved model feature ordering differs from feature CSV')
#     return model, features, thresholds

# def predict_chlorophyll(features: dict[str, float]):
#     model, feature_names, thresholds = load_xgboost_artifacts()
#     missing = sorted(set(feature_names) - set(features))
#     extra = sorted(set(features) - set(feature_names))
#     if missing or extra:
#         raise ValueError(f'Missing features: {missing}; unexpected features: {extra}')
#     if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in features.values()):
#         raise ValueError('All 69 preprocessed values must be finite numbers')
#     frame = pd.DataFrame([[features[f] for f in feature_names]], columns=feature_names, dtype=float)
#     prediction_log = model.predict(frame, iteration_range=(0, model.best_iteration + 1))
#     chl = max(float(np.expm1(prediction_log[0])), 0.0)
#     low = thresholds['low_medium_threshold_mg_m3']
#     high = thresholds['medium_high_threshold_mg_m3']
#     category = 'Low' if chl < low else 'Medium' if chl <= high else 'High'
#     return {'predicted_chl_mg_m3': chl, 'productivity_class': category,
#             'prediction_type': 'direct_model_inference', 'model_name': 'XGBoost',
#             'features_used': len(feature_names)}

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
