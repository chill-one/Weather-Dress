from typing import Optional
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file if present
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RecommendReq(BaseModel):
    q: str
    units: str = "imperial"

class RecommendRes(BaseModel):
    city: str
    temp: float
    recommendation: str

@app.get("/weather/openweather")
def weather(
    q: Optional[str] = Query(None, description='e.g. "Arlington,VA,US"'),
    lat: Optional[float] = Query(None, description="Latitude in decimal degrees"),
    lon: Optional[float] = Query(None, description="Longitude in decimal degrees"),
    units: str = "imperial",
):
    api_key = os.getenv("OWM_API_KEY")
    if not api_key:
        return {"detail": "Missing OWM_API_KEY"}

    # Require either q OR lat+lon
    if q is None and (lat is None or lon is None):
        raise HTTPException(status_code=400, detail="Provide either q or lat+lon")

    # For now, just echo back what we got so you can debug:
    return {
        "ok": True,
        "q": q,
        "lat": lat,
        "lon": lon,
        "units": units,
    }

@app.post("/recommend", response_model=RecommendRes)
def recommend(body: RecommendReq):
    return RecommendRes(city=body.q, temp=72.0, recommendation="Light jacket + tee")