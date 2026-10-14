"""
Step 14 - Validate the Component 1 API: every endpoint, error handling, and that the API returns
exactly the service output. Saves the OpenAPI contract for the frontend developer.
"""
import sys
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from fastapi.testclient import TestClient  # noqa: E402
from api.main import app  # noqa: E402
from api.c1_router import svc  # noqa: E402

EVID = ROOT / "evidence/pp1"
LOG_FILE = EVID / "E30_api_check_log.txt"
LOG_FILE.write_text("")

def log(msg=""):
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(str(msg) + "\n")

CASE = {"cell": "N6.75_E79.75", "issue": "2024-05-15"}
checks = {}
with TestClient(app) as client:
    for path in ["/c1/health", "/c1/meta", "/c1/cells", "/c1/geo", "/c1/reliability",
                 "/c1/climatology?region=Western"]:
        checks[f"GET {path} -> 200"] = client.get(path).status_code == 200

    r = client.get("/c1/forecast", params={**CASE, "benchmark": "true"})
    direct = json.loads(json.dumps(svc().forecast(CASE["cell"], CASE["issue"], benchmark=True)))
    checks["GET /c1/forecast -> 200"] = r.status_code == 200
    checks["API forecast identical to service forecast"] = r.json() == direct

    r = client.get("/c1/outlook", params={"issue": CASE["issue"], "nutrient": "no3", "lead": 7})
    checks["GET /c1/outlook -> 12 cells"] = r.status_code == 200 and len(r.json()["cells"]) == 12
    (EVID / "E30_api_outlook_sample.json").write_text(json.dumps(r.json(), indent=2, ensure_ascii=False),
                                                      encoding="utf-8")

    r = client.get("/c1/forecast.csv", params=CASE)
    checks["GET /c1/forecast.csv -> CSV with 21 rows"] = (
        r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
        and len(r.text.strip().splitlines()) == 22)

    checks["training-period date -> 400"] = client.get(
        "/c1/forecast", params={"cell": CASE["cell"], "issue": "2015-06-01"}).status_code == 400
    checks["unknown cell -> 400"] = client.get(
        "/c1/forecast", params={"cell": "XYZ", "issue": CASE["issue"]}).status_code == 400
    checks["lead day 9 -> 422 (validation)"] = client.get(
        "/c1/outlook", params={"issue": CASE["issue"], "lead": 9}).status_code == 422

    spec = client.get("/openapi.json").json()
    (ROOT / "docs/c1_api_openapi.json").write_text(json.dumps(spec, indent=2), encoding="utf-8")
    log(f"Endpoints in contract: {sorted(spec['paths'])}")

for name, ok in checks.items():
    log(f"  [{'PASS' if ok else 'FAIL'}] {name}")
if not all(checks.values()):
    raise SystemExit("ERROR: API check failed.")
log("Saved docs/c1_api_openapi.json and E30_api_outlook_sample.json")
log("Step 14 completed successfully.")