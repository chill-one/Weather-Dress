import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const LOCAL_EMBED_URL = process.env.EMBEDDING_API_URL || "http://backend:8000/embed";

type OutfitRow = {
  id: string;
  label: string;
  description?: string | null;
  category?: string | null;
  color?: string | null;
  brand?: string | null;
  water_resistance?: string | null;
  wind_block?: string | null;
  breathability?: string | null;
  coverage_top?: string | null;
  coverage_bottom?: string | null;
  footwear_type?: string | null;
  warmth_score?: number | null;
  min_temp_c?: number | null;
  max_temp_c?: number | null;
};

function buildText(row: OutfitRow) {
  const parts = [
    `label: ${row.label}`,
    row.category ? `category: ${row.category}` : "",
    row.description ? `description: ${row.description}` : "",
    row.color ? `color: ${row.color}` : "",
    row.brand ? `brand: ${row.brand}` : "",
    row.water_resistance ? `water: ${row.water_resistance}` : "",
    row.wind_block ? `wind: ${row.wind_block}` : "",
    row.breathability ? `breathability: ${row.breathability}` : "",
    row.coverage_top ? `coverage_top: ${row.coverage_top}` : "",
    row.coverage_bottom ? `coverage_bottom: ${row.coverage_bottom}` : "",
    row.footwear_type ? `footwear: ${row.footwear_type}` : "",
    row.warmth_score != null ? `warmth: ${row.warmth_score}` : "",
    row.min_temp_c != null ? `min_temp: ${row.min_temp_c}` : "",
    row.max_temp_c != null ? `max_temp: ${row.max_temp_c}` : "",
  ];
  return parts.filter(Boolean).join(". ");
}

async function embedText(text: string) {
  const resp = await fetch(LOCAL_EMBED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) {
    const errTxt = await resp.text();
    throw new Error(`Embed failed: ${resp.status} ${errTxt}`);
  }
  const body = await resp.json();
  if (Array.isArray(body?.embedding)) return body.embedding as number[];
  if (Array.isArray(body)) return body as number[];
  throw new Error("Embed response missing embedding");
}

export async function POST(_req: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY on the server for re-embedding." },
        { status: 500 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase
      .from("outfit_items")
      .select(
        "id,label,description,category,color,brand,water_resistance,wind_block,breathability,coverage_top,coverage_bottom,footwear_type,warmth_score,min_temp_c,max_temp_c"
      )
      .limit(500);

    if (error) {
      console.error("reembed select error", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items = data as OutfitRow[];
    let success = 0;
    let failed = 0;
    for (const row of items) {
      try {
        const text = buildText(row);
        const embedding = await embedText(text);
        const { error: upErr } = await supabase
          .from("outfit_items")
          .update({ embedding })
          .eq("id", row.id);
        if (!upErr) success += 1;
        else {
          failed += 1;
          console.error("reembed update error", upErr);
        }
      } catch (err) {
        failed += 1;
        console.error("reembed embed error", err);
      }
    }

    return NextResponse.json(
      { message: `Re-embedded ${success}/${items.length} items`, failed },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("reembed error", err);
    return NextResponse.json({ error: err?.message || "failed" }, { status: 500 });
  }
}
