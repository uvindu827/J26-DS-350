"""
Step 03 - Link HydroBASINS Level 9 catchments and ERA5-Land grid points to coastal cells.

Inputs : data/processed/cells.csv
         data/raw/hydrobasins/hybas_as_lev09_v1c.shp
         data/raw/era5_land/era5land_2000.nc   (any one year, used only for grid + land mask)
Outputs: data/processed/era5land_points_to_cells.csv   (which land points feed which cell)
         data/processed/cell_static_features.csv        (catchment area etc. per cell)
         evidence/pp1/E07_catchment_mapping_log.txt
         evidence/pp1/E07_catchment_mapping_map.png
"""
from pathlib import Path
import numpy as np
import pandas as pd
import geopandas as gpd
import xarray as xr
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

HB_FILE = Path("data/raw/hydrobasins/hybas_as_lev09_v1c.shp")
ERA5L_SAMPLE = Path("data/raw/era5_land/era5land_2000.nc")
OUT = Path("data/processed")
EVID = Path("evidence/pp1")
LOG_FILE = EVID / "E07_catchment_mapping_log.txt"
LOG_FILE.write_text("")

def log(msg=""):
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(str(msg) + "\n")

SL_BBOX = (79.5, 5.8, 82.0, 10.0)  # lon_min, lat_min, lon_max, lat_max
UTM = "EPSG:32644"                 # UTM zone 44N, units = metres (covers Sri Lanka)
MAX_OUTLET_DIST_KM = 30            # river outlet must be within 30 km of a coastal cell
FALLBACK_RADIUS_KM = 30            # cells without rivers use land points within 30 km
N_NEAREST = 10                     # last resort: nearest 10 land points if none within 30 km

# ------------------------------------------------------------ 1. coastal cells
cells = pd.read_csv(OUT / "cells.csv")
coastal = cells[cells["is_coastal"]].reset_index(drop=True)
cell_pts = gpd.GeoDataFrame(
    coastal, geometry=gpd.points_from_xy(coastal["lon"], coastal["lat"]), crs="EPSG:4326"
).to_crs(UTM)
log(f"Coastal cells: {len(coastal)}")

# ------------------------------------------------------------ 2. catchments
basins = gpd.read_file(HB_FILE, bbox=SL_BBOX).to_crs(UTM)
log(f"HydroBASINS L9 sub-basins in Sri Lanka box: {len(basins)}")

outlets = basins[basins["NEXT_DOWN"] == 0].copy()
log(f"River systems reaching the sea (outlet basins): {len(outlets)}")

dist_km = np.vstack([cell_pts.distance(g).values / 1000 for g in outlets.geometry])
outlets["nearest_cell"] = coastal["cell_id"].values[dist_km.argmin(axis=1)]
outlets["dist_km"] = dist_km.min(axis=1)
assigned = outlets[outlets["dist_km"] <= MAX_OUTLET_DIST_KM]
log(f"Outlets within {MAX_OUTLET_DIST_KM} km of a coastal cell (assigned): {len(assigned)}")
log(f"Outlets further away (other coasts, not used): {len(outlets) - len(assigned)}")

main_to_cell = dict(zip(assigned["MAIN_BAS"], assigned["nearest_cell"]))
basins["cell_id"] = basins["MAIN_BAS"].map(main_to_cell)
log(f"Sub-basins assigned to a coastal cell: {basins['cell_id'].notna().sum()}")

# ------------------------------------------------------------ 3. ERA5-Land land grid points
ds = xr.open_dataset(ERA5L_SAMPLE)
if "valid_time" in ds.dims:
    ds = ds.rename({"valid_time": "time"})
sm = ds["swvl1"].isel(time=0)
for extra in [d for d in sm.dims if d not in ("latitude", "longitude")]:
    sm = sm.isel({extra: 0})
pts = (sm.to_dataframe(name="swvl1").reset_index()
         .dropna(subset=["swvl1"])[["latitude", "longitude"]])
pts_gdf = gpd.GeoDataFrame(
    pts, geometry=gpd.points_from_xy(pts["longitude"], pts["latitude"]), crs="EPSG:4326"
).to_crs(UTM)
log(f"ERA5-Land land points (0.1°) over Sri Lanka: {len(pts_gdf)}")

