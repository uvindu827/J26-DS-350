"""
Step 04 - Daily ERA5-Land forcing per coastal cell.

Inputs : data/raw/era5_land/era5land_*.nc
         data/processed/era5land_points_to_cells.csv
Output : data/processed/forcing_era5land_daily.parquet
         evidence/pp1/E08_era5land_log.txt
         evidence/pp1/E08_era5land_forcing.png
Notes  : ERA5-Land accumulations at 00:00 UTC on day D+1 = total for day D,
         so dates are shifted back by one day. m -> mm for rain/runoff.
"""
from pathlib import Path
import numpy as np
import pandas as pd
import xarray as xr
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

RAW = Path("data/raw/era5_land")
OUT = Path("data/processed")
EVID = Path("evidence/pp1")
LOG_FILE = EVID / "E08_era5land_log.txt"
LOG_FILE.write_text("")

def log(msg=""):
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(str(msg) + "\n")

VARS = {"tp": "precip_mm", "sro": "surface_runoff_mm",
        "ssro": "subsurface_runoff_mm", "swvl1": "soil_moisture"}
START, END = "1997-01-01", "2025-12-31"

def prep(d):
    """Make all yearly files look the same before joining them."""
    if "valid_time" in d.dims:
        d = d.rename({"valid_time": "time"})
    extra = [c for c in ["number", "expver"] if c in d.variables]
    return d.drop_vars(extra)

# ------------------------------------------------------------ 1. open all years
files = sorted(RAW.glob("era5land_*.nc"))
log(f"ERA5-Land files found: {len(files)}")
ds = xr.open_mfdataset(files, combine="by_coords", preprocess=prep)
log(f"Variables in files: {list(ds.data_vars)}")
log(f"Raw time range: {str(ds.time.values[0])[:16]} -> {str(ds.time.values[-1])[:16]}")

# ------------------------------------------------------------ 2. pick each cell's land points and average
mapping = pd.read_csv(OUT / "era5land_points_to_cells.csv")
lat_da = xr.DataArray(mapping["latitude"].values, dims="p")
lon_da = xr.DataArray(mapping["longitude"].values, dims="p")
sub = ds[list(VARS)].sel(latitude=lat_da, longitude=lon_da, method="nearest")
sub = sub.assign_coords(cell_id=("p", mapping["cell_id"].to_numpy(dtype=str)))  # plain NumPy strings; xarray can't group on pandas Arrow strings
cell_mean = sub.groupby("cell_id").mean("p").load()

df = cell_mean.to_dataframe().reset_index()[["time", "cell_id"] + list(VARS)]
df = df.rename(columns=VARS)

# ------------------------------------------------------------ 3. shift dates + units
df["date"] = (pd.to_datetime(df["time"]) - pd.Timedelta(days=1)).dt.normalize()
df = df[(df["date"] >= START) & (df["date"] <= END)].drop(columns="time")
for col in ["precip_mm", "surface_runoff_mm", "subsurface_runoff_mm"]:
    df[col] = (df[col] * 1000).clip(lower=0)
df = df[["date", "cell_id", "precip_mm", "surface_runoff_mm",
         "subsurface_runoff_mm", "soil_moisture"]].sort_values(["cell_id", "date"])
# safety check: every coastal cell must be present
cells_all = pd.read_csv(OUT / "cells.csv")
expected = set(cells_all.loc[cells_all["is_coastal"], "cell_id"].astype(str))
got = set(df["cell_id"].astype(str))
if got != expected:
    raise SystemExit(f"ERROR: forcing is missing cells {sorted(expected - got)}. Stopping.")
df.to_parquet(OUT / "forcing_era5land_daily.parquet", index=False)

# ------------------------------------------------------------ 4. checks
n_days = len(pd.date_range(START, END, freq="D"))
log(f"\nCells: {df['cell_id'].nunique()} | days expected per cell: {n_days}")
log(f"Rows per cell (should all equal {n_days}):\n{df.groupby('cell_id').size().describe().to_string()}")
log(f"\nMissing values:\n{df.isnull().sum().to_string()}")
log(f"\nSummary:\n{df.describe().round(3).to_string()}")

# ------------------------------------------------------------ 5. evidence plots
cells = pd.read_csv(OUT / "cells.csv")[["cell_id", "region"]]
d2 = df.merge(cells, on="cell_id")
d2["month"] = d2["date"].dt.month
clim = d2.groupby(["region", "month"])["precip_mm"].mean().unstack(0)

fig, axes = plt.subplots(2, 1, figsize=(12, 8))
clim.plot(kind="bar", ax=axes[0])
axes[0].set_ylabel("Mean daily rainfall (mm)")
axes[0].set_title("Monthly rainfall climatology over catchments feeding coastal cells, 1997-2025")
example = d2[d2["cell_id"] == d2["cell_id"].iloc[0]]
example = example[example["date"].dt.year == 2018]
axes[1].bar(example["date"], example["precip_mm"], width=1, label="Rainfall (mm/day)")
axes[1].plot(example["date"], example["surface_runoff_mm"], color="red", label="Surface runoff (mm/day)")
axes[1].set_title(f"Daily forcing for {example['cell_id'].iloc[0]}, 2018")
axes[1].legend()
plt.tight_layout()
plt.savefig(EVID / "E08_era5land_forcing.png", dpi=150, bbox_inches="tight")
plt.close()

log("\nSaved: data/processed/forcing_era5land_daily.parquet, evidence E08")
log("Step 04 completed successfully.")