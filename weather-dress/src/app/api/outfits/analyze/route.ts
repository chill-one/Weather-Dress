import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://backend:8000";

function backendUrl(path: string) {
  return `${BACKEND_URL.replace(/\/$/, "")}${path}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const imageUrl = typeof body?.image_url === "string" ? body.image_url.trim() : "";

    if (!imageUrl) {
      return NextResponse.json({ error: "Missing image_url" }, { status: 400 });
    }

    const resp = await fetch(backendUrl("/outfit/analyze-image"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        image_url: imageUrl,
        label: typeof body?.label === "string" ? body.label : null,
        description: typeof body?.description === "string" ? body.description : null,
        brand: typeof body?.brand === "string" ? body.brand : null,
        category_hint: typeof body?.category_hint === "string" ? body.category_hint : null,
      }),
    });

    const result = await resp.json().catch(() => null);
    if (!resp.ok) {
      return NextResponse.json(
        { error: result?.detail || result?.error || "Image analysis failed" },
        { status: 502 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("outfit image analysis route error", err);
    return NextResponse.json(
      { error: err?.message || "Image analysis failed" },
      { status: 500 }
    );
  }
}
