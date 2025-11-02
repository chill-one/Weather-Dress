import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load .env in local/dev so OWM_API_KEY, REDIS_URL, etc. are available
load_dotenv()

app = FastAPI(title="Weather Outfit API")

# CORS: allow your Next.js frontend to call this API from the browser.
# Keep this list as tight as possible in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://your-frontend-domain.com",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Register routers (OpenWeather endpoint + your other modules)
from app.routers import weather as weather_router
app.include_router(weather_router.router)

# ...existing routers (geo, feedback, outfit, health, etc.) should also be included similarly.