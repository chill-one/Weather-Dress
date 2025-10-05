from fastapi import APIRouter, Query

# 👇 must exist at top level
router = APIRouter(prefix="/outfit", tags=["outfit"])

@router.get("", name="recommend_outfit")
async def recommend_outfit(
    temp_c: float = Query(..., description="Ambient temperature in °C"),
    comfort_offset: float = 0.0,
):
    # TODO: call services.comfort/rules later
    tier = "light-jacket" if temp_c + comfort_offset < 18 else "t-shirt"
    return {"tier": tier, "offset": comfort_offset}
