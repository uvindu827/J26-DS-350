"""
Step 15 - EDA and data-quality evidence for Component 1 (READ-ONLY).

Reads  : data/processed/model_dataset_daily.parquet
         experiments/split_config.json
Writes : evidence/pp1/E32_eda_data_quality_log.txt   validation checks + key numbers
         evidence/pp1/E33_dataset_profile.csv        dataset, cells, split, missing values, checks
         evidence/pp1/E34_descriptive_statistics.csv statistics + outlier flags (nothing removed)
         evidence/pp1/E35_nutrient_distributions.png histograms + monthly boxplots
         evidence/pp1/E36_lag_correlations.png       within-cell lag correlations, training years
         evidence/pp1/E36_lag_correlations.csv       the numbers behind E36
         docs/eda_data_quality_summary.md            written summary

Nothing else is written. No data, feature, split or model is changed and nothing is retrained.
The dataset file's SHA-256 fingerprint is checked before and after the run.
If any output already exists the script stops without writing, unless --overwrite is given.

Data notes
- NO3, PO4, Si are Copernicus Marine model-derived hindcast fields (no data assimilation),
  not field or in-situ measurements. Rainfall, runoff, soil moisture and wind are ERA5 / ERA5-Land
  reanalysis.

Lag method (fixed before looking at results)
- Training years only (split == "train", 1997-09-04 to 2017-12-31).
- Per cell, each variable's smoothed day-of-year mean (31-day circular window, training years) is
  removed, so the shared monsoon cycle does not dominate the correlation.
- Within each cell: Spearman correlation between the nutrient anomaly on day t and the driver
  anomaly on day t - L, for L = 0..30. Cells are never pooled; results are then summarised across
  cells (median, min, max) for Western, Southern and all cells.
- Descriptive only: no p-values (daily series are autocorrelated). Correlation is not causation.
- The 3/7/14/30-day windows were chosen beforehand from hydrological reasoning; this is supporting
  evidence, not feature selection.
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import sys
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
sys.path.insert(0, str(ROOT / "scripts"))
from common import NUTRIENTS, load_dataset  # noqa: E402

parser = argparse.ArgumentParser(description="Read-only EDA and data-quality evidence (Step 15).")
parser.add_argument("--overwrite", action="store_true", help="replace existing E32-E36 outputs")
args = parser.parse_args()

DATASET = Path("data/processed/model_dataset_daily.parquet")
SPLIT_CONFIG = Path("experiments/split_config.json")
EVID = Path("evidence/pp1")
OUT = {
    "log": EVID / "E32_eda_data_quality_log.txt",
    "profile": EVID / "E33_dataset_profile.csv",
    "stats": EVID / "E34_descriptive_statistics.csv",
    "dist_png": EVID / "E35_nutrient_distributions.png",
    "lag_png": EVID / "E36_lag_correlations.png",
    "lag_csv": EVID / "E36_lag_correlations.csv",
    "summary": Path("docs/eda_data_quality_summary.md"),
}

# ------------------------------------------------------------------ evidence protection (before writing anything)
existing = [str(p) for p in OUT.values() if p.exists()]
if existing and not args.overwrite:
    print("STOPPED: these outputs already exist and were not changed:")
    for p in existing:
        print("  " + p)
    print("Run again with --overwrite only if you intend to replace them.")
    raise SystemExit(1)
EVID.mkdir(parents=True, exist_ok=True)
Path("docs").mkdir(exist_ok=True)
OUT["log"].write_text("", encoding="utf-8")


def log(msg=""):
    print(msg)
    with open(OUT["log"], "a", encoding="utf-8") as f:
        f.write(str(msg) + "\n")


CHECKS = []


def check(name, ok, detail=""):
    CHECKS.append((name, bool(ok), detail))
    log(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f"  ({detail})" if detail else ""))


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


# ------------------------------------------------------------------ constants
EXPECTED = {"rows": 124152, "cols": 35, "cells": 12, "Western": 3, "Southern": 9,
            "first": "1997-09-04", "last": "2025-12-31", "days_per_cell": 10346, "train_days": 7424}
UNITS = {"no3": "mmol m-3", "po4": "mmol m-3", "si": "mmol m-3", "precip_mm": "mm/day",
         "surface_runoff_mm": "mm/day", "subsurface_runoff_mm": "mm/day", "soil_moisture": "m3/m3",
         "wind_speed": "m/s"}
LABEL = {"no3": "Nitrate (NO₃)", "po4": "Phosphate (PO₄)", "si": "Silicate (Si)"}
ENV_VARS = ["precip_mm", "surface_runoff_mm", "subsurface_runoff_mm", "soil_moisture", "wind_speed"]
DRIVERS = {"precip_mm": "Rainfall", "surface_runoff_mm": "Surface runoff",
           "subsurface_runoff_mm": "Sub-surface runoff"}
LAGS = list(range(0, 31))
MARK_LAGS = [3, 7, 14, 30]
MIN_PAIRS = EXPECTED["train_days"] - max(LAGS)          # 7,394
NEGLIGIBLE = 0.10
NEAR_ZERO = 0.01                                         # mmol m-3
PLAUSIBLE_MAX = {"no3": 50, "po4": 5, "si": 150}
SEASONS = {"NEM": "Northeast Monsoon", "FIM": "First Inter-Monsoon", "SWM": "Southwest Monsoon",
           "SIM": "Second Inter-Monsoon"}
SEASON_OF_MONTH = {12: "NEM", 1: "NEM", 2: "NEM", 3: "FIM", 4: "FIM", 5: "SWM", 6: "SWM", 7: "SWM",
                   8: "SWM", 9: "SWM", 10: "SIM", 11: "SIM"}
SEASON_COLOUR = {"NEM": "#3B6FD8", "FIM": "#B98900", "SWM": "#0E8C8A", "SIM": "#7A55C7"}
REGION_COLOUR = {"Western": "#0B6E78", "Southern": "#D0661F"}
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

WINDOWS_STATEMENT = (
    "The existing 3-, 7-, 14- and 30-day rainfall and runoff windows were selected a priori in Step 06 "
    "from hydrological reasoning (storm response within days, then weekly, two-week and monthly "
    "catchment memory, following the ML-SWAN-inspired design), before any model was trained. This lag "
    "analysis is supporting, descriptive evidence only. It was not used to select, add or remove "
    "features, and no model was retrained.")
CAUSATION_STATEMENT = (
    "Correlation is not causation. These correlations describe association between reanalysis forcing "
    "and model-derived nutrient fields; they do not show that rainfall or runoff causes nutrient changes.")
DATA_STATEMENT = (
    "NO3, PO4 and Si are Copernicus Marine model-derived hindcast fields (no data assimilation), not "
    "field or in-situ measurements. Rainfall, runoff, soil moisture and wind are ERA5 / ERA5-Land reanalysis.")

plt.rcParams.update({"font.size": 10, "axes.spines.top": False, "axes.spines.right": False,
                     "axes.titleweight": "bold"})
PROFILE = []                                             # rows for E33


def prof(section, item, value, note=""):
    PROFILE.append({"section": section, "item": item, "value": value, "note": note})


# ================================================================== 1. load and validate
log("STEP 15 - EDA AND DATA-QUALITY EVIDENCE (read-only)")
log("=" * 72)
log(DATA_STATEMENT)
sha_before = sha256(DATASET)
log(f"\nDataset: {DATASET}  (SHA-256 {sha_before[:16]}...)")

df = load_dataset()
cfg = json.loads(SPLIT_CONFIG.read_text(encoding="utf-8"))["split"]
n_cols = df.shape[1]
cell_region = df.groupby("cell_id")["region"].agg(["first", "nunique"])
region_counts = cell_region["first"].value_counts().to_dict()
per_cell = df.groupby("cell_id")["date"].agg(days="count", max_step=lambda s: int(s.diff().dt.days.max()))

log(f"Rows {len(df):,} | columns {n_cols} | cells {df['cell_id'].nunique()} | "
    f"{df['date'].min().date()} -> {df['date'].max().date()}")
log(f"Cells per region: {region_counts}")

log("\nValidation checks:")
check("row count is 124,152", len(df) == EXPECTED["rows"], f"{len(df):,}")
check("column count is 35", n_cols == EXPECTED["cols"], f"{n_cols}")
check("12 coastal cells", df["cell_id"].nunique() == EXPECTED["cells"], f"{df['cell_id'].nunique()}")
check("3 Western and 9 Southern cells",
      region_counts.get("Western") == EXPECTED["Western"] and region_counts.get("Southern") == EXPECTED["Southern"],
      str(region_counts))
check("each cell has a single region", (cell_region["nunique"] == 1).all())
check("date range 1997-09-04 to 2025-12-31",
      str(df["date"].min().date()) == EXPECTED["first"] and str(df["date"].max().date()) == EXPECTED["last"])
check("every cell has 10,346 days", (per_cell["days"] == EXPECTED["days_per_cell"]).all())
check("no gaps between days in any cell", (per_cell["max_step"] == 1).all())
check("no duplicate cell-date rows", not df.duplicated(["cell_id", "date"]).any())
missing = df.isnull().sum()
check("zero missing values in all 35 columns", int(missing.sum()) == 0, f"{int(missing.sum())} missing")
check("split labels are only train / val / test", set(df["split"].unique()) == {"train", "val", "test"})
split_rows = []
for name in ["train", "val", "test"]:
    s = df.loc[df["split"] == name, "date"]
    a, b = cfg[name]
    ok = str(s.min().date()) == a and str(s.max().date()) == b
    check(f"{name} boundaries match split_config.json", ok, f"{s.min().date()} -> {s.max().date()}")
    split_rows.append({"split": name, "first": str(s.min().date()), "last": str(s.max().date()),
                       "days": int(s.nunique()), "rows": int(len(s)), "share_pct": round(100 * len(s) / len(df), 1),
                       "matches_config": ok})
split_df = pd.DataFrame(split_rows)
date_sets = [set(df.loc[df["split"] == n, "date"]) for n in ["train", "val", "test"]]
check("splits do not overlap in time",
      not (date_sets[0] & date_sets[1] or date_sets[0] & date_sets[2] or date_sets[1] & date_sets[2]))
check("split rows add up to the total", split_df["rows"].sum() == len(df))
for v in NUTRIENTS:
    check(f"{v} has no negative values", (df[v] >= 0).all(), f"min {df[v].min():.4f}")
    check(f"{v} below plausibility limit {PLAUSIBLE_MAX[v]} mmol m-3 (flag only)",
          (df[v] < PLAUSIBLE_MAX[v]).all(), f"max {df[v].max():.4f}")
check("rainfall and runoff are non-negative", (df[list(DRIVERS)] >= 0).all().all())
check("soil moisture between 0 and 1", df["soil_moisture"].between(0, 1).all(),
      f"{df['soil_moisture'].min():.3f} to {df['soil_moisture'].max():.3f}")
check("wind speed non-negative", (df["wind_speed"] >= 0).all())

# profile: dataset, cells, split, missing
prof("dataset", "file", str(DATASET).replace("\\", "/"))
prof("dataset", "rows", len(df))
prof("dataset", "columns", n_cols)
prof("dataset", "first_date", str(df["date"].min().date()))
prof("dataset", "last_date", str(df["date"].max().date()))
prof("dataset", "days_per_cell", int(per_cell["days"].iloc[0]))
prof("dataset", "nutrient_source", "Copernicus Marine GLOBAL_MULTIYEAR_BGC_001_029",
     "model-derived hindcast, no data assimilation; not in-situ measurements")
prof("dataset", "forcing_source", "ERA5-Land, ERA5", "reanalysis")
prof("cells", "total", df["cell_id"].nunique())
prof("cells", "western", region_counts.get("Western", 0))
prof("cells", "southern", region_counts.get("Southern", 0))
for cid, r in cell_region.iterrows():
    prof("cells", cid, r["first"], f"{int(per_cell.loc[cid, 'days'])} days")
for r in split_rows:
    prof("split", r["split"], r["rows"],
         f"{r['first']} to {r['last']}; {r['days']} days; {r['share_pct']}% of rows; "
         f"matches config: {r['matches_config']}")
for col, n in missing.items():
    prof("missing", col, int(n))

log(f"\nSplit:\n{split_df.to_string(index=False)}")
log(f"\nMissing values: {int(missing.sum())} across all {n_cols} columns")

# ================================================================== 2. descriptive statistics + outlier flags
df["month"] = df["date"].dt.month


def describe(s, nutrient):
    q = s.quantile([0.01, 0.05, 0.25, 0.5, 0.75, 0.95, 0.99])
    return {"count": int(s.count()), "mean": s.mean(), "std": s.std(), "min": s.min(), "p01": q[0.01],
            "p05": q[0.05], "p25": q[0.25], "median": q[0.5], "p75": q[0.75], "p95": q[0.95], "p99": q[0.99],
            "max": s.max(), "skewness": s.skew(),
            "share_below_0.01": float((s < NEAR_ZERO).mean()) if nutrient else np.nan}


# context-aware flags computed once on the full dataset (per cell x month)
flags = {}
log("\nOutlier inspection (flags only - NOTHING is removed):")
for v in NUTRIENTS:
    g = df.groupby(["cell_id", "month"])[v]
    q1, q3 = g.transform(lambda s: s.quantile(0.25)), g.transform(lambda s: s.quantile(0.75))
    cm_flag = (df[v] < q1 - 1.5 * (q3 - q1)) | (df[v] > q3 + 1.5 * (q3 - q1))
    med = g.transform("median")
    mad = g.transform(lambda s: (s - s.median()).abs().median())
    rz = (df[v] - med) / (1.4826 * mad.where(mad > 0))
    rz_flag = rz.abs() > 3.5
    zero_spread = int((mad.groupby([df["cell_id"], df["month"]]).first() == 0).sum())
    flags[v] = (cm_flag, rz_flag, zero_spread)

stat_rows = []
scopes = [("All", df), ("Western", df[df["region"] == "Western"]), ("Southern", df[df["region"] == "Southern"])]
for v in NUTRIENTS + ENV_VARS:
    is_n = v in NUTRIENTS
    for scope, sub in scopes + ([("train", df[df["split"] == "train"]), ("val", df[df["split"] == "val"]),
                                 ("test", df[df["split"] == "test"])] if is_n else []):
        row = {"variable": v, "unit": UNITS[v], "scope": scope, **describe(sub[v], is_n)}
        if is_n and scope in ("All", "Western", "Southern"):
            x = sub[v]
            sq1, sq3 = x.quantile(0.25), x.quantile(0.75)
            lo, hi = sq1 - 1.5 * (sq3 - sq1), sq3 + 1.5 * (sq3 - sq1)
            cm_flag, rz_flag, zero_spread = flags[v]
            row.update({
                "scope_iqr_lower_fence": lo, "scope_iqr_upper_fence": hi,
                "scope_iqr_flagged_n": int(((x < lo) | (x > hi)).sum()),
                "cell_month_iqr_flagged_n": int(cm_flag.loc[sub.index].sum()),
                "robust_z_gt_3.5_n": int(rz_flag.loc[sub.index].sum()),
                "cell_month_groups_zero_spread": zero_spread if scope == "All" else np.nan,
                "removed_n": 0,
            })
        stat_rows.append(row)
stats = pd.DataFrame(stat_rows)

for v in NUTRIENTS:
    r = stats[(stats["variable"] == v) & (stats["scope"] == "All")].iloc[0]
    n = len(df)
    n_scope, n_cm, n_rz = int(r["scope_iqr_flagged_n"]), int(r["cell_month_iqr_flagged_n"]), int(r["robust_z_gt_3.5_n"])
    flagged_cm = flags[v][0]
    by_season = df.loc[flagged_cm, "season"].value_counts(normalize=True)
    base = df["season"].value_counts(normalize=True)
    log(f"  {v}: scope-wide IQR flags {n_scope:,} days ({100 * n_scope / n:.1f}%) "
        f"- descriptive only; nutrient levels vary by cell and season, so these are not treated as errors")
    log(f"       cell x month IQR flags {n_cm:,} ({100 * n_cm / n:.1f}%); "
        f"robust z > 3.5 flags {n_rz:,} ({100 * n_rz / n:.1f}%); "
        f"{int(r['cell_month_groups_zero_spread'])} cell-month groups have zero spread (robust z not defined there)")
    log("       cell x month flags by season: " + ", ".join(
        f"{s} {100 * by_season.get(s, 0):.0f}% (share of all days {100 * base.get(s, 0):.0f}%)" for s in SEASONS))
log("  Decision: no values removed (removed_n = 0 for every nutrient).")

show = stats[stats["scope"] == "All"].set_index("variable")[
    ["unit", "mean", "median", "std", "min", "p99", "max", "skewness", "share_below_0.01"]]
log("\nDescriptive statistics (all cells):")
log(show.round(4).to_string())
log("\nNutrient means by split:")
log(stats[stats["scope"].isin(["train", "val", "test"])].pivot(index="scope", columns="variable", values="mean")
    .reindex(["train", "val", "test"]).round(4).to_string())

# ================================================================== 3. E35 distributions + monthly boxplots
fig, axes = plt.subplots(2, 3, figsize=(17, 9), gridspec_kw={"height_ratios": [1, 1.1]})
for j, v in enumerate(NUTRIENTS):
    ax = axes[0, j]
    hi = df[v].quantile(0.995)
    bins = np.linspace(0, hi, 60)
    for reg in ["Western", "Southern"]:
        ax.hist(df.loc[df["region"] == reg, v].clip(upper=hi), bins=bins, density=True, histtype="step", lw=2,
                color=REGION_COLOUR[reg], label=f"{reg} ({region_counts.get(reg, 0)} cells)")
    r = stats[(stats["variable"] == v) & (stats["scope"] == "All")].iloc[0]
    ax.axvline(r["median"], color="#10222E", ls="--", lw=1)
    txt = f"median {r['median']:.3f}\nskewness {r['skewness']:.2f}"
    if v == "po4":
        ax.set_yscale("log")
        txt += f"\n{100 * r['share_below_0.01']:.0f}% of days < {NEAR_ZERO}"
    ax.text(0.97, 0.95, txt, transform=ax.transAxes, ha="right", va="top", fontsize=9,
            bbox=dict(boxstyle="round", fc="white", ec="#C9D5DE"))
    ax.set_title(LABEL[v])
    ax.set_xlabel("mmol m⁻³ (values above the 99.5th percentile in the last bin)")
    ax.set_ylabel("density" + (" (log scale)" if v == "po4" else ""))

    ax = axes[1, j]
    for m in range(1, 13):
        ax.axvspan(m - 0.5, m + 0.5, color=SEASON_COLOUR[SEASON_OF_MONTH[m]], alpha=0.09, lw=0)
    ax.boxplot([df.loc[df["month"] == m, v].to_numpy() for m in range(1, 13)], positions=range(1, 13),
               widths=0.55, whis=1.5, patch_artist=True,
               boxprops=dict(facecolor="white", edgecolor="#10222E"), medianprops=dict(color="#C8452B", lw=2),
               flierprops=dict(marker=".", markersize=2, markerfacecolor="#5A6B77", markeredgecolor="none", alpha=0.5))
    ax.set_xticks(range(1, 13))
    ax.set_xticklabels([m[0] for m in MONTHS])
    ax.set_ylabel("mmol m⁻³")
    ax.set_title(f"{LABEL[v]} by month · points = inspected, none removed", fontsize=10)
axes[0, 0].legend(fontsize=9, loc="center right")
handles = [plt.Rectangle((0, 0), 1, 1, color=SEASON_COLOUR[s], alpha=0.35) for s in SEASONS]
fig.legend(handles, SEASONS.values(), ncol=4, loc="lower center", frameon=False, fontsize=9)
fig.suptitle("Daily surface nutrients at 12 coastal cells, 1997–2025 (Copernicus model hindcast)", fontweight="bold")
fig.tight_layout(rect=(0, 0.04, 1, 0.97))
fig.savefig(OUT["dist_png"], dpi=150, bbox_inches="tight")
plt.close(fig)

# ================================================================== 4. lag correlations (training years, within cell)
log("\nLag correlations (training years only; per-cell deseasonalised anomalies; Spearman; within cell first):")
tr = df[df["split"] == "train"].copy()
tr["doy"] = tr["date"].dt.dayofyear
lag_vars = NUTRIENTS + list(DRIVERS)
train_days = tr.groupby("cell_id")["date"].agg(days="count", max_step=lambda s: int(s.diff().dt.days.max()))
check("each cell's training series is continuous (7,424 days)",
      (train_days["days"] == EXPECTED["train_days"]).all() and (train_days["max_step"] == 1).all())

anoms = []
for cid, g in tr.groupby("cell_id"):
    g = g.sort_values("date").copy()
    clim = g.groupby("doy")[lag_vars].mean().reindex(range(1, 367)).interpolate(limit_direction="both")
    padded = pd.concat([clim.iloc[-15:], clim, clim.iloc[:15]])
    clim = padded.rolling(31, center=True).mean().iloc[15:-15]
    clim.index = range(1, 367)
    for c in lag_vars:
        g[f"{c}_anom"] = g[c].to_numpy() - clim.loc[g["doy"], c].to_numpy()
    anoms.append(g)
tr = pd.concat(anoms, ignore_index=True)

cell_rows, pair_counts, nan_count = [], [], 0
for cid, g in tr.groupby("cell_id"):
    reg = g["region"].iloc[0]
    for n in NUTRIENTS:
        y, y_raw = g[f"{n}_anom"].reset_index(drop=True), g[n].reset_index(drop=True)
        for d in DRIVERS:
            x, x_raw = g[f"{d}_anom"].reset_index(drop=True), g[d].reset_index(drop=True)
            for L in LAGS:
                xs, xrs = x.shift(L), x_raw.shift(L)
                pairs = int((y.notna() & xs.notna()).sum())
                rho = y.corr(xs, method="spearman")
                raw = y_raw.corr(xrs, method="spearman")
                pair_counts.append(pairs)
                nan_count += int(not np.isfinite(rho))
                cell_rows.append({"level": "cell", "scope": cid, "region": reg, "nutrient": n, "driver": d,
                                  "lag_days": L, "rho_anomaly": rho, "rho_raw_seasonal": raw, "n_pairs": pairs})
check(f"every lag correlation used at least {MIN_PAIRS:,} day pairs", min(pair_counts) >= MIN_PAIRS,
      f"minimum {min(pair_counts):,}")
check("every lag correlation is a valid number", nan_count == 0, f"{nan_count} invalid")
cells_df = pd.DataFrame(cell_rows)

sum_rows = []
for scope in ["All", "Western", "Southern"]:
    sub = cells_df if scope == "All" else cells_df[cells_df["region"] == scope]
    for (n, d, L), s in sub.groupby(["nutrient", "driver", "lag_days"]):
        sum_rows.append({"level": "summary", "scope": scope, "region": scope, "nutrient": n, "driver": d,
                         "lag_days": L, "rho_anomaly_median": s["rho_anomaly"].median(),
                         "rho_anomaly_min": s["rho_anomaly"].min(), "rho_anomaly_max": s["rho_anomaly"].max(),
                         "rho_raw_seasonal_median": s["rho_raw_seasonal"].median(), "n_cells": len(s)})
summ = pd.DataFrame(sum_rows)
lag_table = pd.concat([summ, cells_df], ignore_index=True)
cols = ["level", "scope", "region", "nutrient", "driver", "lag_days", "rho_anomaly_median", "rho_anomaly_min",
        "rho_anomaly_max", "rho_raw_seasonal_median", "n_cells", "rho_anomaly", "rho_raw_seasonal", "n_pairs"]
lag_table[cols].round(4).to_csv(OUT["lag_csv"], index=False)

peaks = []
for (scope, n, d), s in summ.groupby(["scope", "nutrient", "driver"]):
    s = s.set_index("lag_days")
    pk = int(s["rho_anomaly_median"].abs().idxmax())
    rk = int(s["rho_raw_seasonal_median"].abs().idxmax())
    peaks.append({"scope": scope, "nutrient": n, "driver": d, "peak_lag": pk,
                  "rho_peak": s.loc[pk, "rho_anomaly_median"], "rho_lag0": s.loc[0, "rho_anomaly_median"],
                  "cell_range_at_peak": f"{s.loc[pk, 'rho_anomaly_min']:+.2f} to {s.loc[pk, 'rho_anomaly_max']:+.2f}",
                  "raw_seasonal_rho_peak": s.loc[rk, "rho_raw_seasonal_median"],
                  "strength": "negligible" if abs(s.loc[pk, "rho_anomaly_median"]) < NEGLIGIBLE else "noticeable"})
peaks = pd.DataFrame(peaks)
order = {"All": 0, "Western": 1, "Southern": 2}
peaks = peaks.sort_values(["nutrient", "driver", "scope"], key=lambda c: c.map(order) if c.name == "scope" else c)
log(peaks.round(3).to_string(index=False))
log(f"  rho_peak = median across cells at the lag with the largest |median|; |rho| < {NEGLIGIBLE} is called negligible.")
log("  raw_seasonal_rho_peak = same within-cell correlation WITHOUT removing the seasonal cycle (seasonally "
    "confounded; shown for comparison only).")

# E36 plot
lim = max(0.15, float(np.nanmax(np.abs(summ[["rho_anomaly_min", "rho_anomaly_max"]].to_numpy()))) * 1.1)
fig, axes = plt.subplots(3, 3, figsize=(15, 10.5), sharex=True, sharey=True)
for i, n in enumerate(NUTRIENTS):
    for j, d in enumerate(DRIVERS):
        ax = axes[i, j]
        for L in MARK_LAGS:
            ax.axvline(L, color="#AFC0CC", ls=":", lw=1)
        ax.axhspan(-NEGLIGIBLE, NEGLIGIBLE, color="#E8EEF2", lw=0)
        ax.axhline(0, color="#5A6B77", lw=0.8)
        for reg in ["Western", "Southern"]:
            s = summ[(summ["scope"] == reg) & (summ["nutrient"] == n) & (summ["driver"] == d)].sort_values("lag_days")
            ax.fill_between(s["lag_days"], s["rho_anomaly_min"], s["rho_anomaly_max"], color=REGION_COLOUR[reg],
                            alpha=0.15, lw=0)
            ax.plot(s["lag_days"], s["rho_anomaly_median"], color=REGION_COLOUR[reg], lw=2,
                    label=f"{reg}: median of {region_counts.get(reg, 0)} cells (band = cell range)")
        ax.set_ylim(-lim, lim)
        if i == 0:
            ax.set_title(DRIVERS[d])
        if j == 0:
            ax.set_ylabel(f"{LABEL[n]}\nSpearman ρ (anomalies)")
        if i == 2:
            ax.set_xlabel("lag L (driver on day t − L, nutrient on day t)")
            ax.set_xticks([0, 3, 7, 14, 21, 30])
axes[0, 0].legend(fontsize=8, loc="upper right")
fig.suptitle("Within-cell lag correlation, training years 1997–2017, seasonal cycle removed (descriptive; not causal)\n"
             f"grey band = |ρ| < {NEGLIGIBLE} (negligible) · dotted lines = existing 3/7/14/30-day windows, chosen a priori",
             fontweight="bold")
fig.tight_layout()
fig.savefig(OUT["lag_png"], dpi=150, bbox_inches="tight")
plt.close(fig)

log("\nWindows statement:\n  " + WINDOWS_STATEMENT)
log("Causation statement:\n  " + CAUSATION_STATEMENT)

# ================================================================== 5. read-only proof, profile, stats
sha_after = sha256(DATASET)
check("dataset file unchanged (SHA-256 before = after)", sha_after == sha_before, sha_after[:16] + "...")
stats.round(6).to_csv(OUT["stats"], index=False)
for name, ok, detail in CHECKS:
    prof("checks", name, "PASS" if ok else "FAIL", detail)
pd.DataFrame(PROFILE).to_csv(OUT["profile"], index=False)

# ================================================================== 6. markdown summary


def md_table(frame, cols, fmt=None):
    fmt = fmt or {}
    out = ["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    for _, r in frame.iterrows():
        out.append("| " + " | ".join(fmt.get(c, "{}").format(r[c]) for c in cols) + " |")
    return "\n".join(out)


def lag_line(n, scope):
    s = peaks[(peaks["scope"] == scope) & (peaks["nutrient"] == n)]
    r = s.loc[s["rho_peak"].abs().idxmax()]
    if abs(r["rho_peak"]) < NEGLIGIBLE:
        return f"negligible for all three drivers (all |median ρ| < {NEGLIGIBLE} over 0–30 days)"
    return (f"strongest with {DRIVERS[r['driver']].lower()}, median ρ = {r['rho_peak']:+.2f} at {r['peak_lag']} days "
            f"(cells {r['cell_range_at_peak']})")


passed = sum(ok for _, ok, _ in CHECKS)
nut_all = stats[(stats["scope"] == "All") & stats["variable"].isin(NUTRIENTS)].copy()
env_all = stats[(stats["scope"] == "All") & stats["variable"].isin(ENV_VARS)].copy()
for f_ in (nut_all, env_all):
    f_["n"] = len(df)
nut_all["scope_iqr_pct"] = 100 * nut_all["scope_iqr_flagged_n"] / len(df)
nut_all["cell_month_pct"] = 100 * nut_all["cell_month_iqr_flagged_n"] / len(df)
nut_all["robust_z_pct"] = 100 * nut_all["robust_z_gt_3.5_n"] / len(df)
num = "{:.3f}"
po4_share = 100 * nut_all.loc[nut_all["variable"] == "po4", "share_below_0.01"].iloc[0]

md = f"""# Component 1 – EDA and data-quality summary (PP1)

