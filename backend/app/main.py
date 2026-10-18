
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.forecast import router as forecast_router

app = FastAPI(
    title="Marine Productivity Intelligence API",
    description=(
        "Component 2 - Nutrient-Informed CHL Forecasting "
        "and Marine Productivity Intelligence"
    ),
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "Component 2 FastAPI Backend Running Successfully"
    }

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "component": "CHL Forecasting",
        "api_version": "1.0.0"
    }


app.include_router(forecast_router)