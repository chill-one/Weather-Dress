export type OutfitCategory = "upper" | "lower" | "accessories" | "shoes";

export type RecommendationScores = {
  vector: number;
  temp: number;
  rain: number;
  wind: number;
  comfort: number;
  final: number;
};

export type RecommendedItem = {
  id: string;
  label: string;
  category: OutfitCategory;
  image_url: string | null;
  brand: string | null;
  color: string | null;
  description: string | null;
  similarity: number;
  scores: RecommendationScores;
  reasons: string[];
  metadata?: {
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

export type OutfitRecommendation = {
  outfit: Record<OutfitCategory, RecommendedItem | null>;
  alternatives: Record<OutfitCategory, RecommendedItem[]>;
  explanation: string;
  explanation_details: {
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
  missing_categories: OutfitCategory[];
  weather_context: {
    temp_c: number | null;
    description: string | null;
    precip: string | null;
    wind: number | null;
    style: string | null;
    occasion: string | null;
  };
};
