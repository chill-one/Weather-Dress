import os
import json
from typing import Optional, Tuple
import httpx


from app.schemas.weather import (
    WeahterResponse,
    Coords,
    CurrentWeather,
    HourlyItem,
    DailyItem,
)