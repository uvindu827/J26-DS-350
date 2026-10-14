"""
Step 08 - Train a sequence model with ONE shared procedure (fair comparison).

  --model node : simplified multi-nutrient Neural ODE (proposed model)
  --model lstm : LSTM-B discrete-time control (same inputs, same training procedure)

  python scripts/08_train_neural_ode.py --model node --overfit
  python scripts/08_train_neural_ode.py --model lstm --overfit
  python scripts/08_train_neural_ode.py --model lstm

Train split for learning; validation only for early stopping; test NOT touched here.
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
from node_model import build_model, prepare_arrays, windows, get_batch, FORCING_COLS, STATIC_COLS

p = argparse.ArgumentParser()
p.add_argument("--model", choices=["node", "lstm"], default="node")
p.add_argument("--overfit", action="store_true", help="sanity check: fit 256 training windows only")
p.add_argument("--epochs", type=int, default=40)
p.add_argument("--hidden", type=int, default=None, help="default: 64 for node, 32 for lstm")
p.add_argument("--lr", type=float, default=1e-3)
p.add_argument("--batch", type=int, default=512)
p.add_argument("--patience", type=int, default=6)
p.add_argument("--substeps", type=int, default=1, help="RK4 steps per day (node only)")
p.add_argument("--seed", type=int, default=SEED, help="random seed (42 = original run)")
args = p.parse_args()

LABEL = {"node": "Neural ODE", "lstm": "LSTM-B"}[args.model]
TAGS = {"node": ("E15", "E16"), "lstm": ("E20", "E21")}[args.model]

torch.manual_seed(args.seed)
rng = np.random.default_rng(args.seed)
SUFFIX = "" if args.seed == SEED else f"_s{args.seed}"   # seed 42 keeps the original file names
EVID = Path("evidence/pp1")
RES = Path("experiments/results"); RES.mkdir(parents=True, exist_ok=True)
MODELS = Path("experiments/models"); MODELS.mkdir(parents=True, exist_ok=True)
log_name = f"E14_{args.model}_overfit" if args.overfit else f"{TAGS[0]}_{args.model}{SUFFIX}_training"
LOG_FILE = EVID / f"{log_name}_log.txt"
LOG_FILE.write_text("")

def log(msg=""):
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(str(msg) + "\n")

# ------------------------------------------------------------ data + model
df = load_dataset()
arr = prepare_arrays(df)
tr, va = windows(arr, "train"), windows(arr, "val")
log(f"Model: {LABEL} | seed: {args.seed}")
log(f"Training windows: {len(tr):,} | validation windows: {len(va):,}")
log(f"Inputs: state 3 | forcing {len(FORCING_COLS)} | static {len(STATIC_COLS)}")

model = build_model(args.model, len(FORCING_COLS), len(STATIC_COLS), args.hidden, args.substeps)
hidden = args.hidden or (64 if args.model == "node" else 32)
n_params = sum(q.numel() for q in model.parameters())
log(f"{LABEL} parameters: {n_params:,} | hidden={hidden}")
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
    plt.title(f"{LABEL} overfit test on 256 training windows")
    plt.savefig(EVID / f"E14_{args.model}_overfit.png", dpi=150, bbox_inches="tight")
    plt.close()
    log("Overfit test finished. A large, steady drop means the model and training loop work.")
    raise SystemExit(0)

# ------------------------------------------------------------ mode 2: full training
pers_val = eval_loss(va, persistence=True)
log(f"Reference: persistence validation loss = {pers_val:.5f}\n")

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
        torch.save(model.state_dict(), MODELS / f"{args.model}{SUFFIX}_best.pt")
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
h.to_csv(RES / f"{args.model}{SUFFIX}_training_history.csv", index=False)
plt.figure(figsize=(8, 4.5))
plt.plot(h["epoch"], h["train_loss"], marker="o", label="Train")
plt.plot(h["epoch"], h["val_loss"], marker="o", label="Validation")
plt.axhline(pers_val, color="grey", ls="--", label="Persistence (validation)")
plt.xlabel("Epoch"); plt.ylabel("MSE (standardised)"); plt.legend()
plt.title(f"{LABEL} training curve")
if SUFFIX:
    curve = f"{TAGS[1]}_{args.model}{SUFFIX}_loss_curve.png"
else:
    curve = "E16_node_loss_curve.png" if args.model == "node" else f"{TAGS[1]}_{args.model}_loss_curve.png"
plt.savefig(EVID / curve, dpi=150, bbox_inches="tight")
plt.close()

(Path("experiments") / f"{args.model}{SUFFIX}_config.json").write_text(json.dumps({
    "model": args.model,
    "description": {"node": "dz/dt = f_theta(z, u(t), s); fixed-step RK4, 1 day per step",
                    "lstm": "LSTM-B: h0,c0 from [z0,s]; one LSTMCell step per day on [u(t), s]; "
                            "output z0 + head(h)"}[args.model],
    "state": ["no3", "po4", "si"], "forcing_cols": FORCING_COLS, "static_cols": STATIC_COLS,
    "hidden": hidden, "substeps": args.substeps, "lr": args.lr, "batch": args.batch,
    "max_epochs": args.epochs, "patience": args.patience, "epochs_run": len(h),
    "n_params": n_params, "seed": args.seed, "best_val_loss": best, "persistence_val_loss": pers_val,
    "scaling": "standardised with train-split statistics only"}, indent=2))
log(f"Saved: experiments/models/{args.model}{SUFFIX}_best.pt, {args.model}{SUFFIX}_config.json, history, {curve}")
log("Step 08 completed successfully.")