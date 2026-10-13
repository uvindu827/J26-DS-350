"""
Shared definitions for ALL Component 1 models (persistence, RF, XGBoost, Neural ODE).
Defining the task, features and metrics once guarantees every model is compared fairly.
"""
from pathlib import Path
import numpy as np
import pandas as pd

DATASET = Path("data/processed/model_dataset_daily.parquet")
NUTRIENTS = ["no3", "po4", "si"]
HORIZON = 7          # forecast lead times 1..7 days
SEED = 42

FORCING_RAW = ["precip_mm", "surface_runoff_mm", "subsurface_runoff_mm",
               "soil_moisture", "u10", "v10", "wind_speed"]
STATIC_RAW = ["lat", "lon"]
PROCESS_FEATURES = ["precip_sum_3d", "precip_sum_7d", "precip_sum_14d", "precip_sum_30d",
                    "surface_runoff_sum_3d", "surface_runoff_sum_7d",
                    "subsurface_runoff_sum_7d", "subsurface_runoff_sum_30d",
                    "wind_speed_mean_3d", "season_code", "doy_sin", "doy_cos"]
STATIC_PROCESS = ["catchment_area_km2", "n_river_outlets", "n_land_points", "dist_to_land_km"]

FEATURE_SETS = {
    "A_raw": FORCING_RAW + STATIC_RAW,
    "B_process": FORCING_RAW + STATIC_RAW + PROCESS_FEATURES + STATIC_PROCESS,
}
T0_COLS = [f"{v}_t0" for v in NUTRIENTS]          # nutrient state on day t0
TARGET_COLS = [f"{v}_target" for v in NUTRIENTS]  # nutrient values on day t0+h
STATE_INPUTS = T0_COLS + ["h"]


def load_dataset():
    df = pd.read_parquet(DATASET)
    for c in ["cell_id", "region", "split"]:
        df[c] = df[c].astype(str)
    df["date"] = pd.to_datetime(df["date"])
    return df.sort_values(["cell_id", "date"]).reset_index(drop=True)


def make_samples(df, horizon=HORIZON):
    """
    One row per (cell, start day t0, lead time h).
    Inputs : nutrient state at t0, h, and features measured on the TARGET day t0+h
             (antecedent totals on the target day summarise forcing across the window).
    Targets: nutrient values at t0+h.
    Windows whose target falls in a different split than t0 are removed (no leakage).
    """
    feats = sorted(set(FEATURE_SETS["B_process"]))
    frames = []
    g = df.groupby("cell_id", sort=False)
    for h in range(1, horizon + 1):
        tgt = g[feats + NUTRIENTS + ["date", "split"]].shift(-h)
        s = pd.DataFrame({"cell_id": df["cell_id"].to_numpy(dtype=str),
                          "region": df["region"].to_numpy(dtype=str),
                          "t0": df["date"].to_numpy(), "h": h,
                          "split": df["split"].to_numpy(dtype=str)})
        for v in NUTRIENTS:
            s[f"{v}_t0"] = df[v].to_numpy()
            s[f"{v}_target"] = tgt[v].to_numpy()
        for c in feats:
            s[c] = tgt[c].to_numpy()
        s["target_date"] = tgt["date"].to_numpy()
        s["target_split"] = tgt["split"].astype(object).to_numpy()
        frames.append(s)
    out = pd.concat(frames, ignore_index=True)
    out = out[out["target_split"] == out["split"]].drop(columns="target_split")
    num = [c for c in out.select_dtypes("number").columns if c != "h"]
    out[num] = out[num].astype("float32")
    return out.reset_index(drop=True)


def regression_metrics(y_true, y_pred):
    err = y_pred - y_true
    rmse = float(np.sqrt(np.mean(err ** 2)))
    mae = float(np.mean(np.abs(err)))
    ss_tot = float(np.sum((y_true - y_true.mean()) ** 2))
    r2 = float(1 - np.sum(err ** 2) / ss_tot) if ss_tot > 0 else np.nan
    return rmse, mae, r2


def evaluate(s, model_name, feature_set, horizon=HORIZON):
    """Metrics per split (val/test), subset (All/Western/Southern), lead time and nutrient.
    Expects columns <nutrient>_target and <nutrient>_pred."""
    rows = []
    for split in ["val", "test"]:
        ss = s[s["split"] == split]
        for subset in ["All", "Western", "Southern"]:
            sub = ss if subset == "All" else ss[ss["region"] == subset]
            for h in ["all"] + list(range(1, horizon + 1)):
                part = sub if h == "all" else sub[sub["h"] == h]
                for v in NUTRIENTS:
                    rmse, mae, r2 = regression_metrics(part[f"{v}_target"].to_numpy(),
                                                       part[f"{v}_pred"].to_numpy())
                    rows.append({"model": model_name, "features": feature_set, "split": split,
                                 "subset": subset, "h": str(h), "nutrient": v,
                                 "n": len(part), "rmse": rmse, "mae": mae, "r2": r2})
    return pd.DataFrame(rows)