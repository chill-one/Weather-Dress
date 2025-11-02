from typing import List, Optional, Literal
from pydantic import BaseModel

# Geographic coordinates (decimal degrees)
class Coords(BaseModel):
    lat: float  # Latitude (positive = north, negative = south)
    lon: float  # Longitude (positive = east, negative = west)

# Snapshot of current weather conditions at a given time
class CurrentWeather(BaseModel):
    dt: int                         # UNIX timestamp (seconds) of the observation
    temp: Optional[float] = None    # Air temperature at the surface
    feels_like: Optional[float] = None  # “Feels like” temperature (wind/chill/heat index)
    humidity: Optional[int] = None  # Relative humidity in %
    wind_speed: Optional[float] = None  # Wind speed (units depend on `units` setting)
    description: Optional[str] = None   # Short human-readable summary (e.g., "light rain")
    icon: Optional[str] = None          # Provider icon id (e.g., "10d"); UI can map to an icon URL

# One hourly forecast sample
class HourlyItem(BaseModel):
    dt: int                         # UNIX timestamp (start of the hour)
    temp: Optional[float] = None    # Forecast temperature for that hour
    pop: Optional[float] = None     # Probability of precipitation for the hour (0.0–1.0)
    icon: Optional[str] = None      # Icon id representing the hour's primary weather

# One daily forecast sample
class DailyItem(BaseModel):
    dt: int                         # UNIX timestamp (typically start of the day at 00:00 UTC)
    min: Optional[float] = None     # Forecast daily minimum temperature
    max: Optional[float] = None     # Forecast daily maximum temperature
    pop: Optional[float] = None     # Daily probability of precipitation (0.0–1.0)
    icon: Optional[str] = None      # Icon id representing the day's primary weather

# Unified weather payload your API returns (provider-agnostic shape with source tag)
class WeatherResponse(BaseModel):
    source: Literal["openweather"]              # Which upstream produced the data
    coords: Coords                              # Coordinates used to request/derive the forecast
    units: Literal["metric", "imperial", "standard"]  # Unit system used for temps/wind/etc.
    current: CurrentWeather                     # Current conditions
    hourly: List[HourlyItem] = []               # Short-term hourly forecast (e.g., next 12 hours)
    daily: List[DailyItem] = []                 # Multi-day forecast (e.g., next 7 days)
    alerts: list = []                           # Raw alert objects from the provider (if any)