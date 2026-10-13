"""
Step 07 - Persistence reference + Random Forest and XGBoost baselines (feature sets A and B).

Task   : given nutrients on day t0 and conditions over the next days, predict NO3, PO4, Si
         at t0+1 ... t0+7 (hindcast-forcing mode).
Models : predict the CHANGE from t0; forecast = t0 value + predicted change (clipped at 0).
Rules  : trained on train split only; XGBoost early-stops on validation; test scored once.
Outputs: experiments/results/baseline_metrics.csv
         experiments/baselines_config.json
         data/processed/predictions/baseline_predictions.parquet
         evidence/pp1/E11_baselines_log.txt, E11/E12/E13 plots
"""
from pathlib import Path
import json
import time
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from xgboost import XGBRegressor
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from common import (NUTRIENTS, HORIZON, SEED, FEATURE_SETS, T0_COLS, TARGET_COLS,
                    STATE_INPUTS, load_dataset, make_samples, evaluate)

RES = Path("experiments/results"); RES.mkdir(parents=True, exist_ok=True)
MODELS = Path("experiments/models"); MODELS.mkdir(parents=True, exist_ok=True)
PRED = Path("data/processed/predictions"); PRED.mkdir(parents=True, exist_ok=True)
EVID = Path("evidence/pp1")
LOG_FILE = EVID / "E11_baselines_log.txt"
LOG_FILE.write_text("")

def log(msg=""):
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(str(msg) + "\n")

RF_PARAMS = dict(n_estimators=200, min_samples_leaf=5, max_features=0.5, max_samples=0.3,
                 n_jobs=-1, random_state=SEED)
XGB_PARAMS = dict(n_estimators=2000, learning_rate=0.05, max_depth=8, min_child_weight=5,
                  subsample=0.8, colsample_bytree=0.8, tree_method="hist",
                  early_stopping_rounds=50, eval_metric="rmse", n_jobs=-1, random_state=SEED)

# ------------------------------------------------------------ 1. samples
df = load_dataset()
s = make_samples(df)
log(f"Forecast samples (cell x t0 x lead time): {len(s):,}")
log(s.groupby("split").size().to_string())

train = s[s["split"] == "train"].reset_index(drop=True)
ev = s[s["split"].isin(["val", "test"])].reset_index(drop=True)
val_mask = (ev["split"] == "val").to_numpy()
y_tr = train[TARGET_COLS].to_numpy() - train[T0_COLS].to_numpy()   # target = change from t0
y_ev = ev[TARGET_COLS].to_numpy() - ev[T0_COLS].to_numpy()

preds = ev[["cell_id", "region", "t0", "h", "split", "target_date"] + T0_COLS + TARGET_COLS].copy()
results = []

def add_result(name, fs, delta_pred):
    z = np.clip(ev[T0_COLS].to_numpy() + delta_pred, 0, None)   # concentrations cannot be negative
    tmp = ev[["split", "region", "h"] + TARGET_COLS].copy()
    for i, v in enumerate(NUTRIENTS):
        tmp[f"{v}_pred"] = z[:, i]
        preds[f"{name}__{v}"] = z[:, i]
    results.append(evaluate(tmp, name, fs))

# ------------------------------------------------------------ 2. persistence
add_result("Persistence", "-", np.zeros((len(ev), len(NUTRIENTS))))
log("\nPersistence reference done.")

# ------------------------------------------------------------ 3. RF and XGBoost, feature sets A and B
importance = None
for fs, feats in FEATURE_SETS.items():
    cols = STATE_INPUTS + feats
    X_tr = train[cols].to_numpy(np.float32)
    X_ev = ev[cols].to_numpy(np.float32)
    log(f"\n=== Feature set {fs}: {len(cols)} inputs ===")

    t = time.time()
    rf = RandomForestRegressor(**RF_PARAMS).fit(X_tr, y_tr)
    log(f"RF_{fs} trained in {time.time() - t:.0f} s")
    add_result(f"RF_{fs}", fs, rf.predict(X_ev))
    del rf

    t = time.time()
    xgb = XGBRegressor(**XGB_PARAMS)
    xgb.fit(X_tr, y_tr, eval_set=[(X_ev[val_mask], y_ev[val_mask])], verbose=200)
    log(f"XGB_{fs} trained in {time.time() - t:.0f} s | best iteration: {xgb.best_iteration}")
    add_result(f"XGB_{fs}", fs, xgb.predict(X_ev))
    xgb.save_model(MODELS / f"xgb_{fs}.json")
    if fs == "B_process":
        importance = pd.Series(xgb.feature_importances_, index=cols).sort_values()

