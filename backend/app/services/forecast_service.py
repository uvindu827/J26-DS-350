"""Component 2: historical test-data explorer and direct trained-model inference.

Historical test results are NOT operational forecasts; all data are local research artifacts.
"""
from functools import lru_cache
from pathlib import Path
import json
import math
import numpy as np
import pandas as pd
import xgboost as xgb

BACKEND_DIR = Path(__file__).resolve().parents[2]
PREDICTION_FILE = BACKEND_DIR / 'data' / 'xgboost_test_predictions.csv'
MODEL_DIR = BACKEND_DIR / 'saved_models' / 'xgboost'

@lru_cache(maxsize=1)
def load_historical_predictions():
    if not PREDICTION_FILE.is_file():
        raise FileNotFoundError(f'Missing predictions: {PREDICTION_FILE}')
    df = pd.read_csv(PREDICTION_FILE)
    required = {'date', 'latitude', 'longitude', 'predicted_chl_mg_m3', 'productivity_class'}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f'Missing columns: {sorted(missing)}')
    df['date'] = pd.to_datetime(df['date'], errors='raise').dt.strftime('%Y-%m-%d')
    return df

def _row_to_dict(row):
    actual = row.get('actual_chl_mg_m3', None)
    return {
        'date': str(row['date']),
        'latitude': float(row['latitude']),
        'longitude': float(row['longitude']),
        'predicted_chl_mg_m3': float(row['predicted_chl_mg_m3']),
        'actual_chl_mg_m3': float(actual) if pd.notna(actual) else None,
        'productivity_class': str(row['productivity_class']),
        'prediction_type': 'historical_test',
    }

def get_historical_prediction(date, latitude: float, longitude: float):
    df = load_historical_predictions()
    selected = df[(df['date'] == str(date)) &
                  ((df['latitude'] - latitude).abs() < 0.00001) &
                  ((df['longitude'] - longitude).abs() < 0.00001)]
    if selected.empty:
        return None
    return _row_to_dict(selected.iloc[0])

def get_available_dates():
    df = load_historical_predictions()
    return sorted(df['date'].dropna().unique().tolist())

def get_map_predictions(date, limit: int = 3000):
    df = load_historical_predictions()
    subset = df.loc[df['date'] == str(date)].sort_values(['latitude', 'longitude'])
    if len(subset) > limit:
        # Preserve honest semantics: never silently draw a partial region.
        raise ValueError(f'{len(subset)} cells exceed the map limit of {limit}; increase limit or add paging.')
    return [_row_to_dict(row) for _, row in subset.iterrows()]

@lru_cache(maxsize=1)
def load_xgboost_artifacts():
    model = xgb.XGBRegressor()
    model.load_model(str(MODEL_DIR / 'xgboost_chlorophyll_model_early_stopping.json'))
    features = pd.read_csv(MODEL_DIR / 'final_model_feature_columns.csv')['feature'].tolist()
    with open(MODEL_DIR / 'productivity_thresholds_training_only.json', encoding='utf-8') as f:
        thresholds = json.load(f)
    if features != model.get_booster().feature_names:
        raise ValueError('Saved model feature ordering differs from feature CSV')
    return model, features, thresholds

def predict_chlorophyll(features: dict[str, float]):
    model, feature_names, thresholds = load_xgboost_artifacts()
    missing = sorted(set(feature_names) - set(features))
    extra = sorted(set(features) - set(feature_names))
    if missing or extra:
        raise ValueError(f'Missing features: {missing}; unexpected features: {extra}')
    if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in features.values()):
        raise ValueError('All 69 preprocessed values must be finite numbers')
    frame = pd.DataFrame([[features[f] for f in feature_names]], columns=feature_names, dtype=float)
    prediction_log = model.predict(frame, iteration_range=(0, model.best_iteration + 1))
    chl = max(float(np.expm1(prediction_log[0])), 0.0)
    low = thresholds['low_medium_threshold_mg_m3']
    high = thresholds['medium_high_threshold_mg_m3']
    category = 'Low' if chl < low else 'Medium' if chl <= high else 'High'
    return {'predicted_chl_mg_m3': chl, 'productivity_class': category,
            'prediction_type': 'direct_model_inference', 'model_name': 'XGBoost',
            'features_used': len(feature_names)}
