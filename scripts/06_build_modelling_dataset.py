"""
Step 06 - Build the aligned modelling dataset (date x coastal cell) with process-aware
features, Sri Lankan monsoon seasons and the chronological train/val/test split.

Inputs : data/processed/nutrients_coastal_daily.parquet
         data/processed/forcing_era5land_daily.parquet
         data/processed/forcing_wind_daily.parquet
         data/processed/cell_static_features.csv
Outputs: data/processed/model_dataset_daily.parquet
         experiments/split_config.json
         docs/data_dictionary.md
         evidence/pp1/E10_dataset_log.txt
         evidence/pp1/E10_split_plot.png
"""
from pathlib import Path
import json
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

P = Path("data/processed")
EVID = Path("evidence/pp1")
Path("experiments").mkdir(exist_ok=True)
Path("docs").mkdir(exist_ok=True)
LOG_FILE = EVID / "E10_dataset_log.txt"
LOG_FILE.write_text("")

def log(msg=""):
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(str(msg) + "\n")

SPLIT = {
    "train": ["1997-09-04", "2017-12-31"],
    "val":   ["2018-01-01", "2021-12-31"],
    "test":  ["2022-01-01", "2025-12-31"],
}
SEASONS = {  # Sri Lankan rainfall seasons
    3: "FIM", 4: "FIM",                                   # First Inter-Monsoon
    5: "SWM", 6: "SWM", 7: "SWM", 8: "SWM", 9: "SWM",     # Southwest Monsoon
    10: "SIM", 11: "SIM",                                 # Second Inter-Monsoon
    12: "NEM", 1: "NEM", 2: "NEM",                        # Northeast Monsoon
}
SEASON_CODE = {"NEM": 0, "FIM": 1, "SWM": 2, "SIM": 3}

# ------------------------------------------------------------ 1. load
nut = pd.read_parquet(P / "nutrients_coastal_daily.parquet")
land = pd.read_parquet(P / "forcing_era5land_daily.parquet")
wind = pd.read_parquet(P / "forcing_wind_daily.parquet")
static = pd.read_csv(P / "cell_static_features.csv")
for t in (nut, land, wind, static):
    t["cell_id"] = t["cell_id"].astype(str)
for t in (nut, land, wind):
    t["date"] = pd.to_datetime(t["date"])

# ------------------------------------------------------------ 2. forcing table + backward-looking features
# computed on the full forcing record (from 1 Jan 1997) so 30-day totals exist from Sept 1997
f = land.merge(wind, on=["date", "cell_id"], how="inner").sort_values(["cell_id", "date"])
g = f.groupby("cell_id")
def roll_sum(col, days):
    return g[col].transform(lambda s: s.rolling(days, min_periods=days).sum())
for d in (3, 7, 14, 30):
    f[f"precip_sum_{d}d"] = roll_sum("precip_mm", d)
for d in (3, 7):
    f[f"surface_runoff_sum_{d}d"] = roll_sum("surface_runoff_mm", d)
for d in (7, 30):
    f[f"subsurface_runoff_sum_{d}d"] = roll_sum("subsurface_runoff_mm", d)
f["wind_speed_mean_3d"] = g["wind_speed"].transform(lambda s: s.rolling(3, min_periods=3).mean())

# ------------------------------------------------------------ 3. join nutrients + forcing + static
df = nut.merge(f, on=["date", "cell_id"], how="left")
df = df.merge(static.drop(columns=["lat", "lon", "region"]), on="cell_id", how="left")

# ------------------------------------------------------------ 4. season + day-of-year
df["season"] = df["date"].dt.month.map(SEASONS)
df["season_code"] = df["season"].map(SEASON_CODE)
doy = df["date"].dt.dayofyear
df["doy_sin"] = np.sin(2 * np.pi * doy / 365.25)
df["doy_cos"] = np.cos(2 * np.pi * doy / 365.25)

# ------------------------------------------------------------ 5. chronological split
df["split"] = None
for name, (a, b) in SPLIT.items():
    df.loc[(df["date"] >= a) & (df["date"] <= b), "split"] = name
df = df.sort_values(["cell_id", "date"]).reset_index(drop=True)

# ------------------------------------------------------------ 6. checks
expected_rows = 12 * 10346
log(f"Rows: {len(df):,} (expected {expected_rows:,})")
log(f"Cells: {df['cell_id'].nunique()} | dates: {df['date'].min().date()} -> {df['date'].max().date()}")
na = df.isnull().sum()
log(f"\nColumns with missing values:\n{na[na > 0].to_string() if (na > 0).any() else 'none'}")
counts = df.groupby("split")["date"].agg(["min", "max", "count"])
counts["share_%"] = (100 * counts["count"] / len(df)).round(1)
log(f"\nChronological split:\n{counts.to_string()}")
log(f"\nRows per season:\n{df['season'].value_counts().to_string()}")
log(f"\nAll columns ({df.shape[1]}):\n{list(df.columns)}")
if len(df) != expected_rows or (na > 0).any():
    raise SystemExit("ERROR: dataset has wrong row count or missing values. Stopping.")
