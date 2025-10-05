from fastapi import APIRouter, Query
import httpx

# 👇 this must exist at top-level
router = APIRouter(prefix="/weather", tags=["weather"])

@router.get("")
async def get_weather(lat: float = Query(...), lon: float = Query(...)):
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "temperature_2m,apparent_temperature",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        return r.json()
