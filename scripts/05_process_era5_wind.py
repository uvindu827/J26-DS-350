"""
Step 05 - Daily ERA5 10 m wind at each coastal cell.

Inputs : data/raw/era5/era5_wind_*.nc   (u10, v10 at 00/06/12/18 UTC)
         data/processed/cells.csv
Output : data/processed/forcing_wind_daily.parquet
         evidence/pp1/E09_wind_log.txt
         evidence/pp1/E09_wind_climatology.png
Notes  : wind speed is computed per 6-hourly reading, then averaged per day.
         ERA5 0.25° grid points coincide with the Copernicus cell centres.
"""
from pathlib import Path
import numpy as np
import pandas as pd
import xarray as xr
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

RAW = Path("data/raw/era5")
OUT = Path("data/processed")
EVID = Path("evidence/pp1")
LOG_FILE = EVID / "E09_wind_log.txt"
LOG_FILE.write_text("")

def log(msg=""):
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(str(msg) + "\n")

START, END = "1997-01-01", "2025-12-31"

def prep(d):
    if "valid_time" in d.dims:
        d = d.rename({"valid_time": "time"})
    extra = [c for c in ["number", "expver"] if c in d.variables]
    return d.drop_vars(extra)

# ------------------------------------------------------------ 1. open
files = sorted(RAW.glob("era5_wind_*.nc"))
log(f"ERA5 wind files found: {len(files)}")
ds = xr.open_mfdataset(files, combine="by_coords", preprocess=prep)
log(f"Variables: {list(ds.data_vars)}")
log(f"Raw time range: {str(ds.time.values[0])[:16]} -> {str(ds.time.values[-1])[:16]}")

# ------------------------------------------------------------ 2. take wind at each coastal cell centre
cells = pd.read_csv(OUT / "cells.csv")
coastal = cells[cells["is_coastal"]].reset_index(drop=True)
cell_ids = coastal["cell_id"].to_numpy(dtype=str)
lat_da = xr.DataArray(coastal["lat"].to_numpy(), dims="c")
lon_da = xr.DataArray(coastal["lon"].to_numpy(), dims="c")
pts = ds[["u10", "v10"]].sel(latitude=lat_da, longitude=lon_da, method="nearest").load()

offset = max(np.abs(pts["latitude"].values - coastal["lat"].to_numpy()).max(),
             np.abs(pts["longitude"].values - coastal["lon"].to_numpy()).max())
log(f"Max distance between wind grid point and cell centre: {offset:.4f} degrees")
if offset > 0.01:
    raise SystemExit("ERROR: wind grid does not line up with nutrient cells. Stopping.")

# ------------------------------------------------------------ 3. speed per reading, then daily mean
pts["wind_speed"] = np.sqrt(pts["u10"] ** 2 + pts["v10"] ** 2)
daily = pts.resample(time="1D").mean()

df = daily.to_dataframe().reset_index()
df["cell_id"] = cell_ids[df["c"].to_numpy()]
df = df.rename(columns={"time": "date"})[["date", "cell_id", "u10", "v10", "wind_speed"]]
df["date"] = pd.to_datetime(df["date"]).dt.normalize()
df = df[(df["date"] >= START) & (df["date"] <= END)].sort_values(["cell_id", "date"])

# ------------------------------------------------------------ 4. checks
n_days = len(pd.date_range(START, END, freq="D"))
log(f"\nCells: {df['cell_id'].nunique()} | days expected per cell: {n_days}")
log(f"Rows per cell:\n{df.groupby('cell_id').size().describe().to_string()}")
log(f"\nMissing values:\n{df.isnull().sum().to_string()}")
log(f"\nSummary (m/s):\n{df.describe().round(3).to_string()}")
if df["cell_id"].nunique() != len(coastal) or (df.groupby("cell_id").size() != n_days).any():
    raise SystemExit("ERROR: wind table is missing cells or days. Stopping.")
df.to_parquet(OUT / "forcing_wind_daily.parquet", index=False)

# ------------------------------------------------------------ 5. evidence: monthly wind climatology
d2 = df.merge(coastal[["cell_id", "region"]], on="cell_id")
d2["month"] = d2["date"].dt.month
clim = d2.groupby(["region", "month"])["wind_speed"].mean().unstack(0)
ax = clim.plot(kind="bar", figsize=(11, 4))
ax.set_ylabel("Mean daily 10 m wind speed (m/s)")
ax.set_title("Monthly wind speed climatology at coastal cells, 1997-2025 (ERA5)")
plt.savefig(EVID / "E09_wind_climatology.png", dpi=150, bbox_inches="tight")
plt.close()

log("\nSaved: data/processed/forcing_wind_daily.parquet, evidence E09")
log("Step 05 completed successfully.")