Generated by `scripts/15_eda_data_quality.py`. Read-only: no data, feature, split or model was changed,
and nothing was retrained. Dataset SHA-256 identical before and after the run.

**Data:** {DATA_STATEMENT}

## Dataset and checks
- `{DATASET.as_posix()}`: **{len(df):,} rows × {n_cols} columns**, {df['date'].min().date()} to {df['date'].max().date()}.
- **{df['cell_id'].nunique()} coastal cells**: {region_counts.get('Western', 0)} Western, {region_counts.get('Southern', 0)} Southern; {int(per_cell['days'].iloc[0]):,} consecutive days each.
- **Missing values: {int(missing.sum())}** across all {n_cols} columns.
- **Automatic checks: {passed} of {len(CHECKS)} passed** (`evidence/pp1/E32_eda_data_quality_log.txt`, `E33_dataset_profile.csv`).

## Chronological split
{md_table(split_df, ["split", "first", "last", "days", "rows", "share_pct"])}

## Descriptive statistics (all cells)
{md_table(nut_all, ["variable", "unit", "mean", "median", "std", "min", "p99", "max", "skewness"], {c: num for c in ["mean", "median", "std", "min", "p99", "max", "skewness"]})}

{md_table(env_all, ["variable", "unit", "mean", "median", "std", "min", "p99", "max", "skewness"], {c: num for c in ["mean", "median", "std", "min", "p99", "max", "skewness"]})}

