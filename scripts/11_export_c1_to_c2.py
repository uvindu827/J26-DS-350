"""
Step 11 - Component 1 export for Component 2 (C1 side only).
Follows docs/integration_contract_c1_c2.md v1.0 exactly; does not do any Component 2 processing.

Exports the Neural ODE forecasts for the shared TEST period (2022-2025), all 12 coastal cells,
lead times 1-7, with Copernicus reference values. The model run is selected by lowest
VALIDATION loss among the three seeds (test data is not used for selection).
"""
from pathlib import Path
import json
import numpy as np
import pandas as pd
import torch

from common import NUTRIENTS, HORIZON, SEED, load_dataset
from node_model import build_model, prepare_arrays, windows, get_batch, FORCING_COLS, STATIC_COLS

SEEDS = [SEED, 7, 2026]
CONTRACT_COLS = ["cell_id", "latitude", "longitude", "issue_date", "lead_time_days", "target_date",
                 "no3", "po4", "si", "no3_copernicus", "po4_copernicus", "si_copernicus", "model_name"]
OUT = Path("outputs/c1_to_c2"); OUT.mkdir(parents=True, exist_ok=True)
EVID = Path("evidence/pp1")
CSV_NAME = "c1_nutrient_forecasts_test_2022_2025.csv"
LOG_FILE = EVID / "E26_c2_export_log.txt"
LOG_FILE.write_text("")

def log(msg=""):
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(str(msg) + "\n")

def suffix(seed):
    return "" if seed == SEED else f"_s{seed}"

# ------------------------------------------------------------ 1. select the run on VALIDATION loss
log("Model selection (validation loss only):")
cands = []
for seed in SEEDS:
    cfg = json.loads(Path(f"experiments/node{suffix(seed)}_config.json").read_text())
    cands.append((cfg["best_val_loss"], seed, cfg))
    log(f"  NeuralODE seed {seed:5d}: best validation loss {cfg['best_val_loss']:.5f}")
_, seed, cfg = min(cands, key=lambda c: c[0])
model_name = f"NeuralODE_s{seed}"
log(f"Selected: {model_name}\n")

# ------------------------------------------------------------ 2. forecasts for the test period
df = load_dataset()
arr = prepare_arrays(df)
model = build_model("node", len(FORCING_COLS), len(STATIC_COLS), cfg["hidden"], cfg.get("substeps", 1))
model.load_state_dict(torch.load(f"experiments/models/node{suffix(seed)}_best.pt"))
model.eval()

idx = windows(arr, "test")
P = []
with torch.no_grad():
    for i in range(0, len(idx), 4096):
        z0, U, s, _ = get_batch(arr, idx[i:i + 4096])
        P.append(model(z0, U, s).numpy())
P = np.clip(np.concatenate(P) * arr["stats"]["z_std"] + arr["stats"]["z_mean"], 0, None)
steps = idx[:, 1][:, None] + np.arange(1, HORIZON + 1)[None, :]
truth = arr["Z_raw"][idx[:, 0][:, None], steps]          # exact Copernicus values

cells = np.array(arr["cells"], dtype=str)
out = pd.DataFrame({
    "cell_id": np.repeat(cells[idx[:, 0]], HORIZON),
    "issue_date": pd.to_datetime(np.repeat(arr["dates"][idx[:, 1]], HORIZON)),
    "lead_time_days": np.tile(np.arange(1, HORIZON + 1), len(idx)),
})
out["target_date"] = out["issue_date"] + pd.to_timedelta(out["lead_time_days"], unit="D")
for k, v in enumerate(NUTRIENTS):
    out[v] = P[:, :, k].reshape(-1)
    out[f"{v}_copernicus"] = truth[:, :, k].reshape(-1)

coords = pd.read_csv("data/processed/cells.csv")
coords["cell_id"] = coords["cell_id"].astype(str)
coastal_ids = set(coords.loc[coords["is_coastal"], "cell_id"])
out = out.merge(coords[["cell_id", "lat", "lon"]].rename(columns={"lat": "latitude", "lon": "longitude"}),
                on="cell_id", how="left")
out["model_name"] = model_name
out = out[CONTRACT_COLS].sort_values(["cell_id", "issue_date", "lead_time_days"]).reset_index(drop=True)
num = ["no3", "po4", "si", "no3_copernicus", "po4_copernicus", "si_copernicus"]
out[num] = out[num].round(6)

