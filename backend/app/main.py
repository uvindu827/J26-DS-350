
from fastapi import FastAPI

app = FastAPI(
    title="Marine Productivity Intelligence API",
    description=(
        "Component 2 - Nutrient-Informed CHL Forecasting "
        "and Marine Productivity Intelligence"
    ),
    version="1.0.0"
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