Phosphate is below {NEAR_ZERO} mmol m⁻³ on {po4_share:.0f}% of days. Full table by region and split: `E34_descriptive_statistics.csv`.

## Distributions and outliers (nothing removed)
{md_table(nut_all, ["variable", "scope_iqr_pct", "cell_month_pct", "robust_z_pct", "removed_n"], {"scope_iqr_pct": "{:.1f}%", "cell_month_pct": "{:.1f}%", "robust_z_pct": "{:.1f}%"})}

The scope-wide IQR count is a descriptive flag only: nutrient levels vary strongly by cell and season,
so values outside it are not treated as errors. The cell-by-month IQR rule and the robust z-score rule
are the context-aware checks. No value was removed. Figure: `E35_nutrient_distributions.png`.

## Lag relationships with rainfall and runoff (training years 1997–2017)
Method: within each cell, the seasonal cycle was removed from every variable, and Spearman correlation
was calculated between the nutrient on day t and the driver on day t − L (L = 0–30). Results were then
summarised across cells (median and range); cells were never pooled. Descriptive only, without p-values,
because daily series are autocorrelated.

- **Nitrate** – Western: {lag_line('no3', 'Western')}; Southern: {lag_line('no3', 'Southern')}.
- **Phosphate** – Western: {lag_line('po4', 'Western')}; Southern: {lag_line('po4', 'Southern')}.
- **Silicate** – Western: {lag_line('si', 'Western')}; Southern: {lag_line('si', 'Southern')}.

