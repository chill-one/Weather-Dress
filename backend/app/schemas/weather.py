from typing import List, Optional, Literal
from pydantic import BaseModel

#Current user coords
class Coords(BaseModel):
    lat: float
    lon: float
    
# Wather forecast of the recent weather
class CurrentWeather(BaseModel):
    dt: int
    temp: Optional[float] = None
    feels_like: Optional[float] = None
    humidity: Optional[int] = None
    wind_speed: Optional[float] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    
# Weather forecast for each hour
class HourlyItem(BaseModel):
    dt: int
    temp: Optional[float] = None
    pop: Optional[float] = None
    icon: Optional[str] = None
    
class DailyItem(BaseModel):
    dt: int
    temp_min: Optional[float] = None
    temp_max: Optional[float] = None
    pop: Optional[float] = None
    icon: Optional[str] = None
    
class WeahterResponse(BaseModel):
    source: Literal["openweather"]
    coords: Coords
    units: Literal["metric", "imperial", "standard"]
    current: CurrentWeather
    hourly: List[HourlyItem] = []
    daily: List[DailyItem] = []
    alerts: list = []

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
