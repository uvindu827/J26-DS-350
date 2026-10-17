
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class HistoricalForecastResponse(BaseModel):
    date: date

    latitude: float
    longitude: float

    predicted_chl_mg_m3: float = Field(ge=0)

    actual_chl_mg_m3: float | None = None

    productivity_class: Literal[
        "Low", "Medium", "High"
    ]

    prediction_type: Literal["historical_test"]