Without removing the seasonal cycle, correlations are larger because nutrients and rainfall share the
monsoon calendar (`rho_raw_seasonal_median` in `E36_lag_correlations.csv`). Figure: `E36_lag_correlations.png`.

**Feature windows.** {WINDOWS_STATEMENT}

**Causation.** {CAUSATION_STATEMENT}

## Limitations
- Targets are model-derived hindcast fields, not field measurements; forcing is reanalysis.
- Each cell is a 0.25° (~28 km) grid square; three outer cells take land forcing from their nearest land points.
- Correlations are descriptive associations for training years only.

## Files
`evidence/pp1/E32_eda_data_quality_log.txt` · `E33_dataset_profile.csv` · `E34_descriptive_statistics.csv` ·
`E35_nutrient_distributions.png` · `E36_lag_correlations.png` · `E36_lag_correlations.csv`
"""
OUT["summary"].write_text(md, encoding="utf-8")

# ================================================================== 7. finish
log(f"\nValidation: {passed} of {len(CHECKS)} checks passed.")
log("Written: " + " | ".join(str(p).replace("\\", "/") for p in OUT.values()))
if passed != len(CHECKS):
    raise SystemExit("ERROR: at least one check failed - see the [FAIL] lines above. Nothing was changed in the dataset.")
log("Step 15 completed successfully.")
