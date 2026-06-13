# app/main.py
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

from app.schemas.weather import WeatherResponse
from app.services.open_weather import fetch_weather, OpenWeatherError
from app.services.outfit_langchain import (
    ExplanationRequest,
    ImageAnalysisRequest,
    OutfitImageAnalysisDetails,
    OutfitExplanationDetails,
    analyze_outfit_image,
    generate_outfit_explanation,
)

app = FastAPI()

# ✅ Load embedding model once at startup
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")


# ✅ Embedding request/response models
class EmbedRequest(BaseModel):
    text: str


class EmbedResponse(BaseModel):
    embedding: list[float]


@app.get("/health")
async def health():
    return {"status": "ok"}


# ✅ Embedding endpoint (no need for embed_server.py anymore)
@app.post("/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest):
    """
    Embedding endpoint that converts text to vector embeddings.
    Uses sentence-transformers/all-MiniLM-L6-v2 model.
    """
    emb = model.encode([req.text])[0].tolist()
    return {"embedding": emb}


@app.post("/outfit/explain", response_model=OutfitExplanationDetails)
async def explain_outfit(req: ExplanationRequest):
    """
    Generate a structured explanation for already-selected outfit items.
    Retrieval and reranking happen before this endpoint is called.
    """
    return await generate_outfit_explanation(req)


@app.post("/outfit/analyze-image", response_model=OutfitImageAnalysisDetails)
async def analyze_outfit_image_endpoint(req: ImageAnalysisRequest):
    """
    Analyze a search-result product image and infer wardrobe weather tags.
    The user still reviews and edits these tags before saving.
    """
    return await analyze_outfit_image(req)


@app.get("/weather/openweather", response_model=WeatherResponse)
async def openweather_endpoint(
    q: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    units: str = "imperial",
):
    """
    Backend endpoint that your Next.js app calls via /api/weather/openweather.
    It just forwards to fetch_weather.
    """
    try:
        weather = await fetch_weather(q=q, lat=lat, lon=lon, units=units)
        return weather
    except OpenWeatherError as e:
        raise HTTPException(status_code=400, detail=str(e))
