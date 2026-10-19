# from datetime import date
# from typing import Literal
# from pydantic import BaseModel, Field

# class HistoricalForecastResponse(BaseModel):
#     date: date
#     latitude: float
#     longitude: float
#     predicted_chl_mg_m3: float = Field(ge=0)
#     actual_chl_mg_m3: float | None = None
#     productivity_class: Literal['Low', 'Medium', 'High']
#     prediction_type: Literal['historical_test']

# class DirectForecastRequest(BaseModel):
#     features: dict[str, float] = Field(description='Exactly 69 already-engineered, imputed and scaled feature values')

# class DirectForecastResponse(BaseModel):
#     predicted_chl_mg_m3: float = Field(ge=0)
#     productivity_class: Literal['Low', 'Medium', 'High']
#     prediction_type: Literal['direct_model_inference']
#     model_name: Literal['XGBoost']
#     features_used: int = Field(ge=1)

# class MapForecastResponse(BaseModel):
#     date: date
#     count: int
#     cells: list[HistoricalForecastResponse]

# class AvailableDatesResponse(BaseModel):
#     dates: list[date]

from datetime import date
from typing import Literal
from pydantic import BaseModel, Field

class HistoricalForecastResponse(BaseModel):
    date: date
    latitude: float
    longitude: float
    predicted_chl_mg_m3: float = Field(ge=0)
    actual_chl_mg_m3: float | None = None
    productivity_class: Literal["Low", "Medium", "High"]
    prediction_type: Literal["historical_test"]

class DirectForecastRequest(BaseModel):
    features: dict[str, float] = Field(description="Exactly 69 engineered, imputed and scaled features in final tuned-model preprocessing format")

class DirectForecastResponse(BaseModel):
    predicted_chl_mg_m3: float = Field(ge=0)
    productivity_class: Literal["Low", "Medium", "High"]
    prediction_type: Literal["direct_model_inference"]
    model_name: Literal["XGBoost"]
    features_used: int = Field(ge=1)

class MapForecastResponse(BaseModel):
    date: date
    count: int
    cells: list[HistoricalForecastResponse]

class AvailableDatesResponse(BaseModel):
    dates: list[date]
