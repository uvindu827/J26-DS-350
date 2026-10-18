from datetime import date
from fastapi import APIRouter, HTTPException, Query
from app.schemas.forecast_schema import (
    HistoricalForecastResponse, DirectForecastRequest, DirectForecastResponse,
    MapForecastResponse, AvailableDatesResponse,
)
from app.services.forecast_service import (
    get_historical_prediction, predict_chlorophyll,
    get_available_dates, get_map_predictions,
)
router = APIRouter(prefix='/api/forecast', tags=['CHL Forecasting'])

@router.get('/historical', response_model=HistoricalForecastResponse)
def historical_forecast(date: date, latitude: float = Query(ge=-90, le=90), longitude: float = Query(ge=-180, le=180)):
    try:
        result = get_historical_prediction(date, latitude, longitude)
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail='No historical record for this date and grid coordinate')
    return result

@router.get('/dates', response_model=AvailableDatesResponse)
def available_dates():
    try:
        return {'dates': get_available_dates()}
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

@router.get('/map', response_model=MapForecastResponse)
def historical_map(date: date):
    try:
        cells = get_map_predictions(date)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {'date': date, 'count': len(cells), 'cells': cells}

@router.post('/predict', response_model=DirectForecastResponse)
def direct_forecast(request: DirectForecastRequest):
    try:
        return predict_chlorophyll(request.features)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
