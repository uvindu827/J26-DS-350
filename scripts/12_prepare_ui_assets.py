"""
Step 12 - Read-only UI assets for Component 1 (used by any frontend: React Native, web or Streamlit).
Reads only saved, validated outputs; changes nothing in the modelling pipeline.

Outputs in app_assets/:
  cells.json            12 cells: id, display name, region, coordinates, static features
  normals.parquet       cell x month x nutrient: p25 / p50 / p75 from TRAIN years only
  change_scale.parquet  cell x nutrient x lead h: 'stable' threshold = 0.5 x std of h-day change (TRAIN only)
  climatology.json      monthly rainfall, wind speed and direction per region and cell (1997-2025, descriptive)
  reliability.json      Neural ODE test error by lead day and skill vs no-change (3-seed means)
  geo.json              land outline, catchments by fed cell, cell squares (lon/lat GeoJSON)
  manifest.json         selected model run, file fingerprints, allowed issue dates
evidence/pp1/E28_ui_assets_log.txt
"""
from pathlib import Path
import hashlib
import json
import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import box, mapping

from common import NUTRIENTS, HORIZON, SEED, load_dataset

OUT = Path("app_assets"); OUT.mkdir(exist_ok=True)
P = Path("data/processed")
EVID = Path("evidence/pp1")
LOG_FILE = EVID / "E28_ui_assets_log.txt"
LOG_FILE.write_text("")

def log(msg=""):
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(str(msg) + "\n")

HB_FILE = Path("data/raw/hydrobasins/hybas_as_lev09_v1c.shp")
UTM = "EPSG:32644"
MAX_OUTLET_DIST_KM = 30                 # identical to Step 03
DISPLAY_BOX = (79.4, 5.6, 81.6, 7.5)    # lon_min, lat_min, lon_max, lat_max

NAMES = {  # display names for the coast each cell covers (editable labels, not data)
    "N7.00_E79.75": "Colombo coast",
    "N6.75_E79.75": "Panadura coast",
    "N6.50_E79.75": "Kalutara coast",
    "N6.25_E79.75": "Bentota offshore",
    "N6.25_E80.00": "Bentota–Ambalangoda coast",
    "N6.00_E80.00": "Hikkaduwa coast",
    "N6.00_E81.00": "Hambantota coast",
    "N5.75_E80.00": "Galle offshore (west)",
    "N5.75_E80.25": "Galle–Unawatuna offshore",
    "N5.75_E80.50": "Matara coast",
    "N5.75_E80.75": "Tangalle offshore",
    "N5.75_E81.00": "Hambantota offshore",
}
RIVERS = {  # main river of the catchments assigned to each cell (approximate display label)
    "N7.00_E79.75": "Kelani", "N6.75_E79.75": "Kalu", "N6.25_E80.00": "Bentota",
    "N6.00_E80.00": "Gin", "N5.75_E80.50": "Nilwala", "N6.00_E81.00": "Walawe",
}

# ------------------------------------------------------------ 1. cells
cells = pd.read_csv(P / "cells.csv"); cells["cell_id"] = cells["cell_id"].astype(str)
coastal = cells[cells["is_coastal"]].reset_index(drop=True)
static = pd.read_csv(P / "cell_static_features.csv"); static["cell_id"] = static["cell_id"].astype(str)
info = coastal[["cell_id", "lat", "lon", "region"]].merge(
    static.drop(columns=["lat", "lon", "region"], errors="ignore"), on="cell_id")
if set(info["cell_id"]) != set(NAMES):
    raise SystemExit("ERROR: display names do not match the 12 coastal cells.")
cell_list = [{
    "cell_id": r.cell_id, "name": NAMES[r.cell_id], "region": r.region,
    "lat": float(r.lat), "lon": float(r.lon), "main_river": RIVERS.get(r.cell_id),
    "forcing_method": r.forcing_method, "catchment_area_km2": round(float(r.catchment_area_km2), 1),
    "n_subbasins": int(r.n_subbasins), "n_river_outlets": int(r.n_river_outlets),
    "dist_to_land_km": round(float(r.dist_to_land_km), 1),
} for r in info.itertuples()]
(OUT / "cells.json").write_text(json.dumps(cell_list, indent=2, ensure_ascii=False), encoding="utf-8")
log(f"cells.json: {len(cell_list)} cells")

