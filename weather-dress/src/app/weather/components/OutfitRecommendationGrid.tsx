"use client";

import { OutfitRecommendationCard } from "./OutfitRecommendationCard";
import type { OutfitCategory, OutfitRecommendation } from "../types/recommendations";

const CATEGORIES: OutfitCategory[] = ["upper", "lower", "accessories", "shoes"];
const CATEGORY_LABELS: Record<OutfitCategory, string> = {
  upper: "Upper",
  lower: "Lower",
  accessories: "Accessories",
  shoes: "Shoes",
};

function categoryLabel(category: string) {
  return CATEGORY_LABELS[category as OutfitCategory] ?? category;
}

export function OutfitRecommendationGrid({
  recommendation,
  loading,
}: {
  recommendation: OutfitRecommendation | null;
  loading?: boolean;
}) {
  if (loading && !recommendation) {
    return <p className="text-[11px] text-white/50">Updating recommendations...</p>;
  }

  const missing = recommendation?.missing_categories ?? CATEGORIES;
  const explanationDetails = recommendation?.explanation_details;
  const itemReasons = explanationDetails?.item_reasons ?? [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2">
        {CATEGORIES.map((category) => (
          <OutfitRecommendationCard
            key={category}
            category={category}
            item={recommendation?.outfit?.[category] ?? null}
          />
        ))}
      </div>

      {(recommendation?.explanation || explanationDetails) && (
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/50">
              Why this works
            </p>
            {explanationDetails?.source && (
              <span className="rounded-full border border-white/12 bg-white/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-white/50">
                {explanationDetails.source === "langchain" ? "LangChain" : "Rules"}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-[11px] leading-relaxed text-white/72">
              {explanationDetails?.summary ?? recommendation.explanation}
            </p>

            {itemReasons.length > 0 && (
              <div className="space-y-1.5">
                {itemReasons.map((itemReason, idx) => (
                  <div
                    key={`${itemReason.category}-${itemReason.label}-${idx}`}
                    className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
                      {categoryLabel(itemReason.category)}
                    </p>
                    <p className="mt-0.5 text-[11px] font-semibold text-white/82">
                      {itemReason.label}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-white/68">
                      {itemReason.reason}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {explanationDetails?.outfit_reason && (
              <p className="rounded-lg border border-emerald-200/15 bg-emerald-300/10 px-2.5 py-2 text-[11px] leading-relaxed text-emerald-50/82">
                {explanationDetails.outfit_reason}
              </p>
            )}
          </div>
        </div>
      )}

      {missing.length > 0 && (
        <div className="rounded-xl border border-amber-200/20 bg-amber-300/10 px-3 py-2">
          <p className="text-[11px] leading-relaxed text-amber-50/85">
            Missing: {missing.join(", ")}. Add more items or adjust tags.
          </p>
        </div>
      )}
    </div>
  );
}
