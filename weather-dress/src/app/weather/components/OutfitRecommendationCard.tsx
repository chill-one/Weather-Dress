"use client";

import type { OutfitCategory, RecommendedItem } from "../types/recommendations";

const CATEGORY_LABELS: Record<OutfitCategory, string> = {
  upper: "Upper",
  lower: "Lower",
  accessories: "Accessories",
  shoes: "Shoes",
};

const SCORE_LABELS: Array<{
  key: keyof RecommendedItem["scores"];
  label: string;
}> = [
  { key: "temp", label: "Temp fit" },
  { key: "rain", label: "Rain ready" },
  { key: "wind", label: "Wind block" },
  { key: "comfort", label: "Comfort" },
  { key: "vector", label: "Similarity" },
];

function asPercent(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

export function OutfitRecommendationCard({
  category,
  item,
}: {
  category: OutfitCategory;
  item: RecommendedItem | null;
}) {
  return (
    <div className="min-h-[11rem] rounded-xl border border-white/12 bg-white/[0.06] p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/55">
          {CATEGORY_LABELS[category]}
        </p>
        {item ? (
          <span className="rounded-full border border-emerald-300/35 bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
            {asPercent(item.scores.final)}
          </span>
        ) : null}
      </div>

      {!item ? (
        <div className="grid min-h-[8.5rem] place-items-center rounded-lg border border-dashed border-white/15 bg-black/20 px-3 text-center">
          <p className="text-[11px] leading-relaxed text-white/60">
            No strong match found. Add more items or adjust tags.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/25">
              {item.image_url ? (
                <img src={item.image_url} alt={item.label} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center px-2 text-center text-[10px] text-white/55">
                  No image
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-semibold text-white">{item.label}</p>
              {(item.brand || item.color) && (
                <p className="mt-0.5 line-clamp-1 text-[11px] text-white/60">
                  {[item.brand, item.color].filter(Boolean).join(" / ")}
                </p>
              )}
              {item.description && (
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-white/55">
                  {item.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {item.reasons.slice(0, 4).map((reason) => (
              <span
                key={reason}
                className="rounded-full border border-white/12 bg-black/20 px-2 py-0.5 text-[10px] text-white/70"
              >
                {reason}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {SCORE_LABELS.map(({ key, label }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[10px]"
              >
                <span className="text-white/55">{label}</span>
                <span className="font-semibold text-white/85">{asPercent(item.scores[key])}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