# ------------------------------------------------------------ 2. seasonal normals (TRAIN only)
df = load_dataset()
train = df[df["split"] == "train"].copy()
train["month"] = train["date"].dt.month
log(f"Normals period (train): {train['date'].min().date()} -> {train['date'].max().date()}")
long = train.melt(id_vars=["cell_id", "month"], value_vars=NUTRIENTS, var_name="nutrient", value_name="value")
q = long.groupby(["cell_id", "month", "nutrient"])["value"].quantile([0.25, 0.5, 0.75]).unstack()
q.columns = ["p25", "p50", "p75"]
normals = q.reset_index()
if len(normals) != 12 * 12 * 3 or normals[["p25", "p50", "p75"]].isnull().any().any():
    raise SystemExit("ERROR: normals table incomplete.")
normals.to_parquet(OUT / "normals.parquet", index=False)
log(f"normals.parquet: {len(normals)} rows (12 cells x 12 months x 3 nutrients)")

# ------------------------------------------------------------ 3. 'stable' thresholds (TRAIN only)
rows = []
for cid, g in train.sort_values("date").groupby("cell_id"):
    for v in NUTRIENTS:
        s = g[v].to_numpy()
        for h in range(1, HORIZON + 1):
            d = s[h:] - s[:-h]
            rows.append({"cell_id": cid, "nutrient": v, "h": h,
                         "std_change": float(np.std(d)), "stable_threshold": float(0.5 * np.std(d))})
change = pd.DataFrame(rows)
change.to_parquet(OUT / "change_scale.parquet", index=False)
log(f"change_scale.parquet: {len(change)} rows (12 x 3 x {HORIZON})")

# ------------------------------------------------------------ 4. climatology (descriptive, 1997-2025)
land = pd.read_parquet(P / "forcing_era5land_daily.parquet")
wind = pd.read_parquet(P / "forcing_wind_daily.parquet")
for t in (land, wind):
    t["cell_id"] = t["cell_id"].astype(str); t["date"] = pd.to_datetime(t["date"])
f = land.merge(wind, on=["date", "cell_id"]).merge(coastal[["cell_id", "region"]], on="cell_id")
f["month"] = f["date"].dt.month

def monthly(g):
    m = g.groupby("month").agg(precip_mm=("precip_mm", "mean"), wind_speed=("wind_speed", "mean"),
                               u10=("u10", "mean"), v10=("v10", "mean")).reset_index()
    return [{"month": int(r.month), "precip_mm": round(float(r.precip_mm), 2),
             "wind_speed": round(float(r.wind_speed), 2),
             "wind_dir_from_deg": round(float((270 - np.degrees(np.arctan2(r.v10, r.u10))) % 360))}
            for r in m.itertuples()]

clim = {"period": f"{f['date'].min().date()} to {f['date'].max().date()}",
        "by_region": {reg: monthly(g) for reg, g in f.groupby("region")},
        "by_cell": {cid: monthly(g) for cid, g in f.groupby("cell_id")}}
(OUT / "climatology.json").write_text(json.dumps(clim, indent=2), encoding="utf-8")
w_may = clim["by_region"]["Western"][4]
log(f"climatology.json: sanity check Western May rainfall {w_may['precip_mm']} mm/day "
    f"(E08 showed ~10.8), wind {w_may['wind_speed']} m/s from {w_may['wind_dir_from_deg']} deg")

# ------------------------------------------------------------ 5. reliability (test, 3-seed means)
s = pd.read_csv("experiments/results/seed_robustness_summary.csv")
s["h"] = s["h"].astype(str)
nd = s[(s["family"] == "NeuralODE") & (s["split"] == "test")]
rel = {"model": "Neural ODE",
       "basis": "test years 2022-2025 (never used for training or model selection); mean of 3 training runs",
       "metric": "typical error = RMSE in mmol m-3; skill = 1 - RMSE / RMSE of 'no change'",
       "nutrients": {}}
for v in NUTRIENTS:
    a = nd[nd["nutrient"] == v]
    by_h = [round(float(a[(a["subset"] == "All") & (a["h"] == str(h))]["rmse_mean"].iloc[0]), 5)
            for h in range(1, HORIZON + 1)]
    sk = {sub: round(float(a[(a["subset"] == sub) & (a["h"] == "all")]["skill_mean"].iloc[0]), 3)
          for sub in ["All", "Western", "Southern"]}
    rel["nutrients"][v] = {"rmse_by_lead": by_h, "skill_all": sk["All"],
                           "skill_western": sk["Western"], "skill_southern": sk["Southern"]}
    log(f"reliability {v}: RMSE day1 {by_h[0]} day7 {by_h[-1]} | skill all {sk['All']} "
        f"W {sk['Western']} S {sk['Southern']}")
