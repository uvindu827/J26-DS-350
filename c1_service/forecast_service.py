"""
Component 1 forecast service (read-only). The single Python layer behind every frontend:
FastAPI for React Native / web, or a direct import for Streamlit.
Loads saved data, models and UI assets; never trains, tunes or writes files.
"""
import sys
import json
from pathlib import Path
import numpy as np
import pandas as pd
import torch
from xgboost import XGBRegressor

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from common import NUTRIENTS, HORIZON, STATE_INPUTS, FEATURE_SETS, SEED  # noqa: E402
from node_model import build_model, prepare_arrays, get_batch, FORCING_COLS, STATIC_COLS  # noqa: E402

UNIT = "mmol m-3"
SEASON_OF_MONTH = {12: "NEM", 1: "NEM", 2: "NEM", 3: "FIM", 4: "FIM",
                   5: "SWM", 6: "SWM", 7: "SWM", 8: "SWM", 9: "SWM", 10: "SIM", 11: "SIM"}
SEASON_NAME = {"NEM": "Northeast Monsoon", "FIM": "First Inter-Monsoon",
               "SWM": "Southwest Monsoon", "SIM": "Second Inter-Monsoon"}
SEASON_START_MONTH = {"NEM": 12, "FIM": 3, "SWM": 5, "SIM": 10}
SEASON_LENGTH_MONTHS = {"NEM": 3, "FIM": 2, "SWM": 5, "SIM": 2}


def _r(x, nd=5):
    return round(float(x), nd)


def _iso(d):
    return pd.Timestamp(d).strftime("%Y-%m-%d")


