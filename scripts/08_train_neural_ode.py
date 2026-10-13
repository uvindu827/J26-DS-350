"""
Step 08 - Train the simplified multi-nutrient Neural ODE.

  python scripts/08_train_neural_ode.py --overfit   -> sanity check on 256 windows (evidence E14)
  python scripts/08_train_neural_ode.py             -> full training, early stopping on validation (E15/E16)

Train split only for learning; validation only for early stopping; test is NOT touched here.
"""
from pathlib import Path
import argparse
import json
import time
import numpy as np
import pandas as pd
import torch
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from common import SEED, load_dataset
from node_model import NeuralODE, prepare_arrays, windows, get_batch, FORCING_COLS, STATIC_COLS

p = argparse.ArgumentParser()
p.add_argument("--overfit", action="store_true", help="sanity check: fit 256 training windows only")
p.add_argument("--epochs", type=int, default=40)
p.add_argument("--hidden", type=int, default=64)
p.add_argument("--lr", type=float, default=1e-3)
p.add_argument("--batch", type=int, default=512)
p.add_argument("--patience", type=int, default=6)
p.add_argument("--substeps", type=int, default=1)
args = p.parse_args()

torch.manual_seed(SEED)
rng = np.random.default_rng(SEED)
EVID = Path("evidence/pp1")
RES = Path("experiments/results"); RES.mkdir(parents=True, exist_ok=True)
MODELS = Path("experiments/models"); MODELS.mkdir(parents=True, exist_ok=True)
tag = "E14_node_overfit" if args.overfit else "E15_node_training"
LOG_FILE = EVID / f"{tag}_log.txt"
LOG_FILE.write_text("")

def log(msg=""):
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(str(msg) + "\n")

# ------------------------------------------------------------ data + model
df = load_dataset()
arr = prepare_arrays(df)
tr, va = windows(arr, "train"), windows(arr, "val")
log(f"Training windows: {len(tr):,} | validation windows: {len(va):,}")
log(f"Inputs: state 3 | forcing {len(FORCING_COLS)} | static {len(STATIC_COLS)}")

model = NeuralODE(len(FORCING_COLS), len(STATIC_COLS), args.hidden, args.substeps)
n_params = sum(p.numel() for p in model.parameters())
log(f"Neural ODE parameters: {n_params:,} | hidden={args.hidden} | RK4 substeps/day={args.substeps}")
opt = torch.optim.Adam(model.parameters(), lr=args.lr)
mse = torch.nn.MSELoss()

def eval_loss(idx, persistence=False, bs=4096):
    model.eval(); tot, n = 0.0, 0
    with torch.no_grad():
        for i in range(0, len(idx), bs):
            z0, U, s, Y = get_batch(arr, idx[i:i + bs])
            pred = z0[:, None, :].expand_as(Y) if persistence else model(z0, U, s)
            tot += mse(pred, Y).item() * len(Y); n += len(Y)
    model.train()
    return tot / n

# ------------------------------------------------------------ mode 1: overfit sanity check
if args.overfit:
    sub = tr[rng.choice(len(tr), 256, replace=False)]
    z0, U, s, Y = get_batch(arr, sub)
    hist = []
    for it in range(1, 601):
        opt.zero_grad()
        loss = mse(model(z0, U, s), Y)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        hist.append(loss.item())
        if it == 1 or it % 50 == 0:
            log(f"iteration {it:4d} | loss {loss.item():.5f}")
    log(f"\nLoss {hist[0]:.5f} -> {hist[-1]:.5f} ({100 * (1 - hist[-1] / hist[0]):.1f}% reduction)")
    plt.figure(figsize=(7, 4)); plt.plot(hist); plt.yscale("log")
    plt.xlabel("Iteration"); plt.ylabel("MSE (standardised, log scale)")
    plt.title("Neural ODE overfit test on 256 training windows")
    plt.savefig(EVID / "E14_node_overfit.png", dpi=150, bbox_inches="tight")
    log("Overfit test finished. A large, steady drop means the model and training loop work.")
    raise SystemExit(0)

# ------------------------------------------------------------ mode 2: full training
pers_val = eval_loss(va, persistence=True)
log(f"Reference: persistence validation loss = {pers_val:.5f} (the Neural ODE must go below this)\n")

best, bad, hist = np.inf, 0, []
for epoch in range(1, args.epochs + 1):
    t = time.time()
    perm = rng.permutation(len(tr))
    tot, n = 0.0, 0
    for i in range(0, len(perm), args.batch):
        z0, U, s, Y = get_batch(arr, tr[perm[i:i + args.batch]])
        opt.zero_grad()
        loss = mse(model(z0, U, s), Y)
        if not torch.isfinite(loss):
            raise SystemExit("ERROR: loss became NaN/inf. Rerun with a lower learning rate, e.g. --lr 0.0005")
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        tot += loss.item() * len(Y); n += len(Y)
    tr_loss, va_loss = tot / n, eval_loss(va)
    improved = va_loss < best - 1e-5
    if improved:
        best, bad = va_loss, 0
        torch.save(model.state_dict(), MODELS / "node_best.pt")
    else:
        bad += 1
    hist.append({"epoch": epoch, "train_loss": tr_loss, "val_loss": va_loss})
    log(f"epoch {epoch:3d} | train {tr_loss:.5f} | val {va_loss:.5f} | {time.time() - t:4.0f}s"
        f"{'  * best' if improved else ''}")
    if bad >= args.patience:
        log(f"Early stopping: no validation improvement for {args.patience} epochs.")
        break

log(f"\nBest validation loss: {best:.5f} | persistence: {pers_val:.5f} | "
    f"improvement: {100 * (1 - best / pers_val):.1f}%")

# ------------------------------------------------------------ save history, plot, config
h = pd.DataFrame(hist)
h.to_csv(RES / "node_training_history.csv", index=False)
plt.figure(figsize=(8, 4.5))
plt.plot(h["epoch"], h["train_loss"], marker="o", label="Train")
plt.plot(h["epoch"], h["val_loss"], marker="o", label="Validation")
plt.axhline(pers_val, color="grey", ls="--", label="Persistence (validation)")
plt.xlabel("Epoch"); plt.ylabel("MSE (standardised)"); plt.legend()
plt.title("Neural ODE training curve")
plt.savefig(EVID / "E16_node_loss_curve.png", dpi=150, bbox_inches="tight")
plt.close()

(Path("experiments") / "node_config.json").write_text(json.dumps({
    "equation": "dz/dt = f_theta(z, u(t), s); fixed-step RK4, 1 day per step",
    "state": ["no3", "po4", "si"], "forcing_cols": FORCING_COLS, "static_cols": STATIC_COLS,
    "hidden": args.hidden, "substeps": args.substeps, "lr": args.lr, "batch": args.batch,
    "max_epochs": args.epochs, "patience": args.patience, "epochs_run": len(h),
    "n_params": n_params, "seed": SEED, "best_val_loss": best, "persistence_val_loss": pers_val,
    "scaling": "standardised with train-split statistics only"}, indent=2))
log("Saved: experiments/models/node_best.pt, node_config.json, training history, E16 plot")
log("Step 08 completed successfully.")