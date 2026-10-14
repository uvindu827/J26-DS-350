"""
Step 10 - Seed robustness of the neural models (design unchanged; only the random seed varies).

Neural ODE and LSTM-B x seeds {42 (original), 7, 2026}, scored on the SAME rows as the
baselines. Reports mean +/- std across seeds and applies a robustness rule stated in advance.
"""
from pathlib import Path
import json
import numpy as np
import pandas as pd
import torch
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from common import NUTRIENTS, HORIZON, TARGET_COLS, SEED, load_dataset, evaluate
from node_model import build_model, prepare_arrays, windows, get_batch, FORCING_COLS, STATIC_COLS

SEEDS = [SEED, 7, 2026]
NEURAL = {"node": "NeuralODE", "lstm": "LSTM_B"}
REFERENCE = ["Persistence", "RF_B_process", "XGB_B_process"]
FAMILIES = ["Persistence", "RF_B_process", "XGB_B_process", "LSTM_B", "NeuralODE"]
KEYS = ["cell_id", "t0", "h"]

EVID = Path("evidence/pp1")
RES = Path("experiments/results")
PRED = Path("data/processed/predictions")
LOG_FILE = EVID / "E23_seed_robustness_log.txt"
LOG_FILE.write_text("")

def log(msg=""):
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(str(msg) + "\n")

def suffix(seed):
    return "" if seed == SEED else f"_s{seed}"

log("ROBUSTNESS RULE (stated before results): a difference between two models is ROBUST only if")
log("  (1) every run of one model beats every run of the other, AND")
log("  (2) |difference of means| > 2 x the larger run-to-run standard deviation.")
log("  Trees are single runs (std treated as 0). Otherwise: 'no robust difference'.\n")

# ------------------------------------------------------------ 1. predictions for every neural run
df = load_dataset()
arr = prepare_arrays(df)
z_mean, z_std = arr["stats"]["z_mean"], arr["stats"]["z_std"]
cells = np.array(arr["cells"], dtype=str)

def predict(model, name):
    frames = []
    for split in ["val", "test"]:
        idx = windows(arr, split)
        P, Yt = [], []
        with torch.no_grad():
            for i in range(0, len(idx), 4096):
                z0, U, s, Y = get_batch(arr, idx[i:i + 4096])
                P.append(model(z0, U, s).numpy()); Yt.append(Y.numpy())
        P = np.clip(np.concatenate(P) * z_std + z_mean, 0, None)
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

j = fix_types(pd.read_parquet(PRED / "baseline_predictions.parquet"))
run_names = []
log("Runs:")
for key, label in NEURAL.items():
    for seed in SEEDS:
        pt = Path(f"experiments/models/{key}{suffix(seed)}_best.pt")
        if not pt.exists():
            raise SystemExit(f"ERROR: missing {pt}. Train it: "
                             f"python scripts/08_train_neural_ode.py --model {key} --seed {seed}")
        cfg = json.loads(Path(f"experiments/{key}{suffix(seed)}_config.json").read_text())
        model = build_model(key, len(FORCING_COLS), len(STATIC_COLS), cfg["hidden"], cfg.get("substeps", 1))
        model.load_state_dict(torch.load(pt))
        model.eval()
        name = f"{label}_s{seed}"
        j = j.merge(fix_types(predict(model, name)), on=KEYS, how="inner")
        diff = max(float(np.abs(j[f"{v}_target"] - j[f"{v}_check"]).max()) for v in NUTRIENTS)
        j = j.drop(columns=[f"{v}_check" for v in NUTRIENTS])
        if diff > 1e-3:
            raise SystemExit(f"ERROR: {name} misaligned. Stopping.")
        run_names.append(name)
        log(f"  {name:16s} best val loss {cfg['best_val_loss']:.5f} | epochs {cfg['epochs_run']:3d} | "
            f"alignment {diff:.6f}")
log(f"Common rows: {len(j):,}\n")

# ------------------------------------------------------------ 2. score every run on identical rows
results = []
for m in REFERENCE + run_names:
    tmp = j[["split", "region", "h"] + TARGET_COLS].copy()
    for v in NUTRIENTS:
        tmp[f"{v}_pred"] = j[f"{m}__{v}"].to_numpy()
    results.append(evaluate(tmp, m, "-"))
per = pd.concat(results, ignore_index=True)
per["family"] = per["model"].str.replace(r"_s\d+$", "", regex=True)
pers = (per[per["model"] == "Persistence"][["split", "subset", "h", "nutrient", "rmse"]]
        .rename(columns={"rmse": "rmse_pers"}))
per = per.merge(pers, on=["split", "subset", "h", "nutrient"])
per["skill"] = 1 - per["rmse"] / per["rmse_pers"]
per.to_csv(RES / "seed_robustness_per_run.csv", index=False)

summary = (per.groupby(["family", "split", "subset", "h", "nutrient"])[["rmse", "mae", "r2", "skill"]]
           .agg(["mean", "std"]))
summary.columns = [f"{a}_{b}" for a, b in summary.columns]
summary.reset_index().to_csv(RES / "seed_robustness_summary.csv", index=False)