class C1Service:
    def __init__(self, root=ROOT):
        self.root = Path(root)
        A = self.root / "app_assets"
        self.cells = json.loads((A / "cells.json").read_text(encoding="utf-8"))
        self.cell_by_id = {c["cell_id"]: c for c in self.cells}
        self.normals = pd.read_parquet(A / "normals.parquet").set_index(["cell_id", "month", "nutrient"])
        self.change = pd.read_parquet(A / "change_scale.parquet").set_index(["cell_id", "nutrient", "h"])
        self.clim = json.loads((A / "climatology.json").read_text(encoding="utf-8"))
        self.rel = json.loads((A / "reliability.json").read_text(encoding="utf-8"))
        self.manifest = json.loads((A / "manifest.json").read_text(encoding="utf-8"))
        self.issue_min = pd.Timestamp(self.manifest["issue_dates"]["first"])
        self.issue_max = pd.Timestamp(self.manifest["issue_dates"]["last"])

        df = pd.read_parquet(self.root / "data/processed/model_dataset_daily.parquet")
        for c in ["cell_id", "region", "split"]:
            df[c] = df[c].astype(str)
        df["date"] = pd.to_datetime(df["date"])
        self.df = df.sort_values(["cell_id", "date"]).reset_index(drop=True)
        self.by_cell = {cid: g.set_index("date") for cid, g in self.df.groupby("cell_id")}
        self.arr = prepare_arrays(self.df)            # train-only scaling, same as evaluation
        self.dates = pd.DatetimeIndex(self.arr["dates"])
        self.z_mean, self.z_std = self.arr["stats"]["z_mean"], self.arr["stats"]["z_std"]

        seed = self.manifest["neural_ode"]["seed"]
        suf = "" if seed == SEED else f"_s{seed}"
        cfg = json.loads((self.root / f"experiments/node{suf}_config.json").read_text())
        self.node = build_model("node", len(FORCING_COLS), len(STATIC_COLS), cfg["hidden"], cfg.get("substeps", 1))
        self.node.load_state_dict(torch.load(self.root / f"experiments/models/node{suf}_best.pt", map_location="cpu"))
        self.node.eval()
        self.model_name = f"NeuralODE_s{seed}"
        self.xgb = XGBRegressor()
        self.xgb.load_model(str(self.root / "experiments/models/xgb_B_process.json"))

    # ------------------------------------------------------------ helpers
    def _issue(self, issue_date):
        t0 = pd.Timestamp(issue_date).normalize()
        if not (self.issue_min <= t0 <= self.issue_max):
            raise ValueError(f"Issue date must be between {_iso(self.issue_min)} and {_iso(self.issue_max)} "
                             "(replay mode covers the validated 2022-2025 test period).")
        return t0

    def _cell(self, cell_id):
        if cell_id not in self.cell_by_id:
            raise ValueError(f"Unknown cell_id {cell_id}.")
        return self.cell_by_id[cell_id]

    def _node(self, pairs):
        z0, U, s, _ = get_batch(self.arr, np.array(pairs, dtype=np.int64))
        with torch.no_grad():
            P = self.node(z0, U, s).numpy()
        return np.clip(P * self.z_std + self.z_mean, 0, None)          # (B, 7, 3) in mmol m-3

    def _xgb(self, cell_id, t0):
        g = self.by_cell[cell_id]
        feats = FEATURE_SETS["B_process"]
        rows = []
        for h in range(1, HORIZON + 1):
            r = g.loc[t0 + pd.Timedelta(days=h)]
            x = {f"{v}_t0": g.loc[t0, v] for v in NUTRIENTS}
            x["h"] = h
            x.update({c: r[c] for c in feats})
            rows.append(x)
        X = pd.DataFrame(rows)[STATE_INPUTS + feats].to_numpy(np.float32)
        return np.clip(g.loc[t0, NUTRIENTS].to_numpy(float) + self.xgb.predict(X), 0, None)

    def _status(self, cell_id, date, nutrient, value):
        n = self.normals.loc[(cell_id, pd.Timestamp(date).month, nutrient)]
        return "below" if value < n["p25"] else ("above" if value > n["p75"] else "normal")

    def _trend(self, cell_id, nutrient, h, delta):
        thr = self.change.loc[(cell_id, nutrient, h), "stable_threshold"]
        return "stable" if abs(delta) < thr else ("rising" if delta > 0 else "falling")

    def _season(self, date):
        d = pd.Timestamp(date)
        code = SEASON_OF_MONTH[d.month]
        sm = SEASON_START_MONTH[code]
        year = d.year if d.month >= sm else d.year - 1
        start = pd.Timestamp(year=year, month=sm, day=1)
        end = start + pd.DateOffset(months=SEASON_LENGTH_MONTHS[code]) - pd.Timedelta(days=1)
        return {"code": code, "name": SEASON_NAME[code],
                "day": int((d - start).days + 1), "length": int((end - start).days + 1)}

    # ------------------------------------------------------------ public API
    def meta(self):
        return {"component": "C1 Coastal Nutrients", "mode": self.manifest["mode"], "model": self.model_name,
                "issue_dates": self.manifest["issue_dates"], "nutrients": NUTRIENTS, "unit": UNIT,
                "horizon_days": HORIZON, "normals_period": self.manifest["normals_period"]}

    def list_cells(self):
        return self.cells

    def forecast(self, cell_id, issue_date, benchmark=False):
        cell = self._cell(cell_id)
        t0 = self._issue(issue_date)
        c = self.arr["cells"].index(cell_id)
        t = int(self.dates.get_loc(t0))
        P = self._node([[c, t]])[0]
        B = self._xgb(cell_id, t0) if benchmark else None
        g = self.by_cell[cell_id]
        lead_dates = [t0 + pd.Timedelta(days=h) for h in range(1, HORIZON + 1)]
        hist = g.loc[t0 - pd.Timedelta(days=14): t0]

        nutrients = {}
        for k, v in enumerate(NUTRIENTS):
            iv = float(g.loc[t0, v])
            fc = [float(x) for x in P[:, k]]
            n0 = self.normals.loc[(cell_id, t0.month, v)]
            nutrients[v] = {
                "unit": UNIT,
                "issue_value": _r(iv),
                "issue_status": self._status(cell_id, t0, v, iv),
                "normal_issue_month": {"p25": _r(n0["p25"]), "p50": _r(n0["p50"]), "p75": _r(n0["p75"])},
                "history": [{"date": _iso(d), "value": _r(x)} for d, x in hist[v].items()],
                "forecast": [_r(x) for x in fc],
                "typical_error": self.rel["nutrients"][v]["rmse_by_lead"],
                "status": [self._status(cell_id, d, v, x) for d, x in zip(lead_dates, fc)],
                "trend": [self._trend(cell_id, v, h, x - iv) for h, x in enumerate(fc, start=1)],
                "actual": [_r(g.loc[d, v]) for d in lead_dates],
                "benchmark": [_r(x) for x in B[:, k]] if benchmark else None,
                "no_change": _r(iv),
            }

        win = g.loc[t0 - pd.Timedelta(days=14): t0 + pd.Timedelta(days=HORIZON)]
        drivers = {
            "dates": [_iso(d) for d in win.index],
            "precip_mm": [_r(x, 2) for x in win["precip_mm"]],
            "surface_runoff_mm": [_r(x, 3) for x in win["surface_runoff_mm"]],
            "subsurface_runoff_mm": [_r(x, 3) for x in win["subsurface_runoff_mm"]],
            "soil_moisture": [_r(x, 3) for x in win["soil_moisture"]],
            "wind_speed": [_r(x, 2) for x in win["wind_speed"]],
            "wind_dir_from_deg": [round(float((270 - np.degrees(np.arctan2(v, u))) % 360))
                                  for u, v in zip(win["u10"], win["v10"])],
            "precip_sum_30d_at_issue": _r(g.loc[t0, "precip_sum_30d"], 1),
            "source": "ERA5-Land / ERA5 reanalysis (observed). In live mode the 7 days ahead would come from weather forecasts.",
        }
        return {"cell": cell, "issue_date": _iso(t0), "mode": "replay", "model": self.model_name,
                "season": self._season(t0), "lead_dates": [_iso(d) for d in lead_dates],
                "nutrients": nutrients, "drivers": drivers}

    def outlook(self, issue_date, nutrient="no3", lead=7):
        t0 = self._issue(issue_date)
        if nutrient not in NUTRIENTS or not (1 <= int(lead) <= HORIZON):
            raise ValueError("nutrient must be no3/po4/si and lead 1-7.")
        lead = int(lead)
        k = NUTRIENTS.index(nutrient)
        t = int(self.dates.get_loc(t0))
        P = self._node([[c, t] for c in range(len(self.arr["cells"]))])
        target = t0 + pd.Timedelta(days=lead)
        cells = []
        for i, cid in enumerate(self.arr["cells"]):
            iv = float(self.by_cell[cid].loc[t0, nutrient])
            fc = float(P[i, lead - 1, k])
            info = self.cell_by_id[cid]
            cells.append({"cell_id": cid, "name": info["name"], "region": info["region"],
                          "lat": info["lat"], "lon": info["lon"],
                          "issue_value": _r(iv), "forecast_value": _r(fc), "change": _r(fc - iv),
                          "status": self._status(cid, target, nutrient, fc),
                          "trend": self._trend(cid, nutrient, lead, fc - iv)})
        summary = {}
        for reg in ["Western", "Southern"]:
            sub = [c for c in cells if c["region"] == reg]
            summary[reg] = {"cells": len(sub),
                            "status_counts": {s: sum(c["status"] == s for c in sub) for s in ["below", "normal", "above"]},
                            "trend_counts": {s: sum(c["trend"] == s for c in sub) for s in ["falling", "stable", "rising"]}}
        return {"issue_date": _iso(t0), "target_date": _iso(target), "lead": lead, "nutrient": nutrient,
                "unit": UNIT, "season": self._season(t0), "cells": cells, "regions": summary}

    def climatology(self, region=None, cell_id=None):
        if cell_id:
            self._cell(cell_id)
            return {"period": self.clim["period"], "cell_id": cell_id, "months": self.clim["by_cell"][cell_id]}
        if region:
            return {"period": self.clim["period"], "region": region, "months": self.clim["by_region"][region]}
        return self.clim

    def reliability(self):
        return self.rel