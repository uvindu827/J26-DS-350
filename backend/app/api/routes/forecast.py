
from datetime import date

from fastapi import APIRouter, HTTPException, Query

from app.schemas.forecast_schema import (
    HistoricalForecastResponse,
)

from app.services.forecast_service import (
    get_historical_prediction,
)


router = APIRouter(
    prefix="/api/forecast",
    tags=["CHL Forecasting"],
)


@router.get(
    "/historical",
    response_model=HistoricalForecastResponse,
)
def historical_forecast(
    date: date,
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
):
    try:
        result = get_historical_prediction(
            date=date,
            latitude=latitude,
            longitude=longitude,
        )

    except (FileNotFoundError, ValueError) as error:
        raise HTTPException(
            status_code=500,
            detail=str(error),
        ) from error

    if result is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "No historical prediction found "
                "for this date and coastal grid location."
            ),
        )

    return result