(OUT / "reliability.json").write_text(json.dumps(rel, indent=2), encoding="utf-8")

# ------------------------------------------------------------ 6. map shapes (same assignment rule as Step 03)
basins = gpd.read_file(HB_FILE, bbox=(79.5, 5.8, 82.0, 10.0))
b = basins.to_crs(UTM)
cp = gpd.GeoDataFrame(coastal, geometry=gpd.points_from_xy(coastal["lon"], coastal["lat"]),
                      crs="EPSG:4326").to_crs(UTM)
outlets = b[b["NEXT_DOWN"] == 0].copy()
dist = np.vstack([cp.distance(g).values / 1000 for g in outlets.geometry])
outlets["nearest_cell"] = coastal["cell_id"].values[dist.argmin(axis=1)]
outlets["dist_km"] = dist.min(axis=1)
assigned = outlets[outlets["dist_km"] <= MAX_OUTLET_DIST_KM]
basins["cell_id"] = basins["MAIN_BAS"].map(dict(zip(assigned["MAIN_BAS"], assigned["nearest_cell"])))

area_check = basins.dropna(subset=["cell_id"]).groupby("cell_id")["SUB_AREA"].sum()
ref = static.set_index("cell_id")["catchment_area_km2"]
bad = [cid for cid, a in area_check.items() if abs(a - ref[cid]) > 0.5]
if bad or set(area_check.index) != set(ref[ref > 0].index):
    raise SystemExit(f"ERROR: catchment assignment differs from Step 03 for {bad}. Stopping.")
log(f"Catchment assignment matches Step 03 for all {len(area_check)} catchment-fed cells")

def union(gs):
    try:
        return gs.union_all()
    except AttributeError:
        return gs.unary_union

view = box(*DISPLAY_BOX)
features = [{"type": "Feature", "properties": {"layer": "land"},
             "geometry": mapping(union(basins.geometry).intersection(view).simplify(0.003, preserve_topology=True))}]
for cid, row in basins.dropna(subset=["cell_id"]).dissolve(by="cell_id").iterrows():
    features.append({"type": "Feature",
                     "properties": {"layer": "catchment", "cell_id": cid, "main_river": RIVERS.get(cid),
                                    "area_km2": round(float(ref[cid]), 1)},
                     "geometry": mapping(row.geometry.intersection(view).simplify(0.003, preserve_topology=True))})
for c in cell_list:
    features.append({"type": "Feature",
                     "properties": {"layer": "cell", "cell_id": c["cell_id"], "name": c["name"], "region": c["region"]},
                     "geometry": mapping(box(c["lon"] - 0.125, c["lat"] - 0.125, c["lon"] + 0.125, c["lat"] + 0.125))})
(OUT / "geo.json").write_text(json.dumps({"type": "FeatureCollection", "features": features}), encoding="utf-8")
log(f"geo.json: 1 land outline, {len(area_check)} catchment groups, {len(cell_list)} cells "
    f"({(OUT / 'geo.json').stat().st_size / 1e3:.0f} kB)")

# ------------------------------------------------------------ 7. manifest (model selected on VALIDATION loss)
def sha16(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()[:16]

suffix = lambda sd: "" if sd == SEED else f"_s{sd}"
cands = [(json.loads(Path(f"experiments/node{suffix(sd)}_config.json").read_text())["best_val_loss"], sd)
         for sd in [SEED, 7, 2026]]
best_seed = min(cands)[1]
node_file = f"experiments/models/node{suffix(best_seed)}_best.pt"
manifest = {
    "created": pd.Timestamp.now().isoformat(timespec="seconds"),
    "mode": "replay (hindcast forcing)",
    "issue_dates": {"first": "2022-01-01", "last": "2025-12-24"},
    "neural_ode": {"seed": best_seed, "file": node_file, "sha256_16": sha16(node_file),
                   "selection": "lowest validation loss among 3 seeds; test data not used"},
    "benchmark": {"name": "XGBoost B (process-aware)", "file": "experiments/models/xgb_B_process.json",
                  "sha256_16": sha16("experiments/models/xgb_B_process.json")},
    "dataset": {"file": "data/processed/model_dataset_daily.parquet", "rows": int(len(df))},
    "normals_period": [str(train["date"].min().date()), str(train["date"].max().date())],
}
(OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
log(f"manifest.json: Neural ODE seed {best_seed} ({manifest['neural_ode']['sha256_16']})")
log("Step 12 completed successfully.")