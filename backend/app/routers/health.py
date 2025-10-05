from fastapi import APIRouter

router = APIRouter(tags=["health"])

@router.get("/health", name="healthcheck")
async def health():
    return {"ok": True}