# ------------------------------------------------------------ 3. contract checks (C1 side)
log("Contract checks (integration_contract_c1_c2.md v1.0):")
checks = {
    "columns exactly as contract": list(out.columns) == CONTRACT_COLS,
    "all 12 coastal cell_ids from cells.csv": set(out["cell_id"]) == coastal_ids,
    "lead_time_days exactly 1..7": sorted(out["lead_time_days"].unique().tolist()) == list(range(1, 8)),
    "unique key cell_id + issue_date + lead_time_days": not out.duplicated(
        ["cell_id", "issue_date", "lead_time_days"]).any(),
    "target_date = issue_date + lead_time_days": bool(
        ((out["target_date"] - out["issue_date"]).dt.days == out["lead_time_days"]).all()),
    "target dates inside test period 2022-01-01..2025-12-31": bool(
        out["target_date"].min() >= pd.Timestamp("2022-01-01")
        and out["target_date"].max() <= pd.Timestamp("2025-12-31")),
    "same number of rows for every cell": out.groupby("cell_id").size().nunique() == 1,
    "no missing values": not out.isnull().any().any(),
    "no negative concentrations": bool((out[num] >= 0).all().all()),
    "cell centres on the 0.25 degree grid": bool(((out["latitude"] * 4) % 1 == 0).all()
                                                  and ((out["longitude"] * 4) % 1 == 0).all()),
}
for name, ok in checks.items():
    log(f"  [{'PASS' if ok else 'FAIL'}] {name}")
if not all(checks.values()):
    raise SystemExit("ERROR: export does not meet the contract. Nothing was written.")

# ------------------------------------------------------------ 4. traceability: file metrics = E23 metrics
per = pd.read_csv("experiments/results/seed_robustness_per_run.csv")
ref = per[(per["model"] == model_name) & (per["split"] == "test") & (per["subset"] == "All")
          & (per["h"].astype(str) == "all")].set_index("nutrient")["rmse"]
log("\nTraceability (RMSE computed from the exported file vs E23 evaluation):")
for v in NUTRIENTS:
    rmse = float(np.sqrt(np.mean((out[v] - out[f"{v}_copernicus"]) ** 2)))
    log(f"  {v}: file {rmse:.4f} | E23 {ref[v]:.4f} | {'MATCH' if abs(rmse - ref[v]) < 1e-3 else 'MISMATCH'}")

# ------------------------------------------------------------ 5. write file, README, preview
out.to_csv(OUT / CSV_NAME, index=False, date_format="%Y-%m-%d")
out.head(50).to_csv(EVID / "E26_c2_export_preview.csv", index=False, date_format="%Y-%m-%d")

readme = f"""# Component 1 nutrient forecasts for Component 2

File: `{CSV_NAME}`  |  Contract: `docs/integration_contract_c1_c2.md` v1.0  |  Model: `{model_name}`

- Rows: {len(out):,} = 12 cells x {out['issue_date'].nunique():,} issue dates x 7 lead times
- Issue dates: {out['issue_date'].min().date()} to {out['issue_date'].max().date()}
- Target dates: {out['target_date'].min().date()} to {out['target_date'].max().date()} (shared test period)
- Units: mmol m-3 for all nutrient columns; dates ISO YYYY-MM-DD; no missing values
- Unique row key: cell_id + issue_date + lead_time_days. Each target_date appears 7 times per cell
  (once per lead time) - filter to one lead_time_days before joining on cell_id + target_date.
- no3/po4/si: Component 1 forecasts. *_copernicus: original Copernicus GLOBAL_MULTIYEAR_BGC_001_029
  surface values for the same cell and target_date (reference).
- Mode: hindcast-forcing (reanalysis forcing over the forecast window).
- Model selection: Neural ODE run with the lowest validation loss among 3 seeds; test data not used.
- Training/validation years (1997-2021) are not included: Component 2 uses original Copernicus
  nutrients for those years, as agreed in the contract.
"""
(OUT / "README_c1_nutrient_forecasts.md").write_text(readme, encoding="utf-8")
Path("docs/c1_to_c2_export_notes.md").write_text(readme, encoding="utf-8")

size_mb = (OUT / CSV_NAME).stat().st_size / 1e6
log(f"\nWritten: outputs/c1_to_c2/{CSV_NAME} ({len(out):,} rows, {size_mb:.1f} MB)")
log("Written: outputs/c1_to_c2/README_c1_nutrient_forecasts.md, docs/c1_to_c2_export_notes.md")
log("Step 11 completed successfully.")