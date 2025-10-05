docker build -f backend/Dockerfile -t weather-backend .
docker run --rm -p 8000:8000 \
  -e FRONTEND_ORIGIN=http://localhost:3000 \
  -e SUPABASE_URL=XXX -e SUPABASE_ANON_KEY=YYY \
  -e REDIS_URL=ZZZ \
  weather-backend
