"""
Step 09 - Score the neural models on the SAME (cell, t0, lead time) rows as the baselines.

  python scripts/09_evaluate_neural_ode.py                          -> Neural ODE only (tag E17)
  python scripts/09_evaluate_neural_ode.py --models node lstm --tag E22

Every model is re-scored on identical rows; an alignment check proves the true values match.
Test split is scored here only.
"""
from pathlib import Path
import argparse
import json
import numpy as np
import pandas as pd
import torch
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from common import NUTRIENTS, HORIZON, TARGET_COLS, load_dataset, evaluate
from node_model import build_model, prepare_arrays, windows, get_batch, FORCING_COLS, STATIC_COLS

p = argparse.ArgumentParser()
p.add_argument("--models", nargs="+", choices=["node", "lstm"], default=["node"])
p.add_argument("--tag", default="E17")
args = p.parse_args()
NAMES = {"node": "NeuralODE", "lstm": "LSTM_B"}
COLOURS = {"NeuralODE": "tab:red", "LSTM_B": "tab:purple"}

EVID = Path("evidence/pp1")
RES = Path("experiments/results")
PRED = Path("data/processed/predictions")
LOG_FILE = EVID / f"{args.tag}_model_comparison_log.txt"
LOG_FILE.write_text("")

def log(msg=""):
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(str(msg) + "\n")

df = load_dataset()
arr = prepare_arrays(df)
z_mean, z_std = arr["stats"]["z_mean"], arr["stats"]["z_std"]
cells = np.array(arr["cells"], dtype=str)
KEYS = ["cell_id", "t0", "h"]

def predict(model, name):
    frames = []
    for split in ["val", "test"]:
        idx = windows(arr, split)
        P, Yt = [], []
        with torch.no_grad():
            for i in range(0, len(idx), 4096):
                z0, U, s, Y = get_batch(arr, idx[i:i + 4096])
                P.append(model(z0, U, s).numpy()); Yt.append(Y.numpy())
        P = np.clip(np.concatenate(P) * z_std + z_mean, 0, None)   # back to mmol m-3
        Yt = np.concatenate(Yt) * z_std + z_mean
        out = pd.DataFrame({"cell_id": np.repeat(cells[idx[:, 0]], HORIZON),
                            "t0": np.repeat(arr["dates"][idx[:, 1]], HORIZON),
                            "h": np.tile(np.arange(1, HORIZON + 1), len(idx))})
        for k, v in enumerate(NUTRIENTS):
            out[f"{name}__{v}"] = P[:, :, k].reshape(-1)
            out[f"{v}_check"] = Yt[:, :, k].reshape(-1)
        frames.append(out)
    return pd.concat(frames, ignore_index=True)

def fix_types(d):
    d["cell_id"] = d["cell_id"].astype(str)
    d["t0"] = pd.to_datetime(d["t0"]).astype("datetime64[ns]")
    d["h"] = d["h"].astype(int)
    return d

# ------------------------------------------------------------ 1. join baselines + each neural model
j = fix_types(pd.read_parquet(PRED / "baseline_predictions.parquet"))
log(f"Baseline rows: {len(j):,}")
neural = []
for key in args.models:
    name = NAMES[key]
    cfg = json.loads(Path(f"experiments/{key}_config.json").read_text())
    model = build_model(key, len(FORCING_COLS), len(STATIC_COLS), cfg["hidden"], cfg.get("substeps", 1))
    model.load_state_dict(torch.load(f"experiments/models/{key}_best.pt"))
    model.eval()
    out = fix_types(predict(model, name))
    j = j.merge(out, on=KEYS, how="inner")
    diff = max(float(np.abs(j[f"{v}_target"] - j[f"{v}_check"]).max()) for v in NUTRIENTS)
    j = j.drop(columns=[f"{v}_check" for v in NUTRIENTS])
    log(f"{name}: {len(out):,} rows | common rows now {len(j):,} | alignment max diff {diff:.6f}")
    if diff > 1e-3:
        raise SystemExit(f"ERROR: {name} samples are misaligned. Stopping.")
    neural.append(name)

# ------------------------------------------------------------ 2. score every model on identical rows
names = sorted({c.split("__")[0] for c in j.columns if "__" in c and c.split("__")[0] not in neural}) + neural
results = []
for m in names:
    tmp = j[["split", "region", "h"] + TARGET_COLS].copy()
    for v in NUTRIENTS:
        tmp[f"{v}_pred"] = j[f"{m}__{v}"].to_numpy()
    results.append(evaluate(tmp, m, "-"))
metrics = pd.concat(results, ignore_index=True)
metrics.to_csv(RES / f"comparison_metrics_{args.tag}.csv", index=False)
j.to_parquet(PRED / "all_predictions.parquet", index=False)

