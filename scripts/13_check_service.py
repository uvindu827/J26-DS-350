"""
Step 13 - Validate the Component 1 service against the evaluated/exported forecasts.
"""
import sys
import json
import time
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from c1_service.forecast_service import C1Service  # noqa: E402

EVID = ROOT / "evidence/pp1"
LOG_FILE = EVID / "E29_service_check_log.txt"
LOG_FILE.write_text("")

def log(msg=""):
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(str(msg) + "\n")

t = time.time()
svc = C1Service()
log(f"Service loaded in {time.time() - t:.1f} s | model {svc.model_name}")

CELL, ISSUE = "N6.75_E79.75", "2024-05-15"
t = time.time()
fc = svc.forecast(CELL, ISSUE, benchmark=True)
log(f"Forecast {CELL} issued {ISSUE} in {time.time() - t:.2f} s | season {fc['season']}")
checks = {}

exp = pd.read_csv(ROOT / "outputs/c1_to_c2/c1_nutrient_forecasts_test_2022_2025.csv")
e = exp[(exp["cell_id"] == CELL) & (exp["issue_date"] == ISSUE)].sort_values("lead_time_days")
checks["export file has this case (7 lead days)"] = len(e) == 7
checks["same model run as export"] = bool((e["model_name"] == svc.model_name).all())
for v in ["no3", "po4", "si"]:
    d_fc = np.max(np.abs(np.array(fc["nutrients"][v]["forecast"]) - e[v].to_numpy()))
    d_ac = np.max(np.abs(np.array(fc["nutrients"][v]["actual"]) - e[f"{v}_copernicus"].to_numpy()))
    checks[f"{v} forecast equals exported forecast (max diff {d_fc:.2e})"] = d_fc < 1e-4
    checks[f"{v} actual equals Copernicus reference (max diff {d_ac:.2e})"] = d_ac < 1e-4

ol = svc.outlook(ISSUE, "no3", 7)
checks["outlook returns all 12 cells"] = len(ol["cells"]) == 12
checks["outlook labels valid"] = all(c["status"] in {"below", "normal", "above"} and
                                     c["trend"] in {"falling", "stable", "rising"} for c in ol["cells"])
try:
    svc.forecast(CELL, "2015-06-01")
    checks["training-period date refused"] = False
except ValueError:
    checks["training-period date refused"] = True

for name, ok in checks.items():
    log(f"  [{'PASS' if ok else 'FAIL'}] {name}")

n = fc["nutrients"]["no3"]
log(f"\nNO3 issue {n['issue_value']} ({n['issue_status']}) -> day 7 {n['forecast'][-1]} "
    f"({n['trend'][-1]}, {n['status'][-1]}) | actual {n['actual'][-1]} | benchmark {n['benchmark'][-1]}")
log("Outlook NO3 day 7: " + ", ".join(f"{c['cell_id']}={c['status']}/{c['trend']}" for c in ol["cells"]))

(EVID / "E29_service_forecast_sample.json").write_text(json.dumps(fc, indent=2, ensure_ascii=False), encoding="utf-8")
if not all(checks.values()):
    raise SystemExit("ERROR: service check failed.")
log("Step 13 completed successfully.")