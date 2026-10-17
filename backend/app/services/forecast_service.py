
from functools import lru_cache
from pathlib import Path

import pandas as pd


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