# ------------------------------------------------------------ 3. mean +/- std tables
def mean_sd(split, subset, metric, digits):
    s = per[(per["split"] == split) & (per["subset"] == subset) & (per["h"] == "all")]
    g = s.groupby(["family", "nutrient"])[metric].agg(["mean", "std"]).fillna(0.0)
    txt = g.apply(lambda r: f"{r['mean']:.{digits}f} ± {r['std']:.{digits}f}", axis=1).unstack("nutrient")
    return txt.reindex([f for f in FAMILIES if f in txt.index])

for split in ["val", "test"]:
    log(f"===== {split.upper()} - mean ± std across seeds (trees/persistence: single run) =====")
    for metric, d in [("rmse", 4), ("mae", 4), ("skill", 3)]:
        log(f"\n{metric.upper()}:")
        log(mean_sd(split, "All", metric, d).to_string())
    log("")
for region in ["Western", "Southern"]:
    log(f"===== TEST skill - {region} cells - mean ± std =====")
    log(mean_sd("test", region, "skill", 3).to_string())
    log("")

# ------------------------------------------------------------ 4. apply the robustness rule
def compare(a, b, split, subset, metric):
    s = per[(per["split"] == split) & (per["subset"] == subset) & (per["h"] == "all")]
    log(f"\n{a} vs {b} | {split} | {subset} | {metric.upper()} (lower is better)")
    for v in NUTRIENTS:
        A = s[(s["family"] == a) & (s["nutrient"] == v)][metric].to_numpy()
        B = s[(s["family"] == b) & (s["nutrient"] == v)][metric].to_numpy()
        sd = max(A.std(ddof=1) if len(A) > 1 else 0.0, B.std(ddof=1) if len(B) > 1 else 0.0)
        diff = A.mean() - B.mean()
        a_all = bool(np.all(A[:, None] < B[None, :]))
        b_all = bool(np.all(B[:, None] < A[None, :]))
        robust = (abs(diff) > 2 * sd) and (a_all or b_all)
        verdict = f"ROBUST: {a if diff < 0 else b} better" if robust else "no robust difference"
        log(f"  {v:3s}: {A.mean():.4f} vs {B.mean():.4f} | diff {diff:+.4f} | max sd {sd:.4f} | {verdict}")

for metric in ["rmse", "mae"]:
    compare("NeuralODE", "LSTM_B", "test", "All", metric)
    compare("NeuralODE", "XGB_B_process", "test", "All", metric)
    compare("LSTM_B", "XGB_B_process", "test", "All", metric)
compare("NeuralODE", "LSTM_B", "val", "All", "rmse")
for region in ["Western", "Southern"]:
    compare("NeuralODE", "LSTM_B", "test", region, "rmse")

# ------------------------------------------------------------ 5. plots
s = per[(per["split"] == "test") & (per["subset"] == "All") & (per["h"] == "all")]
show = ["RF_B_process", "XGB_B_process", "LSTM_B", "NeuralODE"]
fig, axes = plt.subplots(1, 3, figsize=(15, 4.5))
for ax, v in zip(axes, NUTRIENTS):
    sv = s[s["nutrient"] == v]
    for x, fam in enumerate(show):
        vals = sv[sv["family"] == fam]["rmse"].to_numpy()
        ax.bar(x, vals.mean(), yerr=vals.std(ddof=1) if len(vals) > 1 else 0, capsize=5, alpha=0.7)
        ax.scatter([x] * len(vals), vals, color="black", s=12, zorder=3)
    p_rmse = sv[sv["family"] == "Persistence"]["rmse"].iloc[0]
    ax.axhline(p_rmse, color="grey", ls="--", label="Persistence")
    ax.set_xticks(range(len(show))); ax.set_xticklabels(show, rotation=20, fontsize=8)
    lo = sv[sv["family"].isin(show)]["rmse"].min()
    ax.set_ylim(lo * 0.95, p_rmse * 1.02)
    ax.set_title(f"{v.upper()} - test RMSE (dots = seeds)")
axes[0].legend(fontsize=8)
plt.tight_layout()
plt.savefig(EVID / "E24_seed_rmse_bars.png", dpi=150, bbox_inches="tight")
plt.close()

hh = per[(per["split"] == "test") & (per["subset"] == "All") & (per["h"] != "all")].copy()
hh["h"] = hh["h"].astype(int)
fig, axes = plt.subplots(1, 3, figsize=(16, 4.5))
for ax, v in zip(axes, NUTRIENTS):
    hv = hh[hh["nutrient"] == v]
    for fam, col in [("Persistence", "grey"), ("XGB_B_process", "tab:orange"),
                     ("LSTM_B", "tab:purple"), ("NeuralODE", "tab:red")]:
        g = hv[hv["family"] == fam].groupby("h")["rmse"].agg(["mean", "std"]).fillna(0.0)
        ax.plot(g.index, g["mean"], marker="o", color=col, label=fam)
        ax.fill_between(g.index, g["mean"] - g["std"], g["mean"] + g["std"], color=col, alpha=0.2)
    ax.set_title(f"{v.upper()} - test RMSE by lead time (band = ±1 std over seeds)")
    ax.set_xlabel("Lead time h (days)"); ax.set_ylabel("RMSE (mmol m-3)")
axes[0].legend(fontsize=8)
plt.tight_layout()
plt.savefig(EVID / "E25_seed_rmse_by_horizon.png", dpi=150, bbox_inches="tight")
plt.close()

log("\nSaved: seed_robustness_per_run.csv, seed_robustness_summary.csv, E24/E25 plots")
log("Step 10 completed successfully.")