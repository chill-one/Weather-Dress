from fastapi import APIRouter
from pydantic import BaseModel
from ..deps.db import supabase_client  # adjust to your actual dep path

router = APIRouter(prefix="/feedback", tags=["feedback"])

class FeedbackIn(BaseModel):
    user_id: str | None = None
    comfort_offset: float | None = None
    outfit_id: str | None = None
    thumbs_up: bool | None = None

@router.post("")
async def submit_feedback(data: FeedbackIn):
    sb = supabase_client()
    res = sb.table("feedback").insert(data.model_dump(exclude_none=True)).execute()
    return {"inserted": len(res.data or [])}
