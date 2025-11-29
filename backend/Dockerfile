# backend/Dockerfile

# --- Base image ---
FROM python:3.11-slim AS base

WORKDIR /app

# Python settings
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# System deps (only if you need to compile packages; otherwise you can remove build-essential)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
 && rm -rf /var/lib/apt/lists/*

# --- Install Python deps ---
# Make sure you have backend/requirements.txt
COPY weather_outfit_backend.egg-info/requires.txt .

RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requires.txt

# --- Copy backend code ---
COPY . .

# Expose FastAPI port
EXPOSE 8000

# ⬇️ CHANGE THIS if your app is not app/main.py with `app = FastAPI()`
# Examples:
#   main.py in backend root -> "main:app"
#   src/main.py             -> "src.main:app"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