# points inside assigned catchments
joined = gpd.sjoin(pts_gdf, basins[["cell_id", "geometry"]], how="inner", predicate="within")
catch_map = (joined.dropna(subset=["cell_id"])[["latitude", "longitude", "cell_id"]]
             .drop_duplicates().assign(method="catchment"))

# fallback for cells with no catchment points
fallback = []
for _, c in cell_pts.iterrows():
    if (catch_map["cell_id"] == c["cell_id"]).any():
        continue
    d = pts_gdf.distance(c.geometry) / 1000
    near = pts_gdf[d <= FALLBACK_RADIUS_KM]
    method = f"local_{FALLBACK_RADIUS_KM}km"
    if near.empty:                                   # cell is further than 30 km from land
        near = pts_gdf.loc[d.nsmallest(N_NEAREST).index]
        method = f"nearest_{N_NEAREST}_points"
    fallback.append(pd.DataFrame({
        "latitude": near["latitude"].values, "longitude": near["longitude"].values,
        "cell_id": c["cell_id"], "method": method}))
mapping = pd.concat([catch_map] + fallback, ignore_index=True)

# distance from each cell centre to the nearest ERA5-Land land point (static feature)
cell_pts["dist_to_land_km"] = [(pts_gdf.distance(g) / 1000).min() for g in cell_pts.geometry]

# ------------------------------------------------------------ 4. static features per cell
catch_stats = (basins.dropna(subset=["cell_id"]).groupby("cell_id")
               .agg(catchment_area_km2=("SUB_AREA", "sum"), n_subbasins=("HYBAS_ID", "count"))
               .reset_index())
n_out = (assigned.groupby("nearest_cell").size().rename("n_river_outlets")
         .reset_index().rename(columns={"nearest_cell": "cell_id"}))
n_pts = (mapping.groupby("cell_id")
         .agg(n_land_points=("latitude", "size"), forcing_method=("method", "first"))
         .reset_index())
static = (coastal[["cell_id", "lat", "lon", "region"]]
          .merge(catch_stats, on="cell_id", how="left")
          .merge(n_out, on="cell_id", how="left")
          .merge(n_pts, on="cell_id", how="left")
          .merge(cell_pts[["cell_id", "dist_to_land_km"]], on="cell_id", how="left"))
static[["catchment_area_km2", "n_subbasins", "n_river_outlets", "n_land_points"]] = (
    static[["catchment_area_km2", "n_subbasins", "n_river_outlets", "n_land_points"]].fillna(0))
static.to_csv(OUT / "cell_static_features.csv", index=False)
log("\nStatic features per coastal cell:")
log(static.round(1).to_string(index=False))

missing = static[static["n_land_points"] == 0]
log(f"\nCells with NO land forcing at all: {len(missing)}")
log(f"Forcing method per cell:\n{static['forcing_method'].value_counts().to_string()}")
if len(missing) > 0:
    raise SystemExit("ERROR: some coastal cells have no land forcing - see table above. Stopping.")

# ------------------------------------------------------------ 5. evidence map
fig, ax = plt.subplots(figsize=(9, 9))
basins.to_crs("EPSG:4326").plot(ax=ax, color="lightgrey", edgecolor="white", linewidth=0.2)
b = basins.dropna(subset=["cell_id"]).to_crs("EPSG:4326")
b.plot(ax=ax, column="cell_id", categorical=True, cmap="tab20", edgecolor="white", linewidth=0.2)
c4326 = cell_pts.to_crs("EPSG:4326")
ax.scatter(c4326.geometry.x, c4326.geometry.y, c="red", s=60, marker="s", label="Coastal nutrient cell")
for _, r in c4326.iterrows():
    ax.annotate(r["cell_id"], (r.geometry.x, r.geometry.y), fontsize=6, xytext=(3, 3),
                textcoords="offset points")
ax.set_xlim(79.4, 82.0); ax.set_ylim(5.7, 8.0)
ax.legend(loc="upper right")
ax.set_title("HydroBASINS L9 catchments coloured by the coastal cell they feed (grey = not used)")
plt.savefig(EVID / "E07_catchment_mapping_map.png", dpi=150, bbox_inches="tight")
plt.close()

log("\nSaved: era5land_points_to_cells.csv, cell_static_features.csv, E07 map")
log("Step 03 completed successfully.")