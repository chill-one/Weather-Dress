import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const HF_API_TOKEN = process.env.HF_API_TOKEN;
const HF_MODEL = process.env.HF_MODEL_ID || "sentence-transformers/all-MiniLM-L6-v2";
const HF_FALLBACK_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const LOCAL_EMBED_URL = process.env.EMBEDDING_API_URL || "http://backend:8000/embed";
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://backend:8000";

type OutfitCategory = "upper" | "lower" | "accessories" | "shoes";

type RecommendRequest = {
  user_key?: string;
  temp_c?: number | null;
  description?: string | null;
  wind?: number | null;
  precip?: string | null;
  style?: string | null;
  occasion?: string | null;
  limit?: number;
};

type RpcOutfitRow = {
  id: string;
  user_key: string;
  category: OutfitCategory | string | null;
  label: string | null;
  image_url?: string | null;
  brand?: string | null;
  store_url?: string | null;
  description?: string | null;
  color?: string | null;
  warmth_score?: number | null;
  water_resistance?: string | null;
  wind_block?: string | null;
  breathability?: string | null;
  coverage_top?: string | null;
  coverage_bottom?: string | null;
  footwear_type?: string | null;
  min_temp_c?: number | null;
  max_temp_c?: number | null;
  similarity?: number | null;
};

type ScoreBreakdown = {
  vector: number;
  temp: number;
  rain: number;
  wind: number;
  comfort: number;
  final: number;
};

type RecommendedItem = {
  id: string;
  label: string;
  category: OutfitCategory;
  image_url: string | null;
  brand: string | null;
  color: string | null;
  description: string | null;
  similarity: number;
  scores: ScoreBreakdown;
  reasons: string[];
  metadata: {
    warmth_score: number | null;
    water_resistance: string | null;
    wind_block: string | null;
    breathability: string | null;
    coverage_top: string | null;
    coverage_bottom: string | null;
    footwear_type: string | null;
    min_temp_c: number | null;
    max_temp_c: number | null;
  };
};

type WeatherContext = {
  temp_c: number | null;
  description: string | null;
  precip: string | null;
  wind: number | null;
  style: string | null;
  occasion: string | null;
};

type ExplanationDetails = {
  summary: string;
  item_reasons: Array<{
    category: OutfitCategory | string;
    label: string;
    reason: string;
  }>;
  outfit_reason: string;
  reasons: string[];
  warnings: string[];
  missing_items_advice: string[];
  source: "langchain" | "fallback";
};

const CATEGORIES: OutfitCategory[] = ["upper", "lower", "accessories", "shoes"];
const RAIN_RE = /\b(rain|drizzle|storm|thunder|shower|downpour|sleet)\b/i;

function clamp(value: number, min = 0, max = 1) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return value;
}

function clampLimit(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 32;
  return Math.min(Math.max(Math.trunc(value), 4), 64);
}

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

  const callModel = (modelId: string) =>
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
  if (!Array.isArray(embedding)) throw new Error("HF embedding response missing embedding field");
  return embedding as number[];
}

async function embedQuery(text: string) {
  try {
    return await embedViaLocal(text);
  } catch (localErr) {
    if (!HF_API_TOKEN) throw localErr;
    console.error("Local embed failed, falling back to Hugging Face", localErr);
    return embedViaHF(text);
  }
}

function buildQueryText(params: WeatherContext) {
  const parts = [
    "weather-aware outfit recommendation",
    params.style ? `style: ${params.style}` : "",
    params.occasion ? `occasion: ${params.occasion}` : "",
    params.temp_c != null ? `temperature: ${Math.round(params.temp_c)}C` : "",
    params.description ? `weather: ${params.description}` : "",
    params.wind != null ? `wind: ${Math.round(params.wind)} m/s` : "",
    params.precip ? `precipitation: ${params.precip}` : "",
  ];
  return parts.filter(Boolean).join(". ");
}

function hasRain(context: WeatherContext) {
  return RAIN_RE.test(`${context.description ?? ""} ${context.precip ?? ""}`);
}

function isWindy(wind: number | null) {
  return wind != null && wind >= 8;
}

function scoreTemp(row: RpcOutfitRow, tempC: number | null) {
  if (tempC == null) return { score: 0.6, reason: "Flexible for unknown temperature" };

  const min = asNumber(row.min_temp_c);
  const max = asNumber(row.max_temp_c);
  if (min == null && max == null) return { score: 0.55, reason: "No temperature tag yet" };

  const lower = min ?? -50;
  const upper = max ?? 60;
  if (tempC >= lower && tempC <= upper) return { score: 1, reason: "Temperature range matches" };

  const distance = tempC < lower ? lower - tempC : tempC - upper;
  if (distance <= 5) return { score: 0.65, reason: "Near the tagged temperature range" };
  if (distance <= 10) return { score: 0.35, reason: "A stretch for the temperature" };
  return { score: 0.15, reason: "Outside the tagged temperature range" };
}

function scoreRain(row: RpcOutfitRow, rainy: boolean) {
  const water = (row.water_resistance ?? "").toLowerCase();
  const footwear = (row.footwear_type ?? "").toLowerCase();

  if (!rainy) {
    return {
      score: water === "waterproof" || water === "resistant" ? 0.85 : 0.75,
      reason: "Dry-weather ready",
    };
  }

  if (row.category === "shoes" && footwear === "open") {
    return { score: 0.05, reason: "Open shoes are weak for rain" };
  }
  if (water === "waterproof") return { score: 1, reason: "Waterproof for wet weather" };
  if (water === "resistant") return { score: 0.8, reason: "Water-resistant for rain" };
  return { score: 0.25, reason: "Limited rain protection" };
}

function scoreWind(row: RpcOutfitRow, windy: boolean) {
  const windBlock = (row.wind_block ?? "").toLowerCase();
  if (!windy) return { score: 0.75, reason: "No strong wind adjustment needed" };
  if (windBlock === "high") return { score: 1, reason: "High wind block" };
  if (windBlock === "medium") return { score: 0.75, reason: "Moderate wind block" };
  if (windBlock === "low") return { score: 0.35, reason: "Low wind block" };
  return { score: 0.45, reason: "Wind protection is untagged" };
}

function scoreComfort(row: RpcOutfitRow, tempC: number | null) {
  const warmth = asNumber(row.warmth_score);
  const breathability = (row.breathability ?? "").toLowerCase();
  const topCoverage = (row.coverage_top ?? "").toLowerCase();
  const bottomCoverage = (row.coverage_bottom ?? "").toLowerCase();
  const footwear = (row.footwear_type ?? "").toLowerCase();

  let score = 0.55;
  const reasons: string[] = [];

  if (tempC != null && tempC >= 25) {
    if (breathability === "high") {
      score += 0.25;
      reasons.push("breathable for heat");
    } else if (breathability === "medium") {
      score += 0.12;
      reasons.push("moderately breathable");
    } else if (breathability === "low") {
      score -= 0.15;
      reasons.push("less breathable in heat");
    }

    if (warmth != null && warmth <= 3) {
      score += 0.25;
      reasons.push("low warmth for hot weather");
    } else if (warmth != null && warmth <= 6) {
      score += 0.1;
      reasons.push("not too warm");
    } else if (warmth != null) {
      score -= 0.25;
      reasons.push("may run warm");
    }

    if (topCoverage === "short_sleeve") score += 0.15;
    if (topCoverage === "jacket") score -= 0.25;
    if (bottomCoverage === "shorts") score += 0.1;
    if (footwear === "boot") score -= 0.15;
  } else if (tempC != null && tempC <= 10) {
    if (warmth != null && warmth >= 7) {
      score += 0.3;
      reasons.push("warm for cold weather");
    } else if (warmth != null && warmth >= 4) {
      score += 0.15;
      reasons.push("moderate warmth");
    } else if (warmth != null) {
      score -= 0.2;
      reasons.push("light for cold weather");
    }

    if (topCoverage === "jacket") score += 0.2;
    if (topCoverage === "long_sleeve") score += 0.12;
    if (bottomCoverage === "full_length") score += 0.15;
    if (footwear === "boot") score += 0.2;
    if (footwear === "closed") score += 0.1;
  } else {
    if (warmth != null && warmth >= 3 && warmth <= 7) {
      score += 0.2;
      reasons.push("balanced warmth");
    }
    if (breathability === "high" || breathability === "medium") {
      score += 0.1;
      reasons.push("comfortable breathability");
    }
  }

  return {
    score: clamp(score),
    reason: reasons[0] ?? "Comfort tags are balanced",
  };
}

function scoreCandidate(row: RpcOutfitRow, context: WeatherContext): RecommendedItem | null {
  if (!CATEGORIES.includes(row.category as OutfitCategory) || !row.id || !row.label) return null;

  const vector = clamp(Number(row.similarity ?? 0));
  const temp = scoreTemp(row, context.temp_c);
  const rain = scoreRain(row, hasRain(context));
  const wind = scoreWind(row, isWindy(context.wind));
  const comfort = scoreComfort(row, context.temp_c);
  const final = clamp(
    0.4 * vector + 0.25 * temp.score + 0.15 * rain.score + 0.1 * wind.score + 0.1 * comfort.score
  );

  const reasons = [temp.reason, rain.reason, wind.reason, comfort.reason]
    .filter((reason, idx, all) => reason && all.indexOf(reason) === idx)
    .slice(0, 4);

  return {
    id: row.id,
    label: row.label,
    category: row.category as OutfitCategory,
    image_url: row.image_url ?? null,
    brand: row.brand ?? null,
    color: row.color ?? null,
    description: row.description ?? null,
    similarity: vector,
    scores: {
      vector,
      temp: temp.score,
      rain: rain.score,
      wind: wind.score,
      comfort: comfort.score,
      final,
    },
    reasons,
    metadata: {
      warmth_score: asNumber(row.warmth_score),
      water_resistance: row.water_resistance ?? null,
      wind_block: row.wind_block ?? null,
      breathability: row.breathability ?? null,
      coverage_top: row.coverage_top ?? null,
      coverage_bottom: row.coverage_bottom ?? null,
      footwear_type: row.footwear_type ?? null,
      min_temp_c: asNumber(row.min_temp_c),
      max_temp_c: asNumber(row.max_temp_c),
    },
  };
}

function deterministicExplanationDetails(params: {
  outfit: Record<OutfitCategory, RecommendedItem | null>;
  missing_categories: string[];
  weather_context: WeatherContext;
}): ExplanationDetails {
  const selectedItems = CATEGORIES.map((category) => params.outfit[category]).filter(
    Boolean
  ) as RecommendedItem[];
  const selected = selectedItems.map(
    (item) => `${item.label} (${item.reasons.slice(0, 2).join(", ")})`
  );
  const weather = [
    params.weather_context.temp_c != null ? `${Math.round(params.weather_context.temp_c)}C` : null,
    params.weather_context.description,
    params.weather_context.precip,
    params.weather_context.wind != null ? `${Math.round(params.weather_context.wind)} m/s wind` : null,
  ].filter(Boolean);

  if (!selected.length) {
    return {
      summary: "No strong wardrobe match was found for this weather.",
      item_reasons: [],
      outfit_reason: "There are not enough selected wardrobe items to explain a complete outfit.",
      reasons: [
        "The retrieval and deterministic weather scoring pipeline did not select a wardrobe item.",
      ],
      warnings: params.missing_categories.length
        ? [`Missing categories: ${params.missing_categories.join(", ")}.`]
        : [],
      missing_items_advice: params.missing_categories.map(
        (category) => `Add more tagged ${category} items.`
      ),
      source: "fallback",
    };
  }

  const item_reasons = selectedItems.map((item) => ({
    category: item.category,
    label: item.label,
    reason: [
      item.reasons[0] ? `${item.reasons[0]}.` : "",
      item.reasons[1] ? `${item.reasons[1]}.` : "",
      item.metadata?.min_temp_c != null && item.metadata?.max_temp_c != null
        ? `Tagged for about ${Math.round(item.metadata.min_temp_c)}-${Math.round(
            item.metadata.max_temp_c
          )}C.`
        : "",
    ]
      .filter(Boolean)
      .join(" "),
  }));

  const coverage = selectedItems
    .map((item) => item.category)
    .filter((category, idx, all) => all.indexOf(category) === idx)
    .join(", ");

  return {
    summary: `These picks fit ${weather.join(", ") || "the current weather"}: ${selected.join("; ")}.`,
    item_reasons,
    outfit_reason:
      `Together, the selected ${coverage || "items"} balance weather protection, temperature fit, ` +
      "and comfort across the outfit instead of optimizing only one clothing piece.",
    reasons: CATEGORIES.map((category) => params.outfit[category])
      .filter(Boolean)
      .map((item) => `${item!.label}: ${item!.reasons.slice(0, 2).join(", ")}.`),
    warnings: params.missing_categories.length
      ? [`Missing categories: ${params.missing_categories.join(", ")}.`]
      : [],
    missing_items_advice: params.missing_categories.length
      ? params.missing_categories.map((category) => `Add more tagged ${category} items.`)
      : ["Keep item weather tags current for better recommendations."],
    source: "fallback",
  };
}

function backendUrl(path: string) {
  return `${BACKEND_URL.replace(/\/$/, "")}${path}`;
}

function isExplanationDetails(value: any): value is ExplanationDetails {
  return (
    typeof value?.summary === "string" &&
    Array.isArray(value?.item_reasons) &&
    typeof value?.outfit_reason === "string" &&
    Array.isArray(value?.reasons) &&
    Array.isArray(value?.warnings) &&
    Array.isArray(value?.missing_items_advice) &&
    (value?.source === "langchain" || value?.source === "fallback")
  );
}

async function generateExplanationDetails(params: {
  outfit: Record<OutfitCategory, RecommendedItem | null>;
  missing_categories: string[];
  weather_context: WeatherContext;
}) {
  const fallback = deterministicExplanationDetails(params);

  const selectedItems = CATEGORIES.map((category) => params.outfit[category])
    .filter(Boolean)
    .map((item) => ({
      category: item!.category,
      label: item!.label,
      brand: item!.brand,
      color: item!.color,
      description: item!.description,
      scores: item!.scores,
      reasons: item!.reasons,
      metadata: item!.metadata,
    }));

  try {
    const resp = await fetch(backendUrl("/outfit/explain"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        weather_context: params.weather_context,
        selected_items: selectedItems,
        missing_categories: params.missing_categories,
      }),
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      throw new Error(`LangChain explanation failed: ${resp.status} ${errTxt}`);
    }

    const body = await resp.json();
    return isExplanationDetails(body) ? body : fallback;
  } catch (err) {
    console.error("LangChain explanation fallback", err);
    return fallback;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as RecommendRequest;
    const userKey = typeof body.user_key === "string" ? body.user_key.trim() : "";
    if (!userKey) {
      return NextResponse.json({ error: "Missing user_key" }, { status: 400 });
    }

    const weather_context: WeatherContext = {
      temp_c: asNumber(body.temp_c),
      description: body.description?.trim() || null,
      precip: body.precip?.trim() || null,
      wind: asNumber(body.wind),
      style: body.style?.trim() || null,
      occasion: body.occasion?.trim() || null,
    };
    const matchCount = clampLimit(body.limit);
    const queryText = buildQueryText(weather_context);
    const embedding = await embedQuery(queryText);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase.rpc("match_outfits", {
      query_embedding: embedding,
      match_count: matchCount,
      input_user_key: userKey,
      temp_c: weather_context.temp_c,
    });

    if (error) {
      console.error("supabase match_outfits error", error);
      return NextResponse.json({ error: error.message || "match_outfits failed" }, { status: 500 });
    }

    const scored = ((data ?? []) as RpcOutfitRow[])
      .map((row) => scoreCandidate(row, weather_context))
      .filter((item): item is RecommendedItem => Boolean(item))
      .sort((a, b) => b.scores.final - a.scores.final);

    const grouped = CATEGORIES.reduce<Record<OutfitCategory, RecommendedItem[]>>(
      (acc, category) => {
        acc[category] = scored.filter((item) => item.category === category);
        return acc;
      },
      { upper: [], lower: [], accessories: [], shoes: [] }
    );

    const outfit = CATEGORIES.reduce<Record<OutfitCategory, RecommendedItem | null>>(
      (acc, category) => {
        acc[category] = grouped[category][0] ?? null;
        return acc;
      },
      { upper: null, lower: null, accessories: null, shoes: null }
    );

    const alternatives = CATEGORIES.reduce<Record<OutfitCategory, RecommendedItem[]>>(
      (acc, category) => {
        acc[category] = grouped[category].slice(1, 4);
        return acc;
      },
      { upper: [], lower: [], accessories: [], shoes: [] }
    );

    const missing_categories = CATEGORIES.filter((category) => !outfit[category]);
    const explanation_details = await generateExplanationDetails({
      outfit,
      missing_categories,
      weather_context,
    });

    return NextResponse.json(
      {
        outfit,
        alternatives,
        explanation: explanation_details.summary,
        explanation_details,
        missing_categories,
        weather_context,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("recommend error", err);
    return NextResponse.json({ error: err?.message || "failed" }, { status: 500 });
  }
}
