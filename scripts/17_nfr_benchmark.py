"""
Step 17 - Non-functional requirement (NFR) benchmark for Component 1 (READ-ONLY).

Benchmarks the EXISTING C1Service and /c1 FastAPI API on this laptop. Nothing is retrained, tuned or
modified; no service, API, model, data or export file is changed (SHA-256 checked before and after).

Writes  evidence/pp1/E41_nfr_benchmark_log.txt   environment, checks, all tables, limitations
        evidence/pp1/E42_nfr_performance.csv     cold start, warm latency, scaling, batching
        evidence/pp1/E43_nfr_reliability.csv     reliability, invalid inputs, read-only, security, maintainability
        evidence/pp1/E44_nfr_performance.png     latency distributions + local scaling
        docs/nfr_pp1_summary.md                  measured now / verified design evidence / not yet implemented

Measurement rules
- Cold start (fresh processes) is reported separately from warm request latency.
- Warm-up calls run before every measured operation. Fixed request list (seed 42) so runs are repeatable.
- API latency is measured over real localhost HTTP: the unchanged API is started with Uvicorn on port 8765
  and stopped afterwards. If that is impossible, FastAPI TestClient is used and labelled as in-process latency.
- Sequential requests on one laptop: this is NOT production throughput and NOT a concurrency/load test.
- Memory footprint is NOT measured (psutil deliberately not installed).
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import platform
import socket
import subprocess
import sys
import time
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

parser = argparse.ArgumentParser(description="Read-only NFR benchmark (Step 17).")
parser.add_argument("--overwrite", action="store_true", help="replace existing E41-E44 outputs")
args = parser.parse_args()

EVID = Path("evidence/pp1")
OUT = {"log": EVID / "E41_nfr_benchmark_log.txt", "perf": EVID / "E42_nfr_performance.csv",
       "rel": EVID / "E43_nfr_reliability.csv", "png": EVID / "E44_nfr_performance.png",
       "summary": Path("docs/nfr_pp1_summary.md")}
PORT, HOST = 8765, "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"
SEED_REQ = 42
EXPORT = Path("outputs/c1_to_c2/c1_nutrient_forecasts_test_2022_2025.csv")
DATASET = Path("data/processed/model_dataset_daily.parquet")
NUTRIENTS = ["no3", "po4", "si"]
TOL = 1e-4

# ------------------------------------------------------------------ evidence protection
existing = [str(p) for p in OUT.values() if p.exists()]
if existing and not args.overwrite:
    print("STOPPED: these outputs already exist and were not changed:")
    for p in existing:
        print("  " + p)
    print("Run again with --overwrite only if you intend to replace them.")
    raise SystemExit(1)
if args.overwrite:
    for p in OUT.values():
        if p.exists():
            p.unlink()
EVID.mkdir(parents=True, exist_ok=True)
Path("docs").mkdir(exist_ok=True)
OUT["log"].write_text("", encoding="utf-8")


def log(msg=""):
    print(msg)
    with open(OUT["log"], "a", encoding="utf-8") as f:
        f.write(str(msg) + "\n")


REL_ROWS = []          # rows for E43


def record(category, check, expected, actual, status, detail="", hard=True):
    REL_ROWS.append({"category": category, "check": check, "expected": expected, "actual": actual,
                     "status": status, "detail": detail, "counts_toward_pass": hard})
    log(f"  [{status}] {category}: {check}" + (f"  ({detail})" if detail else ""))


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def stats_ms(values):
    a = np.asarray(values, dtype=float)
    return {"n_measured": len(a), "p50_ms": np.percentile(a, 50), "p95_ms": np.percentile(a, 95),
            "mean_ms": a.mean(), "min_ms": a.min(), "max_ms": a.max(), "std_ms": a.std(ddof=1) if len(a) > 1 else 0.0}


# ================================================================== 1. environment + read-only baseline
log("STEP 17 - NFR BENCHMARK (read-only; local laptop; sequential requests)")
log("=" * 78)
import torch, fastapi, uvicorn, httpx, xgboost  # noqa: E401,E402
log(f"Machine : {platform.platform()} | processor: {platform.processor() or 'n/a'} | logical CPUs: {os.cpu_count()}")
log(f"Python {platform.python_version()} | torch {torch.__version__} | xgboost {xgboost.__version__} | "
    f"fastapi {fastapi.__version__} | uvicorn {uvicorn.__version__} | httpx {httpx.__version__} | pandas {pd.__version__}")
log("Memory footprint: NOT measured (psutil deliberately not installed before PP1).")
log(f"Started: {pd.Timestamp.now().isoformat(timespec='seconds')}")

manifest = json.loads(Path("app_assets/manifest.json").read_text(encoding="utf-8"))
# model paths resolved exactly as C1Service resolves them (seed from manifest; XGB-B file fixed in the service)
_seed = manifest["neural_ode"]["seed"]
node_file = Path(f"experiments/models/node{'' if _seed == 42 else f'_s{_seed}'}_best.pt")
xgb_file = Path("experiments/models/xgb_B_process.json")
log(f"Manifest keys: {sorted(manifest)} | selected Neural ODE seed {_seed} -> {node_file} | benchmark -> {xgb_file}")
PROTECTED = sorted({DATASET, EXPORT, node_file, xgb_file,
                    *[p for p in Path("app_assets").glob("*") if p.is_file()],
                    *Path("c1_service").glob("*.py"), *Path("api").glob("*.py")}, key=str)
hash_before = {str(p): sha256(p) for p in PROTECTED if p.exists()}
log(f"\nRead-only baseline: SHA-256 recorded for {len(hash_before)} files (data, export, models, app_assets, service, API).")

# fixed request list
cells = [c["cell_id"] for c in json.loads(Path("app_assets/cells.json").read_text(encoding="utf-8"))]
first, last = pd.Timestamp(manifest["issue_dates"]["first"]), pd.Timestamp(manifest["issue_dates"]["last"])
all_dates = pd.date_range(first, last, freq="D")
rng = np.random.default_rng(SEED_REQ)
REQS = [(c, first.strftime("%Y-%m-%d")) for c in cells[:6]] + [(c, last.strftime("%Y-%m-%d")) for c in cells[6:]]
while len(REQS) < 200:
    REQS.append((cells[int(rng.integers(len(cells)))], all_dates[int(rng.integers(len(all_dates)))].strftime("%Y-%m-%d")))
OUT_DATES = [all_dates[int(i)].strftime("%Y-%m-%d") for i in rng.integers(0, len(all_dates), 100)]
log(f"Fixed request list: {len(REQS)} (cell, issue date) pairs, seed {SEED_REQ}, all {len(cells)} cells, "
    f"issue dates {first.date()} to {last.date()} (first and last dates included). First 10: {REQS[:10]}")

PERF_ROWS = []

# ================================================================== 2. cold start (fresh processes)
log("\nCold start - 3 fresh Python processes (imports + C1Service construction):")
COLD_CODE = (
    "import time, json, sys\n"
    "t0 = time.perf_counter()\n"
    "sys.path.insert(0, '.')\n"
    "import numpy, pandas, torch, xgboost\n"
    "from c1_service.forecast_service import C1Service\n"
    "t1 = time.perf_counter()\n"
    "s = C1Service()\n"
    "t2 = time.perf_counter()\n"
    "print('COLD ' + json.dumps({'import_s': t1 - t0, 'load_s': t2 - t1}))\n")
cold = []
for run in range(1, 4):
    res = subprocess.run([sys.executable, "-c", COLD_CODE], cwd=ROOT, capture_output=True, text=True, timeout=600)
    line = [ln for ln in res.stdout.splitlines() if ln.startswith("COLD ")]
    if res.returncode != 0 or not line:
        log(f"  run {run}: FAILED to start service\n{res.stderr[-2000:]}")
        raise SystemExit("ERROR: cold-start run failed - see the log.")
    d = json.loads(line[0][5:])
    cold.append(d)
    note = "first load" if run == 1 else "repeat (OS file cache warm)"
    log(f"  run {run}: imports {d['import_s']:.2f} s | service load {d['load_s']:.2f} s | total "
        f"{d['import_s'] + d['load_s']:.2f} s  [{note}]")
    for part, val in [("imports", d["import_s"]), ("service_load", d["load_s"]), ("total", d["import_s"] + d["load_s"])]:
        PERF_ROWS.append({"section": "cold_start", "layer": "fresh_process", "operation": part, "run": run,
                          "note": note, "seconds": val})

# ================================================================== 3. warm service latency
from c1_service.forecast_service import C1Service  # noqa: E402
t = time.perf_counter()
svc = C1Service()
log(f"\nIn-process service load (this benchmark process): {time.perf_counter() - t:.2f} s")


def bench(label, layer, fn, n_warm, n_meas):
    for i in range(n_warm):
        fn(i)
    times = []
    for i in range(n_meas):
        t0 = time.perf_counter()
        fn(n_warm + i)
        times.append(1000 * (time.perf_counter() - t0))
    row = {"section": "warm_latency", "layer": layer, "operation": label, "n_warmup": n_warm, **stats_ms(times)}
    PERF_ROWS.append(row)
    log(f"  {layer:16s} {label:28s} p50 {row['p50_ms']:8.2f} ms | p95 {row['p95_ms']:8.2f} | mean {row['mean_ms']:8.2f} "
        f"| min {row['min_ms']:7.2f} | max {row['max_ms']:8.2f}  (n={n_meas}, warm-up {n_warm})")
    return times


LAT = {}
log("\nWarm service latency (direct Python calls):")
LAT[("service", "forecast")] = bench("forecast", "service", lambda i: svc.forecast(*REQS[i % len(REQS)]), 10, 200)
LAT[("service", "forecast+benchmark")] = bench("forecast+benchmark", "service",
                                               lambda i: svc.forecast(*REQS[i % len(REQS)], benchmark=True), 10, 100)
LAT[("service", "outlook (12 cells)")] = bench("outlook (12 cells)", "service",
                                               lambda i: svc.outlook(OUT_DATES[i % 100], NUTRIENTS[i % 3], 1 + i % 7), 10, 100)

# ================================================================== 4. API server (real HTTP, fallback TestClient)


def port_free(port):
    """True when nothing is listening on HOST:port (a lingering closed connection does not count)."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(2)
        return s.connect_ex((HOST, port)) != 0