# ------------------------------------------------------------ 4. save metrics, predictions, config
metrics = pd.concat(results, ignore_index=True)
metrics.to_csv(RES / "baseline_metrics.csv", index=False)
preds.to_parquet(PRED / "baseline_predictions.parquet", index=False)
(Path("experiments") / "baselines_config.json").write_text(json.dumps({
    "task": f"predict NO3/PO4/Si at t0+1..t0+{HORIZON} from state at t0 + forcing (hindcast-forcing mode)",
    "target": "change from t0; forecast = t0 + predicted change, clipped at 0",
    "feature_sets": FEATURE_SETS, "rf_params": RF_PARAMS,
    "xgb_params": {k: v for k, v in XGB_PARAMS.items()}, "seed": SEED,
    "tuning": "XGBoost early stopping on validation only; test scored once"}, indent=2, default=str))

# ------------------------------------------------------------ 5. summary tables
def summary(split):
    m = metrics[(metrics["split"] == split) & (metrics["subset"] == "All") & (metrics["h"] == "all")]
    t = m.pivot(index="model", columns="nutrient", values=["rmse", "mae", "r2"])
    pers = m[m["model"] == "Persistence"].set_index("nutrient")["rmse"]
    skill = m.pivot(index="model", columns="nutrient", values="rmse").apply(lambda r: 1 - r / pers, axis=1)
    return t.round(4), skill.round(3)

for split in ["val", "test"]:
    t, skill = summary(split)
    log(f"\n===== {split.upper()} (all cells, all lead times) =====")
    log(t.to_string())
    log(f"\nSkill vs persistence (1 - RMSE/RMSE_persistence; >0 = better than 'no change'):")
    log(skill.to_string())

# ------------------------------------------------------------ 6. evidence plots
m = metrics[(metrics["split"] == "test") & (metrics["subset"] == "All") & (metrics["h"] != "all")].copy()
m["h"] = m["h"].astype(int)
fig, axes = plt.subplots(1, 3, figsize=(16, 4.5))
for ax, v in zip(axes, NUTRIENTS):
    for name, grp in m[m["nutrient"] == v].groupby("model"):
        grp = grp.sort_values("h")
        ax.plot(grp["h"], grp["rmse"], marker="o", label=name)
    ax.set_title(f"{v.upper()} - test RMSE by lead time")
    ax.set_xlabel("Lead time h (days)"); ax.set_ylabel("RMSE (mmol m-3)")
axes[0].legend(fontsize=8)
plt.tight_layout()
plt.savefig(EVID / "E11_baseline_rmse_by_horizon.png", dpi=150, bbox_inches="tight")
plt.close()

ax = importance.tail(20).plot(kind="barh", figsize=(8, 7))
ax.set_title("XGBoost (feature set B) - top 20 feature importances (gain)")
plt.savefig(EVID / "E12_xgb_feature_importance.png", dpi=150, bbox_inches="tight")
plt.close()

cid = "N6.75_E79.75"
one = preds[(preds["cell_id"] == cid) & (preds["h"] == 7) & (preds["split"] == "test")].sort_values("target_date")
fig, axes = plt.subplots(3, 1, figsize=(13, 9), sharex=True)
for ax, v in zip(axes, NUTRIENTS):
    ax.plot(one["target_date"], one[f"{v}_target"], color="black", lw=1, label="Copernicus (true)")
    ax.plot(one["target_date"], one[f"Persistence__{v}"], lw=0.8, alpha=0.7, label="Persistence")
    ax.plot(one["target_date"], one[f"XGB_B_process__{v}"], lw=0.8, label="XGBoost B")
    ax.set_ylabel(f"{v.upper()} (mmol m-3)")
axes[0].legend()
axes[0].set_title(f"{cid}: 7-day-ahead forecasts on the test period (2022-2025)")
plt.savefig(EVID / "E13_test_timeseries_h7.png", dpi=150, bbox_inches="tight")
plt.close()

log("\nSaved: baseline_metrics.csv, baselines_config.json, baseline_predictions.parquet, E11-E13 plots")
log("Step 07 completed successfully.")