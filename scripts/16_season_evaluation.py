"""
Step 16 - Per-season evaluation on the fair-comparison rows (READ-ONLY, inference only).

Headline: held-out TEST period 2022-2025. Validation 2018-2021 is kept in E38 as a consistency reference.

Reads   data/processed/model_dataset_daily.parquet, experiments/split_config.json   (neural inference inputs)
        data/processed/predictions/baseline_predictions.parquet                   (Persistence, XGB-B, true values)
        experiments/models/{node,lstm}{,_s7,_s2026}_best.pt + experiments/*_config.json  (6 saved runs)
        experiments/results/seed_robustness_per_run.csv                          (E23 reference values)
        outputs/c1_to_c2/c1_nutrient_forecasts_test_2022_2025.csv                (C2 export cross-check)
Writes  evidence/pp1/E37_season_evaluation_log.txt, E38_season_metrics.csv, E39_season_rmse.png,
        E40_season_skill.png, docs/season_evaluation_summary.md

Safeguards
- Saved models are only loaded and run in evaluation mode with gradients disabled: no optimizer,
  no backpropagation, no parameter updates, no retraining, no tuning, no seed selection.
- Rows: inner join on (cell_id, t0, h) exactly as Steps 09/10; must equal 244,272 (test 122,136).
- Every regenerated run must reproduce its E23 test RMSE within 1e-4, and Neural ODE seed 2026 must
  reproduce the Component 2 export within 1e-4. Any failure stops the script before seasonal results.
- Season = calendar month of target_date (NEM Dec-Feb, FIM Mar-Apr, SWM May-Sep, SIM Oct-Nov).
  Seasons are fixed-month descriptive labels; the actual year-to-year environmental variability is in the
  ERA5 / ERA5-Land reanalysis forcing. No causal monsoon claims; no claim about capturing monsoon onset.
- Neural results = mean (and spread) of the 3 runs' metrics; predictions are never averaged into an ensemble.
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import sys
import numpy as np
import pandas as pd
import torch
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
sys.path.insert(0, str(ROOT / "scripts"))
from common import NUTRIENTS, HORIZON, SEED, load_dataset  # noqa: E402
from node_model import build_model, prepare_arrays, windows, get_batch, FORCING_COLS, STATIC_COLS  # noqa: E402

parser = argparse.ArgumentParser(description="Read-only per-season evaluation (Step 16).")
parser.add_argument("--overwrite", action="store_true", help="replace existing E37-E40 outputs")
args = parser.parse_args()

# ------------------------------------------------------------------ paths
DATASET = Path("data/processed/model_dataset_daily.parquet")
SPLIT_CONFIG = Path("experiments/split_config.json")
BASE_PRED = Path("data/processed/predictions/baseline_predictions.parquet")
PER_RUN = Path("experiments/results/seed_robustness_per_run.csv")
EXPORT = Path("outputs/c1_to_c2/c1_nutrient_forecasts_test_2022_2025.csv")
SEEDS = [SEED, 7, 2026]
NEURAL = {"node": "NeuralODE", "lstm": "LSTM_B"}


def suffix(seed):
    return "" if seed == SEED else f"_s{seed}"


RUNS = [(key, seed, f"{NEURAL[key]}_s{seed}") for key in NEURAL for seed in SEEDS]
MODEL_FILES = {name: Path(f"experiments/models/{key}{suffix(seed)}_best.pt") for key, seed, name in RUNS}
CONFIG_FILES = {name: Path(f"experiments/{key}{suffix(seed)}_config.json") for key, seed, name in RUNS}
INPUTS = [DATASET, SPLIT_CONFIG, BASE_PRED, PER_RUN, EXPORT] + list(MODEL_FILES.values()) + list(CONFIG_FILES.values())

EVID = Path("evidence/pp1")
OUT = {"log": EVID / "E37_season_evaluation_log.txt", "csv": EVID / "E38_season_metrics.csv",
       "rmse_png": EVID / "E39_season_rmse.png", "skill_png": EVID / "E40_season_skill.png",
       "summary": Path("docs/season_evaluation_summary.md")}

EXPECTED_COMMON, EXPECTED_TEST = 244272, 122136
ALIGN_TOL, REPRO_TOL = 1e-3, 1e-4
KEYS = ["cell_id", "t0", "h"]
SEASON_OF_MONTH = {12: "NEM", 1: "NEM", 2: "NEM", 3: "FIM", 4: "FIM", 5: "SWM", 6: "SWM", 7: "SWM",
                   8: "SWM", 9: "SWM", 10: "SIM", 11: "SIM"}
SEASONS = ["NEM", "FIM", "SWM", "SIM"]
SEASON_NAME = {"NEM": "Northeast Monsoon (Dec–Feb)", "FIM": "First Inter-Monsoon (Mar–Apr)",
               "SWM": "Southwest Monsoon (May–Sep)", "SIM": "Second Inter-Monsoon (Oct–Nov)"}
FAMILIES = {"Persistence": ["Persistence"], "XGB-B": ["XGB_B_process"],
            "LSTM-B": [n for k, s, n in RUNS if k == "lstm"], "Neural ODE": [n for k, s, n in RUNS if k == "node"]}
COLOUR = {"Persistence": "#8796A3", "XGB-B": "#B7791F", "LSTM-B": "#6C5CE7", "Neural ODE": "#D9482B"}
LABEL = {"no3": "Nitrate (NO₃)", "po4": "Phosphate (PO₄)", "si": "Silicate (Si)"}

STATEMENTS = [
    "Seasons are fixed calendar-month labels assigned by the forecast target date (NEM Dec–Feb, FIM Mar–Apr, "
    "SWM May–Sep, SIM Oct–Nov). They are descriptive groupings, not measured monsoon onset or withdrawal dates.",
    "The actual year-to-year environmental variability (rainfall, runoff, soil moisture, wind) enters the models "
    "through ERA5 / ERA5-Land reanalysis forcing, not through the season label alone.",
    "Results describe forecast performance during each season. They do not show that the monsoon causes any "
    "difference, and they do not show that any model predicts or captures monsoon onset.",
    "Targets are Copernicus Marine model-derived hindcast fields (no data assimilation), not field or in-situ "
    "measurements. Evaluation is in hindcast-forcing (replay) mode.",
    "No model, seed or setting was chosen from these seasonal test results.",
]

# ------------------------------------------------------------------ evidence protection
existing = [str(p) for p in OUT.values() if p.exists()]
if existing and not args.overwrite:
    print("STOPPED: these outputs already exist and were not changed:")
    for p in existing:
        print("  " + p)
    print("Run again with --overwrite only if you intend to replace them.")
    raise SystemExit(1)
if args.overwrite:                       # a failed rerun must not leave older results looking current
    for p in OUT.values():
        if p.exists():
            p.unlink()
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
    return bool(ok)


def stop_if_failed(stage):
    if not all(ok for _, ok, _ in CHECKS):
        log(f"\nSTOPPED at '{stage}': a check failed. No seasonal results were produced.")
        raise SystemExit("ERROR: check failed - see the [FAIL] lines above.")


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def fix_types(d):
    d["cell_id"] = d["cell_id"].astype(str)
    d["t0"] = pd.to_datetime(d["t0"]).astype("datetime64[ns]")
    d["h"] = d["h"].astype(int)
    return d


# ================================================================== 1. inputs
log("STEP 16 - PER-SEASON EVALUATION (read-only; inference only; headline = TEST 2022-2025)")
log("=" * 78)
log("\nInput files:")
missing_files = [str(p) for p in INPUTS if not p.exists()]
check("all input files exist (dataset, predictions, E23 metrics, export, 6 models, 6 configs)",
      not missing_files, ", ".join(missing_files) if missing_files else f"{len(INPUTS)} files")
stop_if_failed("input files")
hash_before = {str(p): sha256(p) for p in INPUTS}
for p in INPUTS:
    log(f"  {str(p):70s} sha256 {hash_before[str(p)][:16]}...")

for key, seed, name in RUNS:
    cfg = json.loads(CONFIG_FILES[name].read_text(encoding="utf-8"))
    check(f"{name}: config seed is {seed}", int(cfg.get("seed", -1)) == seed, f"config seed {cfg.get('seed')}")
stop_if_failed("configs")

# ================================================================== 2. baseline predictions
base = fix_types(pd.read_parquet(BASE_PRED))
base["split"] = base["split"].astype(str)
base["region"] = base["region"].astype(str)
base["target_date"] = pd.to_datetime(base["target_date"]).astype("datetime64[ns]")
need = [f"{m}__{v}" for m in ["Persistence", "XGB_B_process"] for v in NUTRIENTS] + [f"{v}_target" for v in NUTRIENTS]
check("baseline predictions contain Persistence, XGB-B and true values for NO3/PO4/Si",
      all(c in base.columns for c in need), f"{base.shape[0]:,} rows x {base.shape[1]} columns")
stop_if_failed("baseline columns")

# ================================================================== 3. neural inference (no gradients)
log("\nRegenerating the six saved neural runs (evaluation mode, gradients disabled, no optimizer):")
torch.set_grad_enabled(False)
df = load_dataset()
arr = prepare_arrays(df)                                    # same train-only standardisation as evaluation
z_mean, z_std = arr["stats"]["z_mean"], arr["stats"]["z_std"]
cells = np.array(arr["cells"], dtype=str)


def predict(model, name):
    frames = []
    for split in ["val", "test"]:
        idx = windows(arr, split)
        P, Y = [], []
        with torch.inference_mode():
            for i in range(0, len(idx), 4096):
                z0, U, s, Yb = get_batch(arr, idx[i:i + 4096])
                P.append(model(z0, U, s).numpy())
                Y.append(Yb.numpy())
        P = np.clip(np.concatenate(P) * z_std + z_mean, 0, None)
        Y = np.concatenate(Y) * z_std + z_mean
        out = pd.DataFrame({"cell_id": np.repeat(cells[idx[:, 0]], HORIZON),
                            "t0": np.repeat(arr["dates"][idx[:, 1]], HORIZON),
                            "h": np.tile(np.arange(1, HORIZON + 1), len(idx))})
        for k, v in enumerate(NUTRIENTS):
            out[f"{name}__{v}"] = P[:, :, k].reshape(-1)
            out[f"{v}_check"] = Y[:, :, k].reshape(-1)
        frames.append(out)
    return fix_types(pd.concat(frames, ignore_index=True))


j = base
for key, seed, name in RUNS:
    cfg = json.loads(CONFIG_FILES[name].read_text(encoding="utf-8"))
    model = build_model(key, len(FORCING_COLS), len(STATIC_COLS), cfg["hidden"], cfg.get("substeps", 1))
    model.load_state_dict(torch.load(MODEL_FILES[name], map_location="cpu"))
    model.eval()
    for p in model.parameters():
        p.requires_grad_(False)
    j = j.merge(predict(model, name), on=KEYS, how="inner")
    diff = max(float(np.abs(j[f"{v}_target"] - j[f"{v}_check"]).max()) for v in NUTRIENTS)
    j = j.drop(columns=[f"{v}_check" for v in NUTRIENTS])
    check(f"{name}: true values align with the baseline file (max diff <= {ALIGN_TOL})", diff <= ALIGN_TOL,
          f"max diff {diff:.2e}; common rows now {len(j):,}")
stop_if_failed("alignment")

check("common validation + test rows = 244,272", len(j) == EXPECTED_COMMON, f"{len(j):,}")
check("common test rows = 122,136", int((j["split"] == "test").sum()) == EXPECTED_TEST,
      f"{int((j['split'] == 'test').sum()):,}")
stop_if_failed("row counts")

# ================================================================== 4. reproduction checks
log("\nReproduction of E23 overall test RMSE (tolerance 1e-4):")
ref = pd.read_csv(PER_RUN)
ref["h"] = ref["h"].astype(str)
ref = ref[(ref["split"] == "test") & (ref["subset"] == "All") & (ref["h"] == "all")]
test = j[j["split"] == "test"]


def rmse(y, p):
    return float(np.sqrt(np.mean((p - y) ** 2)))


for name in ["Persistence", "XGB_B_process"] + [n for _, _, n in RUNS]:
    worst = 0.0
    for v in NUTRIENTS:
        r = ref[(ref["model"] == name) & (ref["nutrient"] == v)]
        if r.empty:
            worst = np.inf
            continue
        worst = max(worst, abs(rmse(test[f"{v}_target"], test[f"{name}__{v}"]) - float(r["rmse"].iloc[0])))
    check(f"{name}: reproduces E23 test RMSE for NO3/PO4/Si", worst <= REPRO_TOL, f"max diff {worst:.2e}")

ex = pd.read_csv(EXPORT, parse_dates=["issue_date"])
ex = ex.rename(columns={"issue_date": "t0", "lead_time_days": "h"})
ex = fix_types(ex)
m = test[KEYS + [f"NeuralODE_s2026__{v}" for v in NUTRIENTS]].merge(ex[KEYS + NUTRIENTS], on=KEYS, how="inner")
ex_diff = max(float(np.abs(m[f"NeuralODE_s2026__{v}"] - m[v]).max()) for v in NUTRIENTS)
check("Neural ODE seed 2026 reproduces the Component 2 export (all 122,136 rows)",
      len(m) == EXPECTED_TEST and ex_diff <= REPRO_TOL, f"{len(m):,} rows matched, max diff {ex_diff:.2e}")
stop_if_failed("reproduction")

# ================================================================== 5. seasons
log("\nSeason assignment (by target_date month):")
check("target_date = t0 + h on every row", bool((j["target_date"] - j["t0"]).dt.days.eq(j["h"]).all()))
j["season"] = j["target_date"].dt.month.map(SEASON_OF_MONTH)
j["issue_season"] = j["t0"].dt.month.map(SEASON_OF_MONTH)
check("every row has exactly one season", j["season"].isin(SEASONS).all() and j["season"].notna().all())
for split in ["test", "val"]:
    s = j[j["split"] == split]
    counts = s["season"].value_counts()
    check(f"{split}: season counts add up to the split total", int(counts.sum()) == len(s), f"{len(s):,}")
    complete = all(s.loc[s["season"] == se, "cell_id"].nunique() == 12 and
                   set(s.loc[s["season"] == se, "h"].unique()) == set(range(1, HORIZON + 1)) for se in SEASONS)
    check(f"{split}: every season contains all 12 cells and lead days 1-7", complete)
model_cols = [f"{n}__{v}" for fam in FAMILIES.values() for n in fam for v in NUTRIENTS]
check("no missing predictions for any model on the common rows", not j[model_cols].isnull().any().any())
stop_if_failed("seasons")

test = j[j["split"] == "test"]
tdates = test.drop_duplicates("target_date")[["target_date", "season"]].copy()
tdates["season_year"] = tdates["target_date"].dt.year + (tdates["target_date"].dt.month == 12).astype(int)
occ = tdates.groupby("season")["season_year"].nunique()
log("\nTEST rows per season (all 12 cells; Western 3 / Southern 9):")
for se in SEASONS:
    s = test[test["season"] == se]
    log(f"  {se}  {SEASON_NAME[se]:32s} rows {len(s):7,}  (Western {int((s['region'] == 'Western').sum()):6,} | "
        f"Southern {int((s['region'] == 'Southern').sum()):6,})  target days {s['target_date'].nunique():4d}  "
        f"seasonal occurrences in test years: {int(occ.get(se, 0))}")
cross = int((test["season"] != test["issue_season"]).sum())
log(f"  Rows whose issue day and target day fall in different seasons: {cross:,} "
    f"({100 * cross / len(test):.1f}%) - counted under the target season.")
log("  Note: rows within a season are strongly dependent (consecutive days, neighbouring cells, overlapping "
    "forecast windows). With only a few seasonal occurrences per season, differences are descriptive.")

# ================================================================== 6. metrics
log("\nComputing metrics (per run, then mean / std / min / max across runs):")
run_rows = []
for split in ["test", "val"]:
    for scope in ["All", "Western", "Southern"]:
        base_sub = j[j["split"] == split] if scope == "All" else j[(j["split"] == split) & (j["region"] == scope)]
        for season in ["All seasons"] + SEASONS:
            sub = base_sub if season == "All seasons" else base_sub[base_sub["season"] == season]
            for v in NUTRIENTS:
                y = sub[f"{v}_target"].to_numpy()
                pers = rmse(y, sub[f"Persistence__{v}"].to_numpy())
                for fam, names in FAMILIES.items():
                    for name in names:
                        p = sub[f"{name}__{v}"].to_numpy()
                        r = rmse(y, p)
                        run_rows.append({"level": "run", "split": split, "scope": scope, "season": season,
                                         "nutrient": v, "model": fam, "run": name, "n_rows": len(sub),
                                         "n_cells": sub["cell_id"].nunique(), "persistence_rmse": pers, "rmse": r,
                                         "mae": float(np.mean(np.abs(p - y))),
                                         "skill": 1 - r / pers if pers > 0 else np.nan})
runs = pd.DataFrame(run_rows)
check("all RMSE and MAE values are valid numbers", np.isfinite(runs[["rmse", "mae"]].to_numpy()).all())
undefined = runs[runs["skill"].isna()]
check("skill is undefined only where persistence RMSE is exactly 0",
      bool((undefined["persistence_rmse"] == 0).all()) and np.isfinite(runs.loc[runs["skill"].notna(), "skill"]).all(),
      f"{undefined.groupby(['split', 'scope', 'season', 'nutrient']).ngroups} subsets with undefined skill")
if len(undefined):
    log("  Note: skill vs persistence is undefined (shown as blank/nan) where persistence has zero error, i.e. the "
        "nutrient did not change at all in that subset:")
    for (sp, sc, se, v), _ in undefined.groupby(["split", "scope", "season", "nutrient"]):
        log(f"    {sp} | {sc} | {se} | {v}")
check("identical row counts for every model in every split x scope x season subset",
      bool((runs.groupby(["split", "scope", "season", "nutrient"])["n_rows"].nunique() == 1).all()))
stop_if_failed("metrics")

summ = (runs.groupby(["split", "scope", "season", "nutrient", "model"])
        .agg(n_rows=("n_rows", "first"), n_cells=("n_cells", "first"), n_runs=("run", "nunique"),
             persistence_rmse=("persistence_rmse", "first"),
             rmse_mean=("rmse", "mean"), rmse_std=("rmse", "std"), rmse_min=("rmse", "min"), rmse_max=("rmse", "max"),
             mae_mean=("mae", "mean"), mae_std=("mae", "std"), mae_min=("mae", "min"), mae_max=("mae", "max"),
             skill_mean=("skill", "mean"), skill_std=("skill", "std"), skill_min=("skill", "min"),
             skill_max=("skill", "max"))
        .reset_index())
for c in ["rmse_std", "mae_std", "skill_std"]:
    summ[c] = summ[c].fillna(0.0)
summ.insert(0, "level", "summary")
csv = pd.concat([summ, runs], ignore_index=True)
order = ["level", "split", "scope", "season", "nutrient", "model", "run", "n_rows", "n_cells", "n_runs",
         "persistence_rmse",
         "rmse_mean", "rmse_std", "rmse_min", "rmse_max", "mae_mean", "mae_std", "mae_min", "mae_max",
         "skill_mean", "skill_std", "skill_min", "skill_max", "rmse", "mae", "skill"]
season_order = {s: i for i, s in enumerate(["All seasons"] + SEASONS)}
csv = csv.sort_values(["level", "split", "scope", "season", "nutrient", "model"],
                      key=lambda c: c.map(season_order) if c.name == "season" else c,
                      ascending=[False, False, True, True, True, True])

# descriptive robustness (same pre-stated E23 rule), TEST, all cells, RMSE


def verdict(season, v, a, b):
    s = runs[(runs["split"] == "test") & (runs["scope"] == "All") & (runs["season"] == season) & (runs["nutrient"] == v)]
    A, B = s[s["model"] == a]["rmse"].to_numpy(), s[s["model"] == b]["rmse"].to_numpy()
    sd = max(A.std(ddof=1) if len(A) > 1 else 0.0, B.std(ddof=1) if len(B) > 1 else 0.0)
    diff = A.mean() - B.mean()
    every = bool(np.all(A[:, None] < B[None, :])) or bool(np.all(B[:, None] < A[None, :]))
    if abs(diff) > 2 * sd and every:
        return f"{a if diff < 0 else b} lower"
    return "no robust difference"


verdicts = []
for se in ["All seasons"] + SEASONS:
    for v in NUTRIENTS:
        verdicts.append({"season": se, "nutrient": v, "Neural ODE vs XGB-B": verdict(se, v, "Neural ODE", "XGB-B"),
                         "Neural ODE vs LSTM-B": verdict(se, v, "Neural ODE", "LSTM-B")})
verdicts = pd.DataFrame(verdicts)

# ================================================================== 7. log tables


def table(split, scope, metric):
    s = summ[(summ["split"] == split) & (summ["scope"] == scope)]
    t = s.pivot_table(index=["season", "model"], columns="nutrient", values=metric).reindex(columns=NUTRIENTS)
    idx = [(se, mo) for se in ["All seasons"] + SEASONS for mo in FAMILIES]
    return t.reindex(idx)


log("\nTEST (headline) - RMSE in mmol m-3, mean over runs (neural = 3 seeds):")
log(table("test", "All", "rmse_mean").round(4).to_string())
log("\nTEST - MAE, mean over runs:")
log(table("test", "All", "mae_mean").round(4).to_string())
log("\nTEST - skill vs persistence (1 - RMSE / RMSE_persistence), mean over runs:")
log(table("test", "All", "skill_mean").round(3).to_string())
for reg in ["Western", "Southern"]:
    log(f"\nTEST - skill vs persistence, {reg} cells only:")
    log(table("test", reg, "skill_mean").round(3).to_string())
log("\nTEST - descriptive robustness by season (E23 rule: every run beats every run AND gap > 2 x larger seed std; "
    "many comparisons, so descriptive only):")
log(verdicts.to_string(index=False))
val_t = table("val", "All", "skill_mean").round(3)
log("\nVALIDATION reference (used earlier for early stopping and seed choice; not a headline) - skill:")
log(val_t.to_string())

log("\nStatements:")
for s in STATEMENTS:
    log("  - " + s)

# ================================================================== 8. figures
SEASON_TICK = {se: se for se in SEASONS}
fams = list(FAMILIES)
width = 0.2
fig, axes = plt.subplots(1, 3, figsize=(17, 5.2))
t_all = summ[(summ["split"] == "test") & (summ["scope"] == "All")]
for ax, v in zip(axes, NUTRIENTS):
    for k, fam in enumerate(fams):
        s = t_all[(t_all["nutrient"] == v) & (t_all["model"] == fam)].set_index("season").reindex(SEASONS)
        x = np.arange(len(SEASONS)) + (k - 1.5) * width
        err = np.vstack([s["rmse_mean"] - s["rmse_min"], s["rmse_max"] - s["rmse_mean"]])
        ax.bar(x, s["rmse_mean"], width, color=COLOUR[fam], label=fam,
               yerr=err if s["n_runs"].iloc[0] > 1 else None, capsize=3, error_kw={"lw": 1})
    n = t_all[(t_all["nutrient"] == v) & (t_all["model"] == "Persistence")].set_index("season").reindex(SEASONS)["n_rows"]
    ax.set_xticks(range(len(SEASONS)))
    ax.set_xticklabels([f"{se}\nn = {int(n[se]):,}" for se in SEASONS])
    ax.set_title(LABEL[v])
    ax.set_ylabel("RMSE (mmol m⁻³)")
axes[0].legend(fontsize=9)
fig.suptitle("Test 2022–2025: RMSE by season of the forecast target date (all 12 cells, lead days 1–7; "
             "whiskers = range over 3 seeds)\nSeasons are fixed calendar-month labels · descriptive, not causal",
             fontweight="bold")
fig.tight_layout()
fig.savefig(OUT["rmse_png"], dpi=150, bbox_inches="tight")
plt.close(fig)

fig, axes = plt.subplots(3, 3, figsize=(17, 12), sharey="col")
skill_fams = ["XGB-B", "LSTM-B", "Neural ODE"]
for i, scope in enumerate(["All", "Western", "Southern"]):
    t_sc = summ[(summ["split"] == "test") & (summ["scope"] == scope)]
    for jx, v in enumerate(NUTRIENTS):
        ax = axes[i, jx]
        for k, fam in enumerate(skill_fams):
            s = t_sc[(t_sc["nutrient"] == v) & (t_sc["model"] == fam)].set_index("season").reindex(SEASONS)
            x = np.arange(len(SEASONS)) + (k - 1) * 0.26
            err = np.vstack([s["skill_mean"] - s["skill_min"], s["skill_max"] - s["skill_mean"]])
            ax.bar(x, s["skill_mean"], 0.26, color=COLOUR[fam], label=fam,
                   yerr=err if s["n_runs"].iloc[0] > 1 else None, capsize=3, error_kw={"lw": 1})
            if k == 1:
                for xi, val in zip(range(len(SEASONS)), s["skill_mean"]):
                    if pd.isna(val):
                        ax.text(xi, 0, "n/a\n(no change\nin this subset)", ha="center", va="bottom", fontsize=8,
                                color="#5A6B77")
        ax.axhline(0, color="#10222E", lw=1)
        n = t_sc[(t_sc["nutrient"] == v) & (t_sc["model"] == "Persistence")].set_index("season").reindex(SEASONS)["n_rows"]
        ax.set_xticks(range(len(SEASONS)))
        ax.set_xticklabels([f"{se}\nn = {int(n[se]):,}" for se in SEASONS], fontsize=9)
        if i == 0:
            ax.set_title(LABEL[v])
        if jx == 0:
            ax.set_ylabel(f"{scope} cells\nskill vs persistence")
axes[0, 0].legend(fontsize=9, loc="lower left")
fig.suptitle("Test 2022–2025: skill vs persistence by season (0 = no better than 'no change'; whiskers = range over 3 seeds)\n"
             "Seasons are fixed calendar-month labels by target date · descriptive, not causal", fontweight="bold")
fig.tight_layout()
fig.savefig(OUT["skill_png"], dpi=150, bbox_inches="tight")
plt.close(fig)

# ================================================================== 9. read-only proof, CSV, summary
hash_after = {str(p): sha256(p) for p in INPUTS}
changed = [k for k in hash_before if hash_before[k] != hash_after[k]]
check("all input files unchanged (SHA-256 before = after)", not changed, ", ".join(changed) if changed else
      f"{len(INPUTS)} files")
stop_if_failed("read-only proof")
csv[order].round(6).to_csv(OUT["csv"], index=False)


def md_table(frame, cols, fmt=None):
    fmt = fmt or {}
    out = ["| " + " | ".join(cols) + " |", "|" + "---|" * len(cols)]
    for _, r in frame.iterrows():
        out.append("| " + " | ".join(fmt.get(c, "{}").format(r[c]) for c in cols) + " |")
    return "\n".join(out)


def wide(metric, scope="All", digits=4):
    t = table("test", scope, metric).reset_index()
    t = t[t["season"].isin(SEASONS + ["All seasons"])]
    return md_table(t, ["season", "model"] + NUTRIENTS, {v: "{:." + str(digits) + "f}" for v in NUTRIENTS})


def lowest(season, v, metric="rmse_mean"):
    s = t_all[(t_all["season"] == season) & (t_all["nutrient"] == v) & (t_all["model"] != "Persistence")]
    return s.loc[s[metric].idxmin(), "model"]


count_tbl = pd.DataFrame([{"season": se, "name": SEASON_NAME[se],
                           "test_rows": int((test["season"] == se).sum()),
                           "western_rows": int(((test["season"] == se) & (test["region"] == "Western")).sum()),
                           "southern_rows": int(((test["season"] == se) & (test["region"] == "Southern")).sum()),
                           "seasonal_occurrences": int(occ.get(se, 0))} for se in SEASONS])
low_lines = "\n".join(f"- **{se}**: lowest mean RMSE – NO₃ {lowest(se, 'no3')}, PO₄ {lowest(se, 'po4')}, "
                      f"Si {lowest(se, 'si')}." for se in SEASONS)
passed = sum(ok for _, ok, _ in CHECKS)

md = f"""# Component 1 – per-season evaluation (PP1)

