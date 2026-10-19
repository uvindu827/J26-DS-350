r"""Run from backend folder: .\.venv\Scripts\python.exe tests\verify_tuned_backend.py"""
from pathlib import Path
import sys

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from app.services.forecast_service import (load_xgboost_artifacts, load_historical_predictions,
    get_historical_prediction, get_available_dates, get_map_predictions)

model, features, low, high = load_xgboost_artifacts()
print("Model:", model.__class__.__name__, "features:", len(features), "best_iteration:", model.best_iteration)
print("Thresholds:", low, high)
assert len(features) == 69 and model.best_iteration == 70

records = load_historical_predictions()
print("Test rows:", len(records)); assert len(records) == 157998
row = get_historical_prediction("2021-10-05", 5.8333335, 79.333336)
assert row is not None, "Expected first record missing"
print("First tuned historical row:", row)
assert abs(row["predicted_chl_mg_m3"] - 1.313774) < 2e-5
print("Available dates:", len(get_available_dates()))
print("Map cells on first date:", len(get_map_predictions("2021-10-05")))
print("=== TUNED BACKEND CHECK PASSED ===")
