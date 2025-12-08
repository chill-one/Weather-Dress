import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const HF_API_TOKEN = process.env.HF_API_TOKEN;
const HF_MODEL = process.env.HF_MODEL_ID || process.env.HF_FASHION_MODEL || "sentence-transformers/all-MiniLM-L6-v2";
const HF_FALLBACK_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
// Point this to your backend /embed endpoint (e.g., http://backend:8000/embed)
const LOCAL_EMBED_URL = process.env.EMBEDDING_API_URL || "http://weather-dress-backend:8000/embed";

// Helper: call Hugging Face Inference API for FashionCLIP embeddings
async function embedQuery(text: string): Promise<number[]> {
  // 1) Prefer local embedding service if provided (e.g., python SentenceTransformer)
  if (LOCAL_EMBED_URL) {
    const resp = await fetch(LOCAL_EMBED_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!resp.ok) {
      const errTxt = await resp.text();
      throw new Error(`Local embed request failed: ${resp.status} ${errTxt}`);
    }
    const body = await resp.json();
    if (Array.isArray(body?.embedding)) return body.embedding as number[];
    if (Array.isArray(body)) return body as number[];
    throw new Error("Local embed response missing embedding field");
  }

  if (!HF_API_TOKEN) {
    throw new Error("Missing HF_API_TOKEN");
  }

  const callModel = async (modelId: string) => {
    const resp = await fetch(`https://router.huggingface.co/pipeline/feature-extraction/${modelId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${HF_API_TOKEN}`,
      },
      body: JSON.stringify({ inputs: text }),
    });
    return resp;
  };

  let resp = await callModel(HF_MODEL);
  if (!resp.ok && (resp.status === 404 || resp.status === 410) && HF_MODEL !== HF_FALLBACK_MODEL) {
    // try a router-supported default model
    console.error(`HF model ${HF_MODEL} not available on router (${resp.status}). Trying fallback ${HF_FALLBACK_MODEL}.`);
    resp = await callModel(HF_FALLBACK_MODEL);
  }

  if (!resp.ok) {
    const errTxt = await resp.text();
    throw new Error(`HF embedding request failed: ${resp.status} ${errTxt}`);
  }

  const body = await resp.json();
  const embedding = Array.isArray(body?.[0]) ? body[0] : body;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error("Embedding response missing embedding field");
  }
  return embedding as number[];
}

// Helper: build the natural language query from weather + style
function buildQueryText(params: {
  temp?: number;
  description?: string;
  wind?: number;
  precip?: string;
  style?: string;
}) {
  const parts: string[] = [];
  if (params.style) parts.push(params.style);
  if (params.temp != null) parts.push(`for ${Math.round(params.temp)}°C`);
  if (params.description) parts.push(params.description);
  if (params.wind != null) parts.push(`wind ${params.wind} m/s`);
  if (params.precip) parts.push(params.precip);
  return parts.join(", ").trim() || "versatile outfit";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { temp_c, description, wind, precip, style, limit = 12 } = body || {};

    const queryText = buildQueryText({ temp: temp_c, description, wind, precip, style });
    const embedding = await embedQuery(queryText);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // match_outfits should be a SQL function that does:
    // order by embedding <=> query_embedding with filters on temp, etc.
    const { data, error } = await supabase.rpc("match_outfits", {
      query_embedding: embedding,
      match_count: limit,
      temp_c: temp_c ?? null,
    });

    if (error) {
      console.error("supabase match_outfits error", error);
      return NextResponse.json({ error: error.message || "match_outfits failed" }, { status: 500 });
    }

    return NextResponse.json({ items: data ?? [] }, { status: 200 });
  } catch (err: any) {
    console.error("recommend error", err);
    return NextResponse.json({ error: err?.message || "failed" }, { status: 500 });
  }
}