Generated by `scripts/16_season_evaluation.py`. Read-only and inference only: the six saved neural runs
were loaded and evaluated with gradients disabled; nothing was retrained, tuned or re-selected.
**Automatic checks: {passed} of {len(CHECKS)} passed**, including exact reproduction of every E23 test
RMSE and of the Component 2 export (`evidence/pp1/E37_season_evaluation_log.txt`).

## How seasons were evaluated
- Rows: the same {EXPECTED_COMMON:,} common validation + test rows as the fair comparison (E23); the
  headline uses the {EXPECTED_TEST:,} **held-out test rows (2022–2025)**. Validation is kept in E38 as a reference.
- Season = calendar month of the **forecast target date**.
- Neural models: metrics computed for each of 3 seeds, then averaged (spread shown as whiskers); no ensemble,
  no seed selection.

## Test rows per season
{md_table(count_tbl, ["season", "name", "test_rows", "western_rows", "southern_rows", "seasonal_occurrences"], {c: "{:,}" for c in ["test_rows", "western_rows", "southern_rows"]})}

Rows within a season are strongly dependent, and the test period contains only a few occurrences of each
season, so season-to-season differences are descriptive.

## Test RMSE by season (mmol m⁻³, mean over runs)
{wide("rmse_mean")}

## Test skill vs persistence by season (all cells)
{wide("skill_mean", digits=3)}

Regional skill tables (Western, Southern) and MAE: `evidence/pp1/E38_season_metrics.csv`.
Figures: `E39_season_rmse.png`, `E40_season_skill.png`.

## Descriptive observations (test, all cells)
{low_lines}

Descriptive robustness by season (same rule as E23; many comparisons, so not formal tests):

{md_table(verdicts, ["season", "nutrient", "Neural ODE vs XGB-B", "Neural ODE vs LSTM-B"])}

## Interpretation limits
""" + "\n".join(f"- {s}" for s in STATEMENTS) + "\n"
OUT["summary"].write_text(md, encoding="utf-8")

log(f"\nValidation: {passed} of {len(CHECKS)} checks passed.")
log("Written: " + " | ".join(str(p).replace("\\", "/") for p in OUT.values()))
if passed != len(CHECKS):
    raise SystemExit("ERROR: at least one check failed.")
log("Step 16 completed successfully.")
