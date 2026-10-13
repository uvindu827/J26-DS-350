"""
Simplified multi-nutrient Neural ODE:   dz/dt = f_theta(z(t), u(t), s)
  z : nutrient state [NO3, PO4, Si] (standardised)
  u : daily forcing  = same dynamic inputs as feature set B (FORCING_RAW + PROCESS_FEATURES)
  s : static inputs  = same static inputs as feature set B (STATIC_RAW + STATIC_PROCESS)
Integrated with a fixed-step 4th-order Runge-Kutta (RK4) solver, one day per step.
"""
import numpy as np
import torch
import torch.nn as nn

from common import NUTRIENTS, HORIZON, FORCING_RAW, PROCESS_FEATURES, STATIC_RAW, STATIC_PROCESS

FORCING_COLS = FORCING_RAW + PROCESS_FEATURES   # 19 dynamic inputs
STATIC_COLS = STATIC_RAW + STATIC_PROCESS       # 6 static inputs


# ------------------------------------------------------------------ model
class ODEFunc(nn.Module):
    """f_theta: the learned rate of change of the nutrient state."""
    def __init__(self, n_state, n_forcing, n_static, hidden=64):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_state + n_forcing + n_static, hidden), nn.Tanh(),
            nn.Linear(hidden, hidden), nn.Tanh(),
            nn.Linear(hidden, n_state),
        )
        with torch.no_grad():  # start near dz/dt = 0 (persistence); learn departures from it
            self.net[-1].weight.mul_(0.1)
            self.net[-1].bias.zero_()

    def forward(self, z, u, s):
        return self.net(torch.cat([z, u, s], dim=-1))


class NeuralODE(nn.Module):
    """Integrates dz/dt = f(z, u, s) with fixed-step RK4.
    Forcing for day t0+i+1 drives the step t0+i -> t0+i+1 (held constant within the day)."""
    def __init__(self, n_forcing, n_static, hidden=64, substeps=1):
        super().__init__()
        self.f = ODEFunc(len(NUTRIENTS), n_forcing, n_static, hidden)
        self.substeps = substeps

    def forward(self, z0, U, s):
        # z0: (B, 3) state at t0 | U: (B, H, F) forcing for days t0+1..t0+H | s: (B, S)
        z, out, dt = z0, [], 1.0 / self.substeps
        for i in range(U.shape[1]):
            u = U[:, i]
            for _ in range(self.substeps):
                k1 = self.f(z, u, s)
                k2 = self.f(z + 0.5 * dt * k1, u, s)
                k3 = self.f(z + 0.5 * dt * k2, u, s)
                k4 = self.f(z + dt * k3, u, s)
                z = z + dt * (k1 + 2 * k2 + 2 * k3 + k4) / 6.0
            out.append(z)
        return torch.stack(out, dim=1)  # (B, H, 3) trajectory for days t0+1..t0+H


# ------------------------------------------------------------------ data
def prepare_arrays(df):
    """Reshape the complete dataset into arrays (cell, day, variable) and standardise
    using TRAIN-split statistics only."""
    df = df.sort_values(["cell_id", "date"]).reset_index(drop=True)
    cells = sorted(df["cell_id"].astype(str).unique())
    dates = np.array(sorted(df["date"].unique()), dtype="datetime64[ns]")
    C, T = len(cells), len(dates)
    if len(df) != C * T:
        raise SystemExit("ERROR: dataset is not a complete cell x day grid.")

    Z = df[NUTRIENTS].to_numpy(np.float32).reshape(C, T, -1)
    U = df[FORCING_COLS].to_numpy(np.float32).reshape(C, T, -1)
    S = df.groupby("cell_id")[STATIC_COLS].first().loc[cells].to_numpy(np.float32)
    split = df["split"].to_numpy(dtype=str).reshape(C, T)[0]   # identical for every cell
    train = split == "train"

    def mean_std(x):
        m, sd = x.mean(0).astype(np.float32), x.std(0).astype(np.float32)
        sd[sd == 0] = 1.0
        return m, sd

    z_mean, z_std = mean_std(Z[:, train].reshape(-1, Z.shape[-1]))
    u_mean, u_std = mean_std(U[:, train].reshape(-1, U.shape[-1]))
    s_mean, s_std = mean_std(S)
    return {
        "cells": cells, "dates": dates, "split": split, "Z_raw": Z,
        "Z": (Z - z_mean) / z_std, "U": (U - u_mean) / u_std, "S": (S - s_mean) / s_std,
        "stats": {"z_mean": z_mean, "z_std": z_std, "u_mean": u_mean, "u_std": u_std,
                  "s_mean": s_mean, "s_std": s_std},
    }


def windows(arr, name, horizon=HORIZON):
    """(cell, t0) pairs whose whole 7-day window stays inside one split."""
    split = arr["split"]
    ts = [t for t in range(len(split) - horizon) if split[t] == name and split[t + horizon] == name]
    return np.array([(c, t) for c in range(arr["Z"].shape[0]) for t in ts], dtype=np.int64)


def get_batch(arr, idx, horizon=HORIZON):
    c, t = idx[:, 0], idx[:, 1]
    steps = t[:, None] + np.arange(1, horizon + 1)[None, :]
    z0 = arr["Z"][c, t]                    # (B, 3)
    U = arr["U"][c[:, None], steps]        # (B, H, F)
    Y = arr["Z"][c[:, None], steps]        # (B, H, 3)
    s = arr["S"][c]                        # (B, S)
    return (torch.from_numpy(z0), torch.from_numpy(U), torch.from_numpy(s), torch.from_numpy(Y))