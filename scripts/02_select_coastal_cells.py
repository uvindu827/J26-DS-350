"""
Step 02 - Select coastal nutrient cells and build the daily nutrient table.

Input : data/raw/copernicus/*.nc   (Copernicus GLOBAL_MULTIYEAR_BGC_001_029, surface)
Output: data/processed/cells.csv                  (one row per grid cell)
        data/processed/nutrients_coastal_daily.parquet  (date x coastal cell)
        evidence/pp1/E05_coastal_cells_log.txt
        evidence/pp1/E05_coastal_cells_map.png
        evidence/pp1/E06_example_nutrient_series.png
"""
from pathlib import Path
import numpy as np
import pandas as pd
import xarray as xr
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

RAW = Path("data/raw/copernicus")
OUT = Path("data/processed")
EVID = Path("evidence/pp1")
OUT.mkdir(parents=True, exist_ok=True)
EVID.mkdir(parents=True, exist_ok=True)

LOG_FILE = EVID / "E05_coastal_cells_log.txt"
LOG_FILE.write_text("")  # start a fresh log

def log(msg=""):
    """Print to screen AND save to the evidence log."""
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(str(msg) + "\n")

NUTRIENTS = ["no3", "po4", "si"]
WESTERN_MIN_LAT = 6.5  # cells with centre latitude >= 6.5 N are tagged Western

# ---------------------------------------------------------------- 1. load
nc_file = sorted(RAW.glob("*.nc"))[0]
log(f"Input file: {nc_file.name}")
ds = xr.open_dataset(nc_file)[NUTRIENTS].squeeze("depth", drop=True)
lats = ds["latitude"].values
lons = ds["longitude"].values
log(f"Grid: {len(lats)} lat x {len(lons)} lon = {len(lats) * len(lons)} cells")

# ---------------------------------------------------------------- 2. date check
expected = pd.date_range(ds.time.values[0], ds.time.values[-1], freq="D")
log(f"Dates: {str(ds.time.values[0])[:10]} -> {str(ds.time.values[-1])[:10]}")
log(f"Days in file: {ds.sizes['time']} | days expected: {len(expected)} | "
    f"missing days: {len(expected) - ds.sizes['time']}")

# ---------------------------------------------------------------- 3. land / ocean
all_nan = ds["no3"].isnull().all("time").values                  # always blank -> land
complete = np.logical_and.reduce(
    [ds[v].notnull().all("time").values for v in NUTRIENTS])     # never blank, all 3 nutrients
partial = ~all_nan & ~complete                                  # sometimes blank (problem cells)

log(f"Land cells (always empty): {all_nan.sum()}")
log(f"Ocean cells with complete data: {complete.sum()}")
log(f"Cells with partial gaps (excluded): {partial.sum()}")

# ---------------------------------------------------------------- 4. coastal = ocean cell touching land
land = all_nan
padded = np.pad(land, 1, constant_values=False)  # outside the box is treated as 'not land'
touches_land = np.zeros_like(land)
for di in (-1, 0, 1):
    for dj in (-1, 0, 1):
        if di == 0 and dj == 0:
            continue
        touches_land |= padded[1 + di:1 + di + land.shape[0], 1 + dj:1 + dj + land.shape[1]]
coastal = complete & touches_land

# ---------------------------------------------------------------- 5. cell table
rows = []
for i, lat in enumerate(lats):
    for j, lon in enumerate(lons):
        rows.append({
            "cell_id": f"N{lat:.2f}_E{lon:.2f}",
            "lat": round(float(lat), 2),
            "lon": round(float(lon), 2),
            "is_land": bool(all_nan[i, j]),
            "is_complete_ocean": bool(complete[i, j]),
            "is_coastal": bool(coastal[i, j]),
            "region": "Western" if lat >= WESTERN_MIN_LAT else "Southern",
        })
cells = pd.DataFrame(rows)
cells.to_csv(OUT / "cells.csv", index=False)

coastal_cells = cells[cells["is_coastal"]].reset_index(drop=True)
log(f"\nCoastal cells selected: {len(coastal_cells)}")
log(coastal_cells["region"].value_counts().to_string())
log("\n" + coastal_cells[["cell_id", "lat", "lon", "region"]].to_string(index=False))

# ---------------------------------------------------------------- 6. long daily table
df = ds.to_dataframe().reset_index()
df["lat"] = df["latitude"].round(2)
df["lon"] = df["longitude"].round(2)
df = df.merge(coastal_cells[["cell_id", "lat", "lon", "region"]], on=["lat", "lon"], how="inner")
df = df.rename(columns={"time": "date"})[["date", "cell_id", "lat", "lon", "region"] + NUTRIENTS]
df = df.sort_values(["cell_id", "date"]).reset_index(drop=True)
df.to_parquet(OUT / "nutrients_coastal_daily.parquet", index=False)

log(f"\nNutrient table rows: {len(df):,}  (= {len(coastal_cells)} cells x {ds.sizes['time']} days)")
log(f"Missing values per nutrient:\n{df[NUTRIENTS].isnull().sum().to_string()}")
log(f"\nSummary statistics (mmol m-3):\n{df[NUTRIENTS].describe().round(4).to_string()}")

# ---------------------------------------------------------------- 7. evidence: map
mean_no3 = ds["no3"].mean("time")
fig, ax = plt.subplots(figsize=(8, 6))
mean_no3.plot(ax=ax, cmap="viridis", cbar_kwargs={"label": "Mean NO3 (mmol m-3), 1997-2025"})
for _, c in coastal_cells.iterrows():
    colour = "red" if c["region"] == "Western" else "orange"
    ax.scatter(c["lon"], c["lat"], s=120, facecolors="none", edgecolors=colour, linewidths=2)
ax.scatter([], [], facecolors="none", edgecolors="red", label="Coastal - Western")
ax.scatter([], [], facecolors="none", edgecolors="orange", label="Coastal - Southern")
ax.legend(loc="lower left")
ax.set_title("Copernicus 0.25° cells: selected coastal cells (blank = land)")
plt.savefig(EVID / "E05_coastal_cells_map.png", dpi=150, bbox_inches="tight")
plt.close()

# ---------------------------------------------------------------- 8. evidence: example series
fig, axes = plt.subplots(3, 1, figsize=(12, 8), sharex=True)
for region in ["Western", "Southern"]:
    sub = coastal_cells[coastal_cells["region"] == region]
    if sub.empty:
        continue
    cid = sub["cell_id"].iloc[0]
    one = df[df["cell_id"] == cid]
    for ax, v in zip(axes, NUTRIENTS):
        ax.plot(one["date"], one[v], lw=0.6, label=f"{region}: {cid}")
        ax.set_ylabel(f"{v.upper()} (mmol m-3)")
axes[0].legend()
axes[0].set_title("Daily surface nutrients at one Western and one Southern coastal cell")
plt.savefig(EVID / "E06_example_nutrient_series.png", dpi=150, bbox_inches="tight")
plt.close()

log("\nSaved: data/processed/cells.csv, data/processed/nutrients_coastal_daily.parquet")
log("Saved: evidence/pp1/E05_coastal_cells_map.png, evidence/pp1/E06_example_nutrient_series.png")
log("Step 02 completed successfully.")