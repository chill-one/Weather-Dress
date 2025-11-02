from typing import Optional, Literal
from fastapi import APIRouter, Depends, Query, HTTPException

from app.schemas.weather import WeatherResponse
from app.services.open_weather import fetch_weather, OpenWeatherError

# Prefer to import your actual Redis dependency.
# If not available in some environments (tests), fall back gracefully.
try:
    from app.deps.redis import get_redis  # should return an *async* Redis client
except Exception:
    async def get_redis():
        # Return None so the service will skip caching
        return None

# This router groups all weather-related endpoints.
router = APIRouter(prefix="/weather", tags=["weather"])

@router.get("/openweather", response_model=WeatherResponse)
async def get_openweather(
    # Either provide a place string...
    q: Optional[str] = Query(None, description='e.g. "Arlington,VA,US"'),
    # ...or explicit coordinates:
    lat: Optional[float] = Query(None, description="Latitude in decimal degrees"),
    lon: Optional[float] = Query(None, description="Longitude in decimal degrees"),
    # Unit system for temps/wind/etc.
    units: Literal["metric","imperial","standard"] = Query("metric"),
    # Inject Redis client (or None) via dependency
    redis = Depends(get_redis),
):
    """
    GET /weather/openweather
    - Inputs: q or (lat, lon) and optional units
    - Output: provider-agnostic WeatherResponse (current, 12h hourly, 7d daily)
    - Caches results if Redis is available
    """
    try:
        return await fetch_weather(q=q, lat=lat, lon=lon, units=units, redis=redis)
    except OpenWeatherError as e:
        # User-facing, fixable errors (bad input, missing key, not found)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        # Avoid leaking internals; log server-side if you have logging
        raise HTTPException(status_code=500, detail="Weather fetch failed")