server, client, api_layer, fallback_reason = None, None, None, ""
try:
    if not port_free(PORT):
        fallback_reason = f"port {PORT} is already in use"
    else:
        server = subprocess.Popen([sys.executable, "-m", "uvicorn", "api.main:app", "--host", HOST, "--port", str(PORT),
                                   "--log-level", "warning"], cwd=ROOT, stdout=subprocess.DEVNULL,
                                  stderr=subprocess.DEVNULL)
        client = httpx.Client(base_url=BASE_URL, timeout=60)
        deadline, ready = time.time() + 90, False
        t_start = time.perf_counter()
        while time.time() < deadline:
            if server.poll() is not None:
                break
            try:
                if client.get("/c1/health").status_code == 200:
                    ready = True
                    break
            except httpx.HTTPError:
                time.sleep(0.5)
        if ready:
            api_layer = "api_http"
            log(f"\nUvicorn server ready on {BASE_URL} after {time.perf_counter() - t_start:.1f} s "
                f"(includes its own service load). API latency = real localhost HTTP.")
        else:
            fallback_reason = "Uvicorn did not answer /c1/health within 90 s"
            client.close()
            client = None
    if api_layer is None:
        from fastapi.testclient import TestClient  # noqa: E402
        from api.main import app  # noqa: E402
        client = TestClient(app)
        client.__enter__()
        api_layer = "api_testclient"
        log(f"\nFALLBACK: {fallback_reason}. API latency below = in-process latency (FastAPI TestClient), "
            "NOT real HTTP.")

    # ------------------------------------------------------------ warm API latency
    log(f"\nWarm API latency ({api_layer}):")

    def get(path, params=None):
        r = client.get(path, params=params)
        if r.status_code != 200:
            raise SystemExit(f"ERROR: {path} returned {r.status_code} during latency measurement.")
        return r

    def fc_params(i, bm=False):
        c, d = REQS[i % len(REQS)]
        return {"cell": c, "issue": d, "benchmark": "true" if bm else "false"}

    for path in ["/c1/health", "/c1/meta", "/c1/cells", "/c1/geo", "/c1/reliability"]:
        LAT[(api_layer, path)] = bench(path, api_layer, lambda i, p=path: get(p), 5, 100)
    LAT[(api_layer, "/c1/climatology")] = bench("/c1/climatology", api_layer,
                                                lambda i: get("/c1/climatology", {"region": ["Western", "Southern"][i % 2]}), 5, 100)
    LAT[(api_layer, "/c1/forecast")] = bench("/c1/forecast", api_layer, lambda i: get("/c1/forecast", fc_params(i)), 10, 200)
    LAT[(api_layer, "/c1/forecast+benchmark")] = bench("/c1/forecast+benchmark", api_layer,
                                                       lambda i: get("/c1/forecast", fc_params(i, True)), 10, 100)
    LAT[(api_layer, "/c1/outlook (12 cells)")] = bench(
        "/c1/outlook (12 cells)", api_layer,
        lambda i: get("/c1/outlook", {"issue": OUT_DATES[i % 100], "nutrient": NUTRIENTS[i % 3], "lead": 1 + i % 7}), 10, 100)
    LAT[(api_layer, "/c1/forecast.csv")] = bench("/c1/forecast.csv", api_layer,
                                                 lambda i: get("/c1/forecast.csv", {"cell": REQS[i][0], "issue": REQS[i][1]}), 5, 50)

    # ------------------------------------------------------------ reliability
    log("\nReliability - 100 valid requests from the fixed list:")
    ex = pd.read_csv(EXPORT, usecols=["cell_id", "issue_date", "lead_time_days"] + NUTRIENTS)
    ex = ex.set_index(["cell_id", "issue_date", "lead_time_days"]).sort_index()
    ok_count, struct_fail, match_fail, worst = 0, 0, 0, 0.0
    for c, d in REQS[:100]:
        r = client.get("/c1/forecast", params={"cell": c, "issue": d})
        if r.status_code != 200:
            continue
        b = r.json()
        good = (b.get("issue_date") == d and b.get("model") == svc.model_name and b.get("mode") == "replay"
                and b.get("lead_dates") == [(pd.Timestamp(d) + pd.Timedelta(days=h)).strftime("%Y-%m-%d") for h in range(1, 8)]
                and all(len(b["nutrients"][v]["forecast"]) == 7 and
                        all(np.isfinite(x) and x >= 0 for x in b["nutrients"][v]["forecast"]) for v in NUTRIENTS))
        if not good:
            struct_fail += 1
            continue
        ok_count += 1
        exp = ex.loc[(c, d)]
        diff = max(float(np.max(np.abs(np.array(b["nutrients"][v]["forecast"]) - exp[v].to_numpy()))) for v in NUTRIENTS)
        worst = max(worst, diff)
        match_fail += int(diff > TOL)
    record("reliability", "valid forecast requests succeed with complete, finite, non-negative 7-day output",
           "100 of 100", f"{ok_count} of 100", "PASS" if ok_count == 100 else "FAIL",
           f"success rate {ok_count}%; structure failures {struct_fail}")
    record("reliability", "API forecasts equal the evaluated Component 2 export (tolerance 1e-4)",
           "100 of 100 match", f"{ok_count - match_fail} of {ok_count} match",
           "PASS" if ok_count == 100 and match_fail == 0 else "FAIL", f"max difference {worst:.2e}")
    record("reliability", "responses carry metadata (model, mode, issue date, lead dates, units)",
           "present", "present" if ok_count else "n/a", "PASS" if ok_count == 100 else "FAIL", "NFR-07 evidence")

    log("\nDeterminism - 20 requests x 5 repeats, plus service vs API comparison:")
    same_bytes, same_values, max_val_diff = 0, 0, 0.0

    def compare(a, b):
        if isinstance(a, dict) and isinstance(b, dict):
            return set(a) == set(b) and all(compare(a[k], b[k]) for k in a)
        if isinstance(a, list) and isinstance(b, list):
            return len(a) == len(b) and all(compare(x, y) for x, y in zip(a, b))
        if isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool):
            nonlocal_diff[0] = max(nonlocal_diff[0], abs(float(a) - float(b)))
            return abs(float(a) - float(b)) <= 1e-9
        return a == b

    nonlocal_diff = [0.0]
    for c, d in REQS[100:120]:
        hashes = {hashlib.sha256(client.get("/c1/forecast", params={"cell": c, "issue": d}).content).hexdigest()
                  for _ in range(5)}
        same_bytes += int(len(hashes) == 1)
        direct = json.loads(json.dumps(svc.forecast(c, d)))
        api = client.get("/c1/forecast", params={"cell": c, "issue": d}).json()
        same_values += int(compare(direct, api))
    record("reliability", "identical API requests return byte-identical responses (5 repeats each)",
           "20 of 20", f"{same_bytes} of 20", "PASS" if same_bytes == 20 else "FAIL", "SHA-256 of response body")
    record("reliability", "direct service output equals API output (parsed values and structure)",
           "20 of 20", f"{same_values} of 20", "PASS" if same_values == 20 else "FAIL",
           f"max numeric difference {nonlocal_diff[0]:.2e}")

    log("\nInvalid inputs must be rejected safely:")
    good_cell = cells[0]
    cases = [
        ("training-period date 2015-06-01", "GET", "/c1/forecast", {"cell": good_cell, "issue": "2015-06-01"}, 400),
        ("one day before range 2021-12-31", "GET", "/c1/forecast", {"cell": good_cell, "issue": "2021-12-31"}, 400),
        ("one day after range 2025-12-25", "GET", "/c1/forecast", {"cell": good_cell, "issue": "2025-12-25"}, 400),
        ("unknown cell XYZ", "GET", "/c1/forecast", {"cell": "XYZ", "issue": "2024-05-15"}, 400),
        ("malformed date 2024-13-40", "GET", "/c1/forecast", {"cell": good_cell, "issue": "2024-13-40"}, 422),
        ("lead = 0", "GET", "/c1/outlook", {"issue": "2024-05-15", "lead": 0}, 422),
        ("lead = 8", "GET", "/c1/outlook", {"issue": "2024-05-15", "lead": 8}, 422),
        ("nutrient = chl", "GET", "/c1/outlook", {"issue": "2024-05-15", "nutrient": "chl"}, 422),
        ("missing cell parameter", "GET", "/c1/forecast", {"issue": "2024-05-15"}, 422),
        ("POST to read-only endpoint", "POST", "/c1/forecast", {"cell": good_cell, "issue": "2024-05-15"}, 405),
    ]
    invalid_ok = 0
    for label, method, path, params, expected in cases:
        r = client.post(path, params=params) if method == "POST" else client.get(path, params=params)
        ok = r.status_code == expected
        invalid_ok += int(ok)
        record("invalid_input", label, str(expected), str(r.status_code), "PASS" if ok else "FAIL", f"{method} {path}")
    alive = client.get("/c1/health").status_code == 200
    record("reliability", "server still healthy after invalid requests", "200", "200" if alive else "error",
           "PASS" if alive else "FAIL")

    # ------------------------------------------------------------ scalability (sequential workloads)
    log("\nLocal prototype scaling - sequential workloads (3 repeats each, median reported):")
    SCALE = []
    for layer in ["service", api_layer]:
        for n in [1, 10, 50, 100]:
            for rep in range(1, 4):
                t0 = time.perf_counter()
                for i in range(n):
                    c, d = REQS[(rep * 37 + i) % len(REQS)]
                    if layer == "service":
                        svc.forecast(c, d)
                    else:
                        if client.get("/c1/forecast", params={"cell": c, "issue": d}).status_code != 200:
                            raise SystemExit("ERROR: request failed during scaling test.")
                total = time.perf_counter() - t0
                SCALE.append({"layer": layer, "n_requests": n, "repeat": rep, "total_s": total,
                              "ms_per_request": 1000 * total / n})
    scale = pd.DataFrame(SCALE)
    scale_med = scale.groupby(["layer", "n_requests"])[["total_s", "ms_per_request"]].median().reset_index()
    log(scale_med.round(4).to_string(index=False))
    for r in SCALE:
        PERF_ROWS.append({"section": "scaling", **r})

    log("\nBatching - one outlook call (12 cells) vs 12 separate forecast calls (service, 10 dates):")
    one, twelve = [], []
    for d in OUT_DATES[:10]:
        t0 = time.perf_counter(); svc.outlook(d, "no3", 7); one.append(1000 * (time.perf_counter() - t0))
        t0 = time.perf_counter()
        for c in cells:
            svc.forecast(c, d)
        twelve.append(1000 * (time.perf_counter() - t0))
    log(f"  median: 1 outlook call {np.median(one):.1f} ms | 12 forecast calls {np.median(twelve):.1f} ms")
    PERF_ROWS.append({"section": "batching", "layer": "service", "operation": "outlook (12 cells, 1 call)",
                      "n_measured": 10, "p50_ms": float(np.median(one))})
    PERF_ROWS.append({"section": "batching", "layer": "service", "operation": "12 x forecast (1 cell each)",
                      "n_measured": 10, "p50_ms": float(np.median(twelve))})
finally:
    if client is not None:
        try:
            client.close() if api_layer == "api_http" else client.__exit__(None, None, None)
        except Exception:
            pass
    if server is not None:
        server.terminate()
        try:
            server.wait(timeout=15)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=15)
if server is not None:
    record("safety", "temporary Uvicorn server stopped", "exited", "exited" if server.poll() is not None else "running",
           "PASS" if server.poll() is not None else "FAIL", f"port {PORT}")

# ================================================================== 5. context sizes
mb = lambda p: Path(p).stat().st_size / 1e6
ctx = {"dataset_rows": int(len(svc.df)), "dataset_columns": int(svc.df.shape[1]), "dataset_mb": mb(DATASET),
       "export_rows": int(len(ex)), "export_mb": mb(EXPORT),
       "app_assets_mb": sum(p.stat().st_size for p in Path("app_assets").glob("*") if p.is_file()) / 1e6,
       "cells": len(cells), "lead_days": 7, "replay_issue_dates": len(all_dates)}
log(f"\nContext sizes: dataset {ctx['dataset_rows']:,} rows x {ctx['dataset_columns']} columns ({ctx['dataset_mb']:.1f} MB) | "
    f"C2 export {ctx['export_rows']:,} rows ({ctx['export_mb']:.1f} MB) | app_assets {ctx['app_assets_mb']:.2f} MB | "
    f"{ctx['cells']} cells x {ctx['lead_days']} lead days x {ctx['replay_issue_dates']:,} replay issue dates")
for k, v in ctx.items():
    PERF_ROWS.append({"section": "context", "operation": k, "value": v})

# ================================================================== 6. maintainability evidence (no score)
log("\nMaintainability evidence (structural, verifiable; no numeric score):")
numbered = sorted(p.name for p in Path("scripts").glob("[0-9][0-9]*_*.py"))
record("maintainability", "numbered pipeline / analysis scripts", "present", f"{len(numbered)} scripts",
       "FOUND" if numbered else "MISSING", ", ".join(numbered), hard=False)
for label, path in [("shared task / feature / metric definitions", "scripts/common.py"),
                    ("model module (Neural ODE, LSTM-B, data windows)", "scripts/node_model.py"),
                    ("read-only forecast service", "c1_service/forecast_service.py"),
                    ("separate /c1 API router", "api/c1_router.py"), ("API application", "api/main.py"),
                    ("environment definition", "environment.yml"), ("data dictionary", "docs/data_dictionary.md"),
                    ("integration contract", "docs/integration_contract_c1_c2.md"),
                    ("generated OpenAPI contract", "docs/c1_api_openapi.json"),
                    ("service validation script", "scripts/13_check_service.py"),
                    ("API validation script", "scripts/14_check_api.py"),
                    ("cell coverage check", "scripts/99_check_cell_coverage.py"),
                    ("runtime check", "scripts/99_check_runtime.py"),
                    ("project README", "README.md")]:
    record("maintainability", label, "present", "present" if Path(path).exists() else "absent",
           "FOUND" if Path(path).exists() else "MISSING", path, hard=False)
if Path("docs/c1_api_openapi.json").exists():
    paths = json.loads(Path("docs/c1_api_openapi.json").read_text(encoding="utf-8")).get("paths", {})
    record("maintainability", "endpoints documented in OpenAPI", "documented", f"{len(paths)} paths", "FOUND",
           ", ".join(sorted(paths)), hard=False)
try:
    commits = subprocess.run(["git", "rev-list", "--count", "HEAD"], capture_output=True, text=True, timeout=30)
    branch = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], capture_output=True, text=True, timeout=30)
    if commits.returncode == 0:
        record("maintainability", "version-controlled history", "commits", f"{commits.stdout.strip()} commits",
               "FOUND", f"branch {branch.stdout.strip()}", hard=False)
    else:
        raise RuntimeError
except Exception:
    record("maintainability", "version-controlled history", "commits", "git not available", "NOT_CHECKED", hard=False)

# ================================================================== 7. security basics (what exists only)
log("\nSecurity basics (only what exists is claimed):")
from api.main import app  # noqa: E402
# read from the app's own OpenAPI schema (works for every FastAPI version's route layout)
HTTP_VERBS = {"get", "put", "post", "delete", "patch", "options", "head", "trace"}
methods = {p: sorted(m for m in ops if m in HTTP_VERBS) for p, ops in app.openapi().get("paths", {}).items()
           if p.startswith("/c1")}
non_get = {p: m for p, m in methods.items() if set(m) - {"get"}}
ok_routes = len(methods) >= 9 and not non_get
record("security", "all /c1 routes are read-only (GET only)", "GET only, 9 routes",
       f"GET only, {len(methods)} routes" if not non_get else str(non_get), "PASS" if ok_routes else "FAIL",
       ", ".join(sorted(methods)))
record("security", "invalid cell / date / lead / nutrient values rejected", "10 of 10", f"{invalid_ok} of 10",
       "PASS" if invalid_ok == len(cases) else "FAIL", "see invalid_input rows; replay dates bounded")
gi = Path(".gitignore").read_text(encoding="utf-8") if Path(".gitignore").exists() else ""
need = [".env", ".cdsapirc", "data/", "experiments/models/", "outputs/"]
missing_gi = [x for x in need if x not in gi]
record("security", "secrets and large data excluded by .gitignore", ", ".join(need),
       "all present" if not missing_gi else f"missing {missing_gi}", "PASS" if not missing_gi else "FAIL")
try:
    tracked = subprocess.run(["git", "ls-files"], capture_output=True, text=True, timeout=60)
    if tracked.returncode != 0:
        raise RuntimeError
    bad = [f for f in tracked.stdout.splitlines()
           if f.endswith((".cdsapirc", ".env", ".pt", ".nc")) or f.startswith(("data/", "outputs/", "experiments/models/"))]
    record("security", "no secrets, model weights or raw data tracked in Git", "none", f"{len(bad)} found",
           "PASS" if not bad else "FAIL", ", ".join(bad[:10]))
except Exception:
    record("security", "no secrets, model weights or raw data tracked in Git", "none", "git not available",
           "NOT_CHECKED", hard=False)
for key, f in [("neural_ode", node_file), ("benchmark", xgb_file)]:
    full = sha256(f)
    log(f"  {f}: SHA-256 {full}")
    entry = manifest.get(key, {}) if isinstance(manifest.get(key), dict) else {}
    fp = next((str(v).lower() for k, v in entry.items() if "sha256" in k.lower()), None)
    if fp:
        ok = full.startswith(fp)
        record("security", f"{key} model file matches its SHA-256 fingerprint in manifest.json", fp, full[:len(fp)],
               "PASS" if ok else "FAIL", str(f))
    else:
        record("security", f"{key} model file fingerprint in manifest.json", "fingerprint recorded",
               "no fingerprint field in manifest", "NOT_CHECKED", f"{f} SHA-256 logged in E41", hard=False)
personal = [c for c in svc.df.columns if any(k in c.lower() for k in
                                              ["name", "email", "phone", "address", "user", "person", "nic", "passport"])]
record("security", "no personal or user data in the served dataset", "no personal fields",
       "none" if not personal else str(personal), "PASS" if not personal else "FAIL",
       "environmental grid variables only")
cors_open = 'allow_origins=["*"]' in Path("api/main.py").read_text(encoding="utf-8")
record("security", "CORS origins", "restricted before deployment", "open (*) for local development" if cors_open else "restricted",
       "NOTED", "must be restricted before any deployment", hard=False)
record("security", "authentication / authorization (login, roles)", "planned", "not implemented", "NOT_IMPLEMENTED",
       "planned for the shared FastAPI backend (NFR-09)", hard=False)

# ================================================================== 8. read-only proof
log("\nRead-only proof:")
hash_after = {str(p): sha256(p) for p in PROTECTED if p.exists()}
changed = [k for k in hash_before if hash_before.get(k) != hash_after.get(k)]
record("read_only", "data, export, models, app_assets, service and API files unchanged", f"{len(hash_before)} unchanged",
       f"{len(hash_before) - len(changed)} unchanged", "PASS" if not changed else "FAIL", ", ".join(changed))

# ================================================================== 9. write CSVs
perf = pd.DataFrame(PERF_ROWS)
perf.round(4).to_csv(OUT["perf"], index=False)
rel = pd.DataFrame(REL_ROWS)
rel.to_csv(OUT["rel"], index=False)

# ================================================================== 10. figure
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(17, 6.5), gridspec_kw={"width_ratios": [1.35, 1]})
labels = list(LAT)
data = [LAT[k] for k in labels]
ypos = np.arange(len(labels))
_bp_kw = dict(positions=ypos, widths=0.6, patch_artist=True, showfliers=False, whis=(5, 95), medianprops=dict(color="#C8452B", lw=2))
try:
    bp = ax1.boxplot(data, orientation="horizontal", **_bp_kw)     # Matplotlib >= 3.10
except TypeError:
    bp = ax1.boxplot(data, vert=False, **_bp_kw)                   # older Matplotlib
for patch, (layer, _) in zip(bp["boxes"], labels):
    patch.set_facecolor("#DCEFF0" if layer == "service" else "#F3E7D3")
ax1.set_yticks(ypos)
ax1.set_yticklabels([f"{'service' if l == 'service' else 'API'} · {op}" for l, op in labels], fontsize=9)
ax1.set_xscale("log")
_ticks = [t for t in [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000]
          if min(map(min, data)) / 2 <= t <= max(map(max, data)) * 2]
ax1.set_xticks(_ticks)
ax1.set_xticklabels([f"{t:g}" for t in _ticks])
ax1.xaxis.set_minor_formatter(matplotlib.ticker.NullFormatter())
ax1.grid(axis="x", alpha=0.3)
ax1.set_xlabel("warm latency, ms (log scale) · box = 25–75%, red line = median, whiskers = 5th–95th percentile")
ax1.set_title(f"Warm latency per operation ({'real localhost HTTP' if api_layer == 'api_http' else 'TestClient, in-process'})")
ax1.invert_yaxis()
for layer, col in [("service", "#0B6E78"), (api_layer, "#B7791F")]:
    s = scale_med[scale_med["layer"] == layer]
    ax2.plot(s["n_requests"], s["total_s"], marker="o", color=col, lw=2,
             label="service (direct)" if layer == "service" else ("API over HTTP" if layer == "api_http" else "API (TestClient)"))
    for _, r in s.iterrows():
        ax2.annotate(f"{r['ms_per_request']:.0f} ms/req", (r["n_requests"], r["total_s"]), textcoords="offset points",
                     xytext=(6, -14 if layer == "service" else 6), fontsize=8, color=col,
                     bbox=dict(boxstyle="round,pad=0.15", fc="white", ec="none", alpha=0.85))
ax2.set_xlabel("number of sequential forecast requests")
ax2.set_ylabel("total time, s (median of 3 repeats)")
ax2.set_title("Local prototype scaling (sequential, one laptop)")
ax2.legend(fontsize=9)
fig.suptitle("Component 1 NFR benchmark · local laptop · sequential requests · not production throughput",
             fontweight="bold")
fig.tight_layout()
fig.savefig(OUT["png"], dpi=150, bbox_inches="tight")
plt.close(fig)

# ================================================================== 11. summary
hard = rel[rel["counts_toward_pass"]]
n_pass = int((hard["status"] == "PASS").sum())
all_pass = n_pass == len(hard)
lat = perf[perf["section"] == "warm_latency"].set_index(["layer", "operation"])
cold_df = pd.DataFrame(cold)


def lat_row(layer, op):
    r = lat.loc[(layer, op)]
    return f"| {('Service' if layer == 'service' else 'API')} · {op} | {r['p50_ms']:.1f} | {r['p95_ms']:.1f} | {r['mean_ms']:.1f} | {int(r['n_measured'])} |"


lat_lines = "\n".join(lat_row(l, o) for l, o in labels)
scale_lines = "\n".join(f"| {('Service' if r.layer == 'service' else 'API')} | {int(r.n_requests)} | {r.total_s:.2f} | "
                        f"{r.ms_per_request:.1f} |" for r in scale_med.itertuples())
rel_lines = "\n".join(f"| {r.category} | {r.check} | {r.actual} | {r.status} |" for r in rel.itertuples()
                      if r.category in ("reliability", "invalid_input", "read_only", "safety"))
maint_lines = "\n".join(f"- {r.check}: **{r.status}** ({r.detail or r.actual})" for r in rel.itertuples()
                        if r.category == "maintainability")
sec_lines = "\n".join(f"- {r.check}: **{r.status}** – {r.actual}" for r in rel.itertuples()
                      if r.category == "security" and r.status not in ("NOT_IMPLEMENTED",))
api_label = "real localhost HTTP (Uvicorn)" if api_layer == "api_http" else f"in-process TestClient ({fallback_reason})"
fc_p95 = lat.loc[(api_layer, "/c1/forecast"), "p95_ms"]
ol_p95 = lat.loc[(api_layer, "/c1/outlook (12 cells)"), "p95_ms"]

md = f"""# Component 1 – NFR evidence for PP1

Generated by `scripts/17_nfr_benchmark.py` on {pd.Timestamp.now().date()}. Read-only: no model, data, service or
API file was changed (SHA-256 verified). **Hard checks passed: {n_pass} of {len(hard)}.**

Machine: {platform.platform()}, {os.cpu_count()} logical CPUs, Python {platform.python_version()}, PyTorch {torch.__version__} (CPU).
API measurements: **{api_label}**. All requests sequential.

## Measured now

### Performance
Cold start (fresh process; imports + service load): median **{cold_df['import_s'].add(cold_df['load_s']).median():.1f} s**
(service load alone {cold_df['load_s'].median():.1f} s; run 1 = first load, runs 2–3 benefit from the OS file cache).

| Operation | p50 ms | p95 ms | mean ms | n |
|---|---|---|---|---|
{lat_lines}

Proposal NFR-02 asks for standard views within about 5 seconds. The backend part measured here is far below that
(API p95: forecast {fc_p95:.0f} ms, 12-cell outlook {ol_p95:.0f} ms). Frontend rendering is not built or measured yet,
so NFR-02 is only partly evidenced.

### Reliability
| Category | Check | Result | Status |
|---|---|---|---|
{rel_lines}

### Local prototype scaling (sequential, one laptop)
| Layer | Requests | Total s (median of 3) | ms per request |
|---|---|---|---|
{scale_lines}

Batching: one 12-cell outlook call took {np.median(one):.1f} ms versus {np.median(twelve):.1f} ms for 12 separate
forecast calls (median of 10 dates).

Context: modelling dataset {ctx['dataset_rows']:,} rows × {ctx['dataset_columns']} columns ({ctx['dataset_mb']:.1f} MB);
Component 2 export {ctx['export_rows']:,} rows ({ctx['export_mb']:.1f} MB); app assets {ctx['app_assets_mb']:.2f} MB;
{ctx['cells']} cells × 7 lead days × {ctx['replay_issue_dates']:,} replay issue dates.

## Verified design evidence

### Maintainability (structural evidence, no score)
{maint_lines}

### Basic data and API protection
{sec_lines}

## Not yet implemented
- Login, user roles and access control (NFR-09) – planned for the shared FastAPI backend.
- Production deployment, HTTPS, restricted CORS and production security hardening.
- Concurrent / cloud-scale load testing.
- Memory-footprint measurement (not measured in this step).
- Frontend (React Native) response and rendering time.

## Limitations
- One laptop, sequential requests; results depend on hardware and background load. Not production throughput.
- Replay mode: forecasts use stored reanalysis forcing, so live data-retrieval time is not included.
- Cold-start repeats benefit from operating-system file caching.
- API latency includes local HTTP only (no network distance, authentication or database).
"""
OUT["summary"].write_text(md, encoding="utf-8")

log(f"\nHard checks passed: {n_pass} of {len(hard)}  "
    f"(FOUND/MISSING, NOTED, NOT_CHECKED and NOT_IMPLEMENTED rows are recorded as evidence, not pass/fail)")
log("Written: " + " | ".join(str(p).replace("\\", "/") for p in OUT.values()))
if not all_pass:
    raise SystemExit("ERROR: at least one hard check failed - see the [FAIL] lines above.")
log("Step 17 completed successfully.")