df.to_parquet(P / "model_dataset_daily.parquet", index=False)

# ------------------------------------------------------------ 7. save split config (goes into git)
(Path("experiments") / "split_config.json").write_text(json.dumps({
    "split": SPLIT, "seasons": SEASONS, "season_code": SEASON_CODE,
    "rows": len(df), "cells": int(df["cell_id"].nunique()),
    "note": "Whole calendar years; test period never used for tuning."}, indent=2))

# ------------------------------------------------------------ 8. data dictionary (goes into git)
DICT = [
    ("date", "Day (UTC-based daily aggregation)", "-", "-"),
    ("cell_id / lat / lon / region", "Copernicus 0.25° coastal cell and its region tag", "deg", "Copernicus grid"),
    ("no3 / po4 / si", "Surface nitrate / phosphate / silicate (model hindcast, no assimilation)", "mmol m-3", "Copernicus GLOBAL_MULTIYEAR_BGC_001_029"),
    ("precip_mm", "Daily total precipitation over the cell's catchments/land points", "mm/day", "ERA5-Land tp"),
    ("surface_runoff_mm", "Daily surface runoff (hydrological pathway proxy, not measured quickflow)", "mm/day", "ERA5-Land sro"),
    ("subsurface_runoff_mm", "Daily sub-surface runoff (proxy, not measured baseflow)", "mm/day", "ERA5-Land ssro"),
    ("soil_moisture", "Volumetric soil water, layer 1 (0-7 cm), 00 UTC", "m3/m3", "ERA5-Land swvl1"),
    ("u10 / v10 / wind_speed", "Daily mean 10 m wind components and speed", "m/s", "ERA5 single levels"),
    ("precip_sum_Nd", "Rainfall total over the previous N days incl. today", "mm", "derived"),
    ("surface_runoff_sum_Nd / subsurface_runoff_sum_Nd", "Runoff totals over the previous N days", "mm", "derived"),
    ("wind_speed_mean_3d", "Mean wind speed over the previous 3 days", "m/s", "derived"),
    ("season / season_code", "Sri Lankan season: NEM(0) FIM(1) SWM(2) SIM(3)", "-", "derived"),
    ("doy_sin / doy_cos", "Day of year as a seasonal cycle", "-", "derived"),
    ("catchment_area_km2 / n_subbasins / n_river_outlets", "Catchments assigned to the cell", "km2 / count", "HydroBASINS L9"),
    ("n_land_points / forcing_method / dist_to_land_km", "How land forcing was obtained for the cell", "count / - / km", "derived"),
    ("split", "train / val / test (whole calendar years)", "-", "experiments/split_config.json"),
]
lines = ["# Data dictionary - Component 1 modelling dataset", "",
         "| Column | Description | Unit | Source |", "|---|---|---|---|"]
lines += [f"| {a} | {b} | {c} | {d} |" for a, b, c, d in DICT]
(Path("docs") / "data_dictionary.md").write_text("\n".join(lines), encoding="utf-8")

# ------------------------------------------------------------ 9. evidence plot: one cell with split shading
cid = "N6.75_E79.75" if "N6.75_E79.75" in set(df["cell_id"]) else df["cell_id"].iloc[0]
one = df[df["cell_id"] == cid]
fig, axes = plt.subplots(4, 1, figsize=(13, 10), sharex=True)
for ax, v in zip(axes[:3], ["no3", "po4", "si"]):
    ax.plot(one["date"], one[v], lw=0.5, color="black")
    ax.set_ylabel(f"{v.upper()}\n(mmol m-3)")
axes[3].bar(one["date"], one["precip_mm"], width=1, color="steelblue")
axes[3].set_ylabel("Rainfall\n(mm/day)")
colours = {"train": "#d9ead3", "val": "#fff2cc", "test": "#f4cccc"}
for ax in axes:
    for name, (a, b) in SPLIT.items():
        ax.axvspan(pd.Timestamp(a), pd.Timestamp(b), color=colours[name], alpha=0.6, lw=0)
axes[0].set_title(f"{cid}: nutrients and catchment rainfall with chronological split "
                  "(green = train, yellow = validation, red = test)")
plt.savefig(EVID / "E10_split_plot.png", dpi=150, bbox_inches="tight")
plt.close()

log("\nSaved: model_dataset_daily.parquet, experiments/split_config.json, docs/data_dictionary.md, E10 plot")
log("Step 06 completed successfully.")