import { NextRequest, NextResponse } from "next/server";

type SerpShoppingResult = {
  title?: string;
  link?: string;
  source?: string;
  price?: string;
  thumbnail?: string;
  snippet?: string;
};

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const apiKey = process.env.SERPAPI_API_KEY;

  if (!q || !q.trim()) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing SERPAPI_API_KEY" },
      { status: 500 }
    );
  }

  try {
    const params = new URLSearchParams({
      engine: "google_shopping",
      api_key: apiKey,
      q,
      num: "12",
    });

    const resp = await fetch(`${SERPAPI_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      // avoid caching stale results
      cache: "no-store",
    });

    const body = await resp.json();

    if (!resp.ok) {
      console.error("SerpAPI error", body);
      return NextResponse.json(
        {
          error: `SerpAPI request failed: ${resp.status}`,
          detail: body?.error || body,
        },
        { status: 502 }
      );
    }

    const results: SerpShoppingResult[] = body.shopping_results ?? [];

    const items = results.slice(0, 12).map((r) => ({
      label: r.title ?? "Item",
      image_url: r.thumbnail ?? null,
      brand: r.source ?? null,
      store_url: r.link ?? null,
      description: r.snippet ?? null,
    }));

    return NextResponse.json({ items }, { status: 200 });
  } catch (err: any) {
    console.error("SerpAPI fetch failed", err);
    return NextResponse.json(
      { error: err?.message || "Search failed" },
      { status: 500 }
    );
  }
}
