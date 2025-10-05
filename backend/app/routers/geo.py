from fastapi import APIRouter, Query
import httpx

router = APIRouter(prefix="/geo", tags=["geo"])

@router.get("/search")
async def search_city(q: str = Query(...)):
    url = "https://geocoding-api.open-meteo.com/v1/search"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url, params={"name": q, "count": 5})
        r.raise_for_status()
        return r.json()
