import os
import json
from typing import Optional, Tuple
import httpx

from app.schemas.weather import (
    WeatherResponse, Coords, CurrentWeather, HourlyItem, DailyItem
)

# Environment / Endpoint constants
OWM_KEY = os.getenv("OWM_API_KEY")
GEOCODE = "https://api.openweathermap.org/geo/1.0/direct"
ONECALL = "https://api.openweathermap.org/data/3.0/onecall"

class OpenWeatherError(RuntimeError):
    """Raised for user-fixable problems (missing key, bad location, etc.)."""
    ...
    
    

async def _geocode(q: str) -> Tuple[float, float]:
    """
    Convert a human-readable place string into (lat, lon) via OWM Geocoding API.
    - q: e.g., "Arlington,VA,US"
    Returns (lat, lon) as floats.
    Raises OpenWeatherError on not found or missing API key.
    """
    if not OWM_KEY:
        raise OpenWeatherError("Missing OWM_API_KEY")

    params = {"q": q, "limit": 1, "appid": OWM_KEY}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(GEOCODE, params=params)
        # 404 from OWM means "not found"; other 4xx/5xx will raise below
        if r.status_code == 404:
            raise OpenWeatherError("Location not found")
        r.raise_for_status()
        data = r.json()

        # If no candidates returned, treat as not found
        if not data:
            raise OpenWeatherError("Location not found")

        # Use top candidate
        return float(data[0]["lat"]), float(data[0]["lon"])


async def _onecall(lat: float, lon: float, units: str) -> dict:
    """
    Call One Call 3.0 for current/hourly/daily/alerts.
    - units: "metric" | "imperial" | "standard"
    Returns raw OWM JSON dict.
    """
    if not OWM_KEY:
        raise OpenWeatherError("Missing OWM_API_KEY")

    params = {
        "lat": lat, "lon": lon, "units": units,
        "exclude": "minutely",   # we don't need minute-level data
        "appid": OWM_KEY
    }
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(ONECALL, params=params)
        r.raise_for_status()
        return r.json()


def _shape(payload: dict, lat: float, lon: float, units: str) -> WeatherResponse:
    """
    Map OpenWeather's raw payload to our provider-agnostic WeatherResponse.
    Keeps only fields needed by the UI/comfort logic to avoid tight coupling.
    """
    cur = payload.get("current", {}) or {}
    hourly = payload.get("hourly", []) or []
    daily = payload.get("daily", []) or []

    current = CurrentWeather(
        dt=cur.get("dt", 0),
        temp=cur.get("temp"),
        feels_like=cur.get("feels_like"),
        humidity=cur.get("humidity"),
        wind_speed=cur.get("wind_speed"),
        description=(cur.get("weather") or [{}])[0].get("description"),
        icon=(cur.get("weather") or [{}])[0].get("icon"),
    )

    hourly_out = [
        HourlyItem(
            dt=h.get("dt", 0),
            temp=h.get("temp"),
            pop=h.get("pop"),  # probability of precipitation (0–1)
            icon=(h.get("weather") or [{}])[0].get("icon"),
        )
        for h in hourly[:12]  # trim to next 12 hours for lightweight responses
    ]

    daily_out = [
        DailyItem(
            dt=d.get("dt", 0),
            min=(d.get("temp") or {}).get("min"),
            max=(d.get("temp") or {}).get("max"),
            pop=d.get("pop"),
            icon=(d.get("weather") or [{}])[0].get("icon"),
        )
        for d in daily[:7]  # trim to next 7 days
    ]

    return WeatherResponse(
        source="openweather",
        coords=Coords(lat=lat, lon=lon),
        units=units,
        current=current,
        hourly=hourly_out,
        daily=daily_out,
        alerts=payload.get("alerts", []) or [],
    )

async def fetch_weather(
    *,
    q: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    units: str = "metric",
    redis=None,              # pass an async redis client from deps/redis.py
    cache_ttl: int = 600     # default cache: 10 minutes
) -> WeatherResponse:
    """
    Public entry point used by the router.
    - Accepts either (q) place string or (lat, lon) coordinates.
    - Optionally caches shaped responses in Redis to save API quota.
    Returns a WeatherResponse.
    """
    # Resolve geocoding if only a query string was provided
    if lat is None or lon is None:
        if not q:
            raise OpenWeatherError("Provide q or lat/lon")
        lat, lon = await _geocode(q)

    # Build a stable cache key rounded to 4 decimal places (~11m precision)
    cache_key = f"owm:{units}:{round(lat,4)}:{round(lon,4)}"

    # Try Redis cache first (non-fatal on cache errors)
    if redis:
        try:
            cached = await redis.get(cache_key)
            if cached:
                # Pydantic v2 helper to rebuild from JSON
                return WeatherResponse.model_validate_json(cached)
        except Exception:
            pass

    # Hit OWM API and shape the response
    data = await _onecall(lat, lon, units)
    shaped = _shape(data, lat, lon, units)

    # Save to Redis for a short TTL to balance freshness vs quota
    if redis:
        try:
            await redis.set(cache_key, shaped.model_dump_json(), ex=cache_ttl)
        except Exception:
            pass

    return shaped