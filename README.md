# Weather Dress

Weather Dress is a Next.js and FastAPI app that recommends outfits from a user's own wardrobe using live weather, item embeddings, deterministic weather scoring, and optional LangChain-generated explanations.

## Architecture

- `weather-dress/`: Next.js, React, TypeScript, and Tailwind frontend.
- `backend/`: FastAPI service for weather, local embeddings, and LangChain explanation generation.
- `supabase/`: Postgres schema and pgvector migration for wardrobe storage and vector retrieval.
- Supabase table: `public.outfit_items`.
- Embedding model: `sentence-transformers/all-MiniLM-L6-v2`, dimension `384`.

The browser uses the Supabase anon key for wardrobe reads and writes. Next API routes use server-only secrets for search, re-embedding, and Supabase RPC calls. The FastAPI backend uses server-only OpenAI/LangChain settings for structured explanation generation.

## Weather Flow

The weather page calls:

```text
/api/weather/openweather
```

Next rewrites only `/api/weather/:path*` to the FastAPI backend:

```text
http://backend:8000/weather/:path*
```

Outfit routes such as `/api/outfits/search`, `/api/outfits/embed`, `/api/outfits/recommend`, and `/api/outfits/reembed` stay in Next.js.

## Embeddings

FastAPI exposes:

```text
POST /embed
```

The endpoint loads `sentence-transformers/all-MiniLM-L6-v2` and returns a `384`-dimension embedding. Next uses:

```text
EMBEDDING_API_URL=http://backend:8000/embed
```

Local embeddings are the default. Hugging Face is used only as a fallback when local embedding fails and `HF_API_TOKEN` exists.

## RAG Recommendation Flow

`POST /api/outfits/recommend` accepts weather and preference context:

```json
{
  "user_key": "guest-or-user-key",
  "temp_c": 12,
  "description": "light rain",
  "wind": 6,
  "precip": "60% precip",
  "style": "casual",
  "occasion": "rain commute",
  "limit": 32
}
```

The route:

1. Validates `user_key`.
2. Builds weather/style/occasion query text.
3. Embeds the query with the local FastAPI embed service.
4. Calls Supabase `match_outfits` with `input_user_key`.
5. Reranks only that user's wardrobe items with deterministic vector, temperature, rain, wind, and comfort scores.
6. Sends only the selected items, scores, metadata, weather context, and missing categories to the FastAPI LangChain explanation endpoint.
7. Returns one item per category plus alternatives, missing categories, and structured explanation details.

## LangChain Explanation Layer

LangChain is used only after retrieval and deterministic reranking. It generates structured explanation JSON for the already-selected outfit items:

```json
{
  "summary": "string",
  "reasons": ["string"],
  "warnings": ["string"],
  "missing_items_advice": ["string"]
}
```

LangChain does not choose items, call tools, browse, or act as a general chatbot. It receives current weather, style, occasion, selected wardrobe items, item metadata, deterministic scores, and missing categories. It must not invent wardrobe items or claim the user owns anything that was not retrieved from Supabase.

If `OPENAI_API_KEY` is missing or LangChain fails, the app returns the deterministic recommendation with a rule-based fallback explanation. This is a RAG pipeline, not a full autonomous agent.

## Supabase Migration

Apply the migration:

```bash
supabase db push
```

or run the SQL in:

```text
supabase/migrations/0001_outfit_items_and_match.sql
```

The migration enables pgvector, creates `public.outfit_items`, adds user/category/vector indexes, and defines a privacy-safe `match_outfits` function. The function returns no rows unless `input_user_key` is provided.

## Environment

Copy examples and fill in values:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp weather-dress/.env.example weather-dress/.env.local
```

Important variables:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SERPAPI_API_KEY=
HF_API_TOKEN=
HF_MODEL_ID=sentence-transformers/all-MiniLM-L6-v2
GPT_key=
OPENAI_API_KEY=
OPENAI_MODEL=
GPT_MODEL=
LANGCHAIN_TRACING_V2=false
LANGCHAIN_API_KEY=
LANGCHAIN_PROJECT=weather-dress
EMBEDDING_API_URL=http://backend:8000/embed
NEXT_PUBLIC_BACKEND_URL=http://backend:8000
```

Do not expose `SUPABASE_SERVICE_ROLE_KEY`, `SERPAPI_API_KEY`, `HF_API_TOKEN`, `GPT_key`, `OPENAI_API_KEY`, or `LANGCHAIN_API_KEY` as `NEXT_PUBLIC_*`.

Backend:

```text
OWM_API_KEY=
DATABASE_URL=
OPENAI_API_KEY=
LANGCHAIN_TRACING_V2=false
LANGCHAIN_API_KEY=
LANGCHAIN_PROJECT=weather-dress
```


## Docker

Run both services:

```bash
docker compose up --build
```

Frontend:

```text
http://localhost:3000
```

Backend:

```text
http://localhost:8000
```

## Re-Embedding Wardrobe Items

The weather page has a re-embed action for the current wardrobe owner. The API also accepts:

```bash
curl -X POST http://localhost:3000/api/outfits/reembed \
  -H "Content-Type: application/json" \
  -d '{"user_key":"your-user-key"}'
```

Response:

```json
{
  "message": "Re-embedded 4/4 items",
  "success": 4,
  "failed": 0,
  "total": 4
}
```

## Validation

Run frontend checks:

```bash
cd weather-dress
npm run lint
npm run build
```

Manual checks:

- City search and GPS weather loading work.
- Weekly forecast opens without removing weather effects.
- Outfit API routes stay in Next.js.
- Recommendations are scoped to the active `user_key`.
- Empty categories show an honest missing-match state.
- Rain prefers waterproof or resistant items and avoids open shoes.
- Cold weather prefers warmth, full coverage, and boots.
- Hot weather prefers breathable and lower-warmth items.