def skill_table(split, subset="All"):
    m = metrics[(metrics["split"] == split) & (metrics["subset"] == subset) & (metrics["h"] == "all")]
    pers = m[m["model"] == "Persistence"].set_index("nutrient")["rmse"]
    return m, m.pivot(index="model", columns="nutrient", values="rmse").apply(lambda r: 1 - r / pers, axis=1)

for split in ["val", "test"]:
    m, skill = skill_table(split)
    log(f"\n===== {split.upper()} - all models on identical samples =====")
    log(m.pivot(index="model", columns="nutrient", values=["rmse", "mae", "r2"]).round(4).to_string())
    log("\nSkill vs persistence:")
    log(skill.round(3).to_string())
for region in ["Western", "Southern"]:
    _, skill = skill_table("test", region)
    log(f"\nTEST skill vs persistence - {region} cells only:")
    log(skill.round(3).to_string())

# ------------------------------------------------------------ 3. plots
m = metrics[(metrics["split"] == "test") & (metrics["subset"] == "All") & (metrics["h"] != "all")].copy()
m["h"] = m["h"].astype(int)
fig, axes = plt.subplots(1, 3, figsize=(16, 4.5))
for ax, v in zip(axes, NUTRIENTS):
    for name, grp in m[m["nutrient"] == v].groupby("model"):
        grp = grp.sort_values("h")
        ax.plot(grp["h"], grp["rmse"], marker="o", lw=2.5 if name in neural else 1.2, label=name)
    ax.set_title(f"{v.upper()} - test RMSE by lead time")
    ax.set_xlabel("Lead time h (days)"); ax.set_ylabel("RMSE (mmol m-3)")
axes[0].legend(fontsize=8)
plt.tight_layout()
plt.savefig(EVID / f"{args.tag}_all_models_rmse_by_horizon.png", dpi=150, bbox_inches="tight")
plt.close()

cid = "N6.75_E79.75"
one = j[(j["cell_id"] == cid) & (j["h"] == 7) & (j["split"] == "test")].sort_values("target_date")
fig, axes = plt.subplots(3, 1, figsize=(13, 9), sharex=True)
for ax, v in zip(axes, NUTRIENTS):
    ax.plot(one["target_date"], one[f"{v}_target"], color="black", lw=1, label="Copernicus (true)")
    ax.plot(one["target_date"], one[f"XGB_B_process__{v}"], lw=0.8, color="tab:orange", label="XGBoost B")
    for name in neural:
        ax.plot(one["target_date"], one[f"{name}__{v}"], lw=0.8, color=COLOURS[name], label=name)
    ax.set_ylabel(f"{v.upper()} (mmol m-3)")
axes[0].legend()
axes[0].set_title(f"{cid}: 7-day-ahead forecasts, test period 2022-2025")
plt.savefig(EVID / f"{args.tag}_test_timeseries_h7.png", dpi=150, bbox_inches="tight")
plt.close()

start, end = pd.Timestamp("2024-05-01"), pd.Timestamp("2024-08-31")
truth = df[(df["cell_id"] == cid) & (df["date"].between(start, end))]
sel = j[(j["cell_id"] == cid) & (j["t0"].between(start, end))]
issue_days = sorted(sel["t0"].unique())[::7]
fig, axes = plt.subplots(3, 1, figsize=(13, 9), sharex=True)
for ax, v in zip(axes, NUTRIENTS):
    ax.plot(truth["date"], truth[v], color="black", lw=1.2)
    for d in issue_days:
        seg = sel[sel["t0"] == d].sort_values("h")
        ax.plot(seg["target_date"], seg[f"XGB_B_process__{v}"], color="tab:orange", lw=1, ls="--")
        for name in neural:
            ax.plot(seg["target_date"], seg[f"{name}__{v}"], color=COLOURS[name], lw=1.5)
        ax.scatter([d], [seg[f"{v}_t0"].iloc[0]], color="black", s=10, zorder=3)
    ax.set_ylabel(f"{v.upper()} (mmol m-3)")
axes[0].plot([], [], color="black", label="Copernicus (true)")
axes[0].plot([], [], color="tab:orange", ls="--", label="XGBoost B")
for name in neural:
    axes[0].plot([], [], color=COLOURS[name], label=f"{name} 7-day path")
axes[0].legend(fontsize=8)
axes[0].set_title(f"{cid}: weekly-issued 7-day forecasts, Southwest Monsoon 2024 (dot = issue day)")
plt.savefig(EVID / f"{args.tag}_forecast_trajectories_swm2024.png", dpi=150, bbox_inches="tight")
plt.close()

log(f"\nSaved: comparison_metrics_{args.tag}.csv, all_predictions.parquet, {args.tag} plots")
log("Step 09 completed successfully.")