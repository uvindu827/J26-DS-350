"""
Component 1 REST endpoints (read-only). Mount in any FastAPI app:
    app.include_router(router, prefix="/c1")
Every response comes from C1Service, which only loads saved data/models and predicts.
"""
import csv
import io
import json
from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse

from c1_service.forecast_service import C1Service, ROOT

router = APIRouter(tags=["C1 · Coastal Nutrients"])
_svc: Optional[C1Service] = None


def svc() -> C1Service:
    """Load data and models once, then reuse."""
    global _svc
    if _svc is None:
        _svc = C1Service()
    return _svc


def _call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except ValueError as e:                      # bad date, unknown cell, etc.
        raise HTTPException(status_code=400, detail=str(e))


ISSUE_DOC = "Forecast issue date YYYY-MM-DD, replay mode: 2022-01-01 to 2025-12-24"


@router.get("/health")
def health():
    return {"status": "ok", "model": svc().model_name}


@router.get("/meta")
def meta():
    return svc().meta()


@router.get("/cells")
def cells():
    return svc().list_cells()


@router.get("/geo")
def geo():
    return JSONResponse(json.loads((ROOT / "app_assets/geo.json").read_text(encoding="utf-8")))


@router.get("/outlook")
def outlook(issue: date = Query(..., description=ISSUE_DOC),
            nutrient: Literal["no3", "po4", "si"] = "no3",
            lead: int = Query(7, ge=1, le=7, description="Outlook day 1-7")):
    return _call(svc().outlook, issue, nutrient, lead)


@router.get("/forecast")
def forecast(cell: str = Query(..., description="Cell id, e.g. N6.75_E79.75"),
             issue: date = Query(..., description=ISSUE_DOC),
             benchmark: bool = Query(False, description="Include the XGBoost benchmark (expert view)")):
    return _call(svc().forecast, cell, issue, benchmark)


@router.get("/forecast.csv")
def forecast_csv(cell: str = Query(...), issue: date = Query(..., description=ISSUE_DOC)):
    fc = _call(svc().forecast, cell, issue, False)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["cell_id", "issue_date", "lead_time_days", "target_date", "nutrient",
                "forecast_mmol_m3", "typical_error_mmol_m3", "status_vs_normal", "trend",
                "observed_mmol_m3", "model", "mode"])
    for v, n in fc["nutrients"].items():
        for h in range(7):
            w.writerow([cell, fc["issue_date"], h + 1, fc["lead_dates"][h], v, n["forecast"][h],
                        n["typical_error"][h], n["status"][h], n["trend"][h], n["actual"][h],
                        fc["model"], fc["mode"]])
    name = f"c1_forecast_{cell}_{fc['issue_date']}.csv"
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/climatology")
def climatology(region: Optional[Literal["Western", "Southern"]] = None, cell: Optional[str] = None):
    return _call(svc().climatology, region, cell)


@router.get("/reliability")
def reliability():
    return svc().reliability()