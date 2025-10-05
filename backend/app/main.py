# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import RedirectResponse, Response

# If you have routers, import them here
from .routers import (
    health, 
    weather, 
    feedback, 
    geo, 
    outfit  # adjust to what actually exists
    )

def create_app() -> FastAPI:
    api = FastAPI(title="Weather Outfit Backend")

    # CORS for local dev; tighten in prod (use your Vercel domain)
    api.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register routes (comment out ones you haven’t created yet)
    api.include_router(health.router)
    api.include_router(weather.router)
    api.include_router(feedback.router)
    api.include_router(geo.router)
    api.include_router(outfit.router)
    
    @api.get("/", include_in_schema=False)
    def home():
        # Either return a status payload:
        # return {"service": "weather-outfit-api", "status": "ok", "docs": "/docs"}

        # …or just send folks to the docs:
        return RedirectResponse(url="/docs")

    @api.get("/favicon.ico", include_in_schema=False)
    def favicon():
        # silence the automatic favicon request
        return Response(status_code=204)

    return api

# <-- THIS is what uvicorn looks for
app = create_app()
