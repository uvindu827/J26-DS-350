"""
Supplementary PP1 robustness check.

Purpose:
- Re-run only the selected process-feature tree baselines:
  RF_B_process and XGB_B_process
- Seeds: 42, 7, 2026
- Same train / validation / test data
- Same hyperparameters as Step 07
- Only random seed changes
- Does NOT overwrite existing models, predictions, evidence, or app assets.

Outputs:
  outputs/robustness_check/tree_seed_per_run.csv
  outputs/robustness_check/tree_seed_summary.csv
"""

from pathlib import Path
import time

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from xgboost import XGBRegressor

from common import (
    NUTRIENTS,
    FEATURE_SETS,
    T0_COLS,
    TARGET_COLS,
    STATE_INPUTS,
    load_dataset,
    make_samples,
)


SEEDS = [42, 7, 2026]

OUT = Path("outputs/robustness_check")
OUT.mkdir(parents=True, exist_ok=True)


# ------------------------------------------------------------
# 1. Load exactly the same dataset and forecast samples
# ------------------------------------------------------------

print("\nLoading dataset...")
df = load_dataset()
s = make_samples(df)

train = s[s["split"] == "train"].reset_index(drop=True)
ev = s[s["split"].isin(["val", "test"])].reset_index(drop=True)

val_mask = (ev["split"] == "val").to_numpy()
test_mask = (ev["split"] == "test").to_numpy()

# Same target used in Step 07:
# predict CHANGE from issue-day nutrient value
y_tr = (
    train[TARGET_COLS].to_numpy()
    - train[T0_COLS].to_numpy()
)

y_ev = (
    ev[TARGET_COLS].to_numpy()
    - ev[T0_COLS].to_numpy()
)


# ------------------------------------------------------------
# 2. Use only Feature Set B - the selected process feature set
# ------------------------------------------------------------

feats = FEATURE_SETS["B_process"]
cols = STATE_INPUTS + feats

X_tr = train[cols].to_numpy(np.float32)
X_ev = ev[cols].to_numpy(np.float32)

true_test = ev.loc[test_mask, TARGET_COLS].to_numpy()
t0_test = ev.loc[test_mask, T0_COLS].to_numpy()


print(f"Training rows: {len(train):,}")
print(f"Validation + test rows: {len(ev):,}")
print(f"Feature inputs: {len(cols)}")
print(f"Seeds: {SEEDS}")


# ------------------------------------------------------------
# 3. Same parameters as Step 07
# ------------------------------------------------------------

RF_BASE = dict(
    n_estimators=200,
    min_samples_leaf=5,
    max_features=0.5,
    max_samples=0.3,
    n_jobs=-1,
)

XGB_BASE = dict(
    n_estimators=2000,
    learning_rate=0.05,
    max_depth=8,
    min_child_weight=5,
    subsample=0.8,
    colsample_bytree=0.8,
    tree_method="hist",
    early_stopping_rounds=50,
    eval_metric="rmse",
    n_jobs=-1,
)


rows = []


def score_predictions(model_name, seed, delta_pred):
    """
    Convert predicted change back to concentration,
    clip at zero exactly like Step 07,
    then calculate test RMSE and MAE.
    """

    pred_test = np.clip(
        t0_test + delta_pred[test_mask],
        0,
        None,
    )

    for i, nutrient in enumerate(NUTRIENTS):
        error = pred_test[:, i] - true_test[:, i]

        rmse = float(np.sqrt(np.mean(error ** 2)))
        mae = float(np.mean(np.abs(error)))

        rows.append(
            {
                "model": model_name,
                "seed": seed,
                "nutrient": nutrient,
                "rmse": rmse,
                "mae": mae,
            }
        )


# ------------------------------------------------------------
# 4. Train each tree model with 3 seeds
# ------------------------------------------------------------

for seed in SEEDS:

    print("\n" + "=" * 65)
    print(f"SEED {seed}")
    print("=" * 65)

    # ---------------- Random Forest ----------------

    print(f"\nTraining RF_B_process seed {seed}...")
    start = time.time()

    rf = RandomForestRegressor(
        **RF_BASE,
        random_state=seed,
    )

    rf.fit(X_tr, y_tr)

    rf_pred = rf.predict(X_ev)

    print(
        f"RF seed {seed} completed in "
        f"{time.time() - start:.1f} seconds"
    )

    score_predictions(
        "RF_B_process",
        seed,
        rf_pred,
    )

    del rf, rf_pred


    # ---------------- XGBoost ----------------

    print(f"\nTraining XGB_B_process seed {seed}...")
    start = time.time()

    xgb = XGBRegressor(
        **XGB_BASE,
        random_state=seed,
    )

    xgb.fit(
        X_tr,
        y_tr,
        eval_set=[
            (
                X_ev[val_mask],
                y_ev[val_mask],
            )
        ],
        verbose=False,
    )

    xgb_pred = xgb.predict(X_ev)

    print(
        f"XGB seed {seed} completed in "
        f"{time.time() - start:.1f} seconds "
        f"| best iteration = {xgb.best_iteration}"
    )

    score_predictions(
        "XGB_B_process",
        seed,
        xgb_pred,
    )

    del xgb, xgb_pred


# ------------------------------------------------------------
# 5. Per-run results
# ------------------------------------------------------------

per_run = pd.DataFrame(rows)

per_run.to_csv(
    OUT / "tree_seed_per_run.csv",
    index=False,
)


# ------------------------------------------------------------
# 6. Mean +/- standard deviation across seeds
# ------------------------------------------------------------

summary = (
    per_run
    .groupby(["model", "nutrient"])[["rmse", "mae"]]
    .agg(["mean", "std"])
    .reset_index()
)

summary.columns = [
    "_".join(
        str(x)
        for x in col
        if str(x)
    ).rstrip("_")
    if isinstance(col, tuple)
    else col
    for col in summary.columns
]

summary.to_csv(
    OUT / "tree_seed_summary.csv",
    index=False,
)


# ------------------------------------------------------------
# 7. Print clear results
# ------------------------------------------------------------

print("\n\n")
print("=" * 75)
print("PER-RUN TEST RESULTS")
print("=" * 75)

print(
    per_run.to_string(
        index=False,
        float_format=lambda x: f"{x:.6f}",
    )
)


print("\n")
print("=" * 75)
print("MEAN +/- STANDARD DEVIATION ACROSS 3 SEEDS")
print("=" * 75)

for _, r in summary.iterrows():

    print(
        f"{r['model']:15s} "
        f"{str(r['nutrient']).upper():4s} | "
        f"RMSE {r['rmse_mean']:.6f} "
        f"+/- {r['rmse_std']:.6f} | "
        f"MAE {r['mae_mean']:.6f} "
        f"+/- {r['mae_std']:.6f}"
    )


# ------------------------------------------------------------
# 8. Check seed 42 against the original Step 07 results
# ------------------------------------------------------------

original_file = Path(
    "experiments/results/baseline_metrics.csv"
)

if original_file.exists():

    original = pd.read_csv(original_file)

    print("\n")
    print("=" * 75)
    print("SEED 42 REPRODUCTION CHECK AGAINST STEP 07")
    print("=" * 75)

    for model in ["RF_B_process", "XGB_B_process"]:

        for nutrient in NUTRIENTS:

            old = original[
                (original["model"] == model)
                & (original["split"] == "test")
                & (original["subset"] == "All")
                & (original["h"].astype(str) == "all")
                & (original["nutrient"] == nutrient)
            ]

            new = per_run[
                (per_run["model"] == model)
                & (per_run["seed"] == 42)
                & (per_run["nutrient"] == nutrient)
            ]

            if len(old) == 1 and len(new) == 1:

                old_rmse = float(old.iloc[0]["rmse"])
                new_rmse = float(new.iloc[0]["rmse"])

                print(
                    f"{model:15s} "
                    f"{nutrient.upper():4s} | "
                    f"original={old_rmse:.6f} "
                    f"rerun={new_rmse:.6f} "
                    f"diff={abs(old_rmse-new_rmse):.8f}"
                )


print("\nSaved:")
print(
    OUT / "tree_seed_per_run.csv"
)
print(
    OUT / "tree_seed_summary.csv"
)

print("\nSupplementary tree-seed robustness check completed.")