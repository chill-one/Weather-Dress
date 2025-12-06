# app/main.py
from typing import Optional

from fastapi import FastAPI, HTTPException

from app.schemas.weather import WeatherResponse
from app.services.open_weather import fetch_weather, OpenWeatherError

app = FastAPI()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/weather/openweather", response_model=WeatherResponse)
async def openweather_endpoint(
    q: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    units: str = "imperial",
):
    """
    Backend endpoint that your Next.js app calls via /api/weather/openweather.
    It just forwards to fetch_weather (the code you pasted earlier).
    """
    try:
        weather = await fetch_weather(q=q, lat=lat, lon=lon, units=units)
        return weather
    except OpenWeatherError as e:
        # user-fixable issues like missing key, bad location, etc.
        raise HTTPException(status_code=400, detail=str(e))
