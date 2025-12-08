import { NextRequest, NextResponse } from "next/server";

const HF_API_TOKEN = process.env.HF_API_TOKEN;
const HF_MODEL = process.env.HF_MODEL_ID || process.env.HF_FASHION_MODEL || "sentence-transformers/all-MiniLM-L6-v2";
const HF_FALLBACK_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const LOCAL_EMBED_URL = process.env.EMBEDDING_API_URL || "http://backend:8000/embed";

async function embedViaLocal(text: string) {
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

async function embedViaHF(text: string) {
  if (!HF_API_TOKEN) throw new Error("Missing HF_API_TOKEN");

  const callModel = async (modelId: string) =>
    fetch(`https://router.huggingface.co/pipeline/feature-extraction/${modelId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${HF_API_TOKEN}`,
      },
      body: JSON.stringify({ inputs: text }),
    });

  let resp = await callModel(HF_MODEL);
  if (!resp.ok && (resp.status === 404 || resp.status === 410) && HF_MODEL !== HF_FALLBACK_MODEL) {
    resp = await callModel(HF_FALLBACK_MODEL);
  }
  if (!resp.ok) {
    const errTxt = await resp.text();
    throw new Error(`HF embedding request failed: ${resp.status} ${errTxt}`);
  }
  const body = await resp.json();
  const embedding = Array.isArray(body?.[0]) ? body[0] : body;
  if (!Array.isArray(embedding)) throw new Error("HF embedding missing embedding field");
  return embedding as number[];
}

export async function POST(req: NextRequest) {
  try {
    const { text } = (await req.json()) ?? {};
    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    let embedding: number[] | null = null;
    if (LOCAL_EMBED_URL) {
      try {
        embedding = await embedViaLocal(text);
      } catch (err) {
        console.error("Local embed failed, falling back to HF", err);
      }
    }
    if (!embedding) {
      embedding = await embedViaHF(text);
    }

    return NextResponse.json({ embedding }, { status: 200 });
  } catch (err: any) {
    console.error("embed API error", err);
    return NextResponse.json({ error: err?.message || "failed" }, { status: 500 });
  }
}
