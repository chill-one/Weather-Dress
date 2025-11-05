# app/main.py
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # your frontend dev origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RecommendReq(BaseModel):
    q: str          # e.g., "Arlington,VA,US"
    units: str = "imperial"

class RecommendRes(BaseModel):
    city: str
    temp: float
    recommendation: str

@app.get("/weather/openweather")
def weather(q: str = Query(...), units: str = "imperial"):
    api_key = os.getenv("OWM_API_KEY")
    if not api_key:
        return {"detail": "Missing OWM_API_KEY"}
    # call OpenWeather and return its JSON (left out for brevity)
    return {"ok": True, "q": q, "units": units}

@app.post("/recommend", response_model=RecommendRes)
def recommend(body: RecommendReq):
    # do your logic here (e.g., use weather + comfort model)
    return RecommendRes(city=body.q, temp=72.0, recommendation="Light jacket + tee")