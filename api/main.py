"""
Standalone Component 1 API for local development and the PP1 demo.
In a shared group backend, only this line is needed: app.include_router(c1_router, prefix="/c1")
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.c1_router import router as c1_router, svc


@asynccontextmanager
async def lifespan(app):
    svc()            # load data and models once at startup
    yield


app = FastAPI(title="FishGuard AI · Component 1 · Coastal Nutrients API", version="1.0.0",
              description="Read-only replay-mode NO3 / PO4 / Si forecasts for 12 Western and Southern "
                          "coastal cells, validated on 2022–2025.", lifespan=lifespan)
# Local development: allow the Expo / web dev server to call the API. Restrict origins before any deployment.
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])
app.include_router(c1_router, prefix="/c1")