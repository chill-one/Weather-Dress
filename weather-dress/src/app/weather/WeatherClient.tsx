// src/app/weather/WeatherClient.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import CLOUDS from "vanta/src/vanta.clouds";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { supabase, supabaseConfigError } from "@/src/app/lib/supabaseClient";
import { OutfitRecommendationGrid } from "./components/OutfitRecommendationGrid";
import type { OutfitRecommendation } from "./types/recommendations";

// ---------- TYPES ----------

type OutfitCategory = "upper" | "lower" | "accessories" | "shoes";

type WeatherRes = {
  source?: string;
  coords?: { lat: number; lon: number };
  units?: string;
  ok?: boolean;
  q?: string | null;
  lat?: number;
  lon?: number;
  current?: {
    dt: number;
    temp?: number;
    feels_like?: number;
    humidity?: number;
    wind_speed?: number;
    description?: string | null;
    icon?: string | null;
  };
  hourly?: any[];
  daily?: any[];
  alerts?: any[];
};

type WeatherEffectProps = {
  type?: string;
  backgroundImageUrl?: string; // keep optional so we don't have to pass it
  intesity?: number;
};

type OutfitItem = {
  id: string;
  label: string;
  image_url?: string | null;
  brand?: string | null;
  store_url?: string | null;
  description?: string | null;
  color?: string | null;
  category?: string | null;
  warmth_score?: number | null;
  water_resistance?: "none" | "resistant" | "waterproof" | null;
  wind_block?: "low" | "medium" | "high" | null;
  breathability?: "low" | "medium" | "high" | null;
  coverage_top?: "none" | "short_sleeve" | "long_sleeve" | "jacket" | null;
  coverage_bottom?: "shorts" | "full_length" | null;
  footwear_type?: "open" | "closed" | "boot" | null;
  min_temp_c?: number | null;
  max_temp_c?: number | null;
};
type OutfitSearchResult = {
  label: string;
  image_url?: string;
  brand?: string;
  store_url?: string;
  description?: string | null;
  color?: string | null;
};

type OutfitImageAnalysis = {
  category?: OutfitCategory | null;
  label?: string | null;
  description?: string | null;
  color?: string | null;
  brand?: string | null;
  water_resistance?: "none" | "resistant" | "waterproof" | null;
  wind_block?: "low" | "medium" | "high" | null;
  breathability?: "low" | "medium" | "high" | null;
  coverage_top?: "none" | "short_sleeve" | "long_sleeve" | "jacket" | null;
  coverage_bottom?: "shorts" | "full_length" | null;
  footwear_type?: "open" | "closed" | "boot" | null;
  warmth_score?: number | null;
  min_temp_c?: number | null;
  max_temp_c?: number | null;
  confidence?: number;
  source?: "vision" | "fallback";
};

type SupabaseStorageError = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string;
};

const tempColorClass = (temp: number | undefined | null, units: "imperial" | "metric") => {
  if (temp == null || Number.isNaN(temp)) return "text-white";
  const f = units === "imperial" ? temp : (temp * 9) / 5 + 32;
  if (f <= 32) return "text-cyan-200";
  if (f <= 55) return "text-sky-200";
  if (f <= 75) return "text-white";
  if (f <= 85) return "text-amber-200";
  return "text-rose-300";
};

const STYLE_OPTIONS = ["casual", "athletic", "smart casual", "formal", "streetwear"];
const OCCASION_OPTIONS = ["everyday", "class", "gym", "interview", "rain commute", "cold weather"];

function displayChipLabel(value: string) {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function toCelsius(temp: number | null, units: "imperial" | "metric") {
  if (temp == null || Number.isNaN(temp)) return null;
  return units === "imperial" ? ((temp - 32) * 5) / 9 : temp;
}

function toMetersPerSecond(wind: number | null | undefined, units: "imperial" | "metric") {
  if (wind == null || Number.isNaN(wind)) return null;
  return units === "imperial" ? wind * 0.44704 : wind;
}

function isOneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function clampRounded(value: unknown, min: number, max: number) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(numericValue)) return null;
  return Math.min(max, Math.max(min, Math.round(numericValue)));
}

function supabaseStorageMessage(action: string, error?: SupabaseStorageError) {
  if (supabaseConfigError) {
    return `${supabaseConfigError} Add the keys to weather-dress/.env.local and restart Next.js.`;
  }

  const message = error?.message ?? "";
  const diagnostic = `${message} ${error?.details ?? ""} ${error?.hint ?? ""}`.toLowerCase();

  if (
    diagnostic.includes("failed to fetch") ||
    diagnostic.includes("enotfound") ||
    diagnostic.includes("networkerror")
  ) {
    return "Wardrobe storage is unreachable. Check NEXT_PUBLIC_SUPABASE_URL, confirm the Supabase project is active, then restart Next.js.";
  }

  if (
    diagnostic.includes("does not exist") ||
    diagnostic.includes("schema cache") ||
    diagnostic.includes("could not find")
  ) {
    return "Supabase is missing the outfit_items table. Run supabase/migrations/0001_outfit_items_and_match.sql against the project.";
  }

  if (
    diagnostic.includes("permission denied") ||
    diagnostic.includes("row-level security") ||
    diagnostic.includes("rls")
  ) {
    return "Supabase rejected wardrobe access. Re-run the migration so anon/auth roles can read and manage outfit_items.";
  }

  return message ? `Could not ${action}: ${message}` : `Could not ${action}. Check Supabase configuration.`;
}

// ---------- BACKGROUND GRADIENT + VANTA CONFIG ----------

const BG = {
  clearDay: "from-sky-200 to-blue-500",
  clearNight: "from-slate-900 to-indigo-950",
  cloudsDay: "from-slate-200 to-slate-400",
  cloudsNight: "from-slate-800 to-slate-950",
  rainDay: "from-slate-300 to-sky-500",
  rainNight: "from-slate-900 to-slate-800",
  drizzleDay: "from-slate-200 to-sky-300",
  drizzleNight: "from-slate-900 to-slate-800",
  thunderDay: "from-indigo-300 to-purple-600",
  thunderNight: "from-indigo-900 to-purple-950",
  snowDay: "from-slate-100 to-cyan-200",
  snowNight: "from-slate-800 to-cyan-900",
  fogDay: "from-zinc-200 to-zinc-400",
  fogNight: "from-zinc-900 to-zinc-800",
  defaultLight: "from-white to-neutral-50",
  defaultDark: "dark:from-neutral-950 dark:to-neutral-900",
} as const;

const defaultCloudsOptions = {
  gyroControls: false,
  cloudShadowColor: 0x1b314a,
  sunColor: 0x646425,
  sunGlareColor: 0xbbabab,
  sunlightColor: 0x8c6d51,
};

function pickBgFromIcon(icon?: string | null): string {
  const code = icon ?? "01d";
  const isDay = code.endsWith("d");
  const prefix = code.slice(0, 2); // "01", "02", "03", ..., "50"

  if (prefix === "11") return isDay ? BG.thunderDay : BG.thunderNight;
  if (prefix === "09" || prefix === "10")
    return isDay ? BG.rainDay : BG.rainNight;
  if (prefix === "13") return isDay ? BG.snowDay : BG.snowNight;
  if (prefix === "50") return isDay ? BG.fogDay : BG.fogNight;
  if (["02", "03", "04"].includes(prefix))
    return isDay ? BG.cloudsDay : BG.cloudsNight;
  if (prefix === "01") return isDay ? BG.clearDay : BG.clearNight;

  return `${BG.defaultLight} ${BG.defaultDark}`;
}

function cloudsOptionsForWeather(w: WeatherRes | null) {
  const icon = w?.current?.icon ?? "01d";
  const prefix = icon.slice(0, 2);
  const isDay = icon.endsWith("d");

  if (prefix === "11") {
    // thunderstorm-ish
    return {
      ...defaultCloudsOptions,
      cloudShadowColor: 0x050520,
      sunColor: 0xff8800,
      sunGlareColor: 0xffcc88,
      sunlightColor: 0x884422,
    };
  }

  if (!isDay) {
    // night-ish
    return {
      ...defaultCloudsOptions,
      cloudShadowColor: 0x0b1220,
      sunColor: 0x243255,
      sunGlareColor: 0x8888aa,
      sunlightColor: 0x445577,
    };
  }

  // daytime default
  return {
    ...defaultCloudsOptions,
    cloudShadowColor: 0x1b314a,
    sunColor: 0xfff3c0,
    sunGlareColor: 0xffffff,
    sunlightColor: 0xffe0a0,
  };
}


// ----------- HOOK HELPERS FOR SUPABASE OUTFIT STORAGE -----------
async function fetchOutfits(userKey: string) {
  if (!supabase) throw new Error(supabaseStorageMessage("load wardrobe"));

  const { data, error } = await supabase
    .from("outfit_items")
    .select("*")
    .eq("user_key", userKey)
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(supabaseStorageMessage("load wardrobe", error));
  }
  return data;
}

async function addOutfit(
  userKey: string,
  category: OutfitCategory,
  label: string,
  extras?: {
    image_url?: string;
    brand?: string;
    store_url?: string;
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
  }
) {
  if (!supabase) throw new Error(supabaseStorageMessage("save item"));

  const { data, error } = await supabase
    .from("outfit_items")
    .insert([{ user_key: userKey, category, label, ...(extras || {}) }])
    .select()
    .single();
  if (error) {
    throw new Error(supabaseStorageMessage("save item", error));
  }
  return data;
}

async function removeOutfit(id: string) {
  if (!supabase) throw new Error(supabaseStorageMessage("remove item"));

  const { error } = await supabase.from("outfit_items").delete().eq("id", id);
  if (error) {
    throw new Error(supabaseStorageMessage("remove item", error));
  }
}

// ---------- DYNAMIC IMPORTS FOR RAIN / SNOW / FOG EFFECTS ----------

const RainEffect = dynamic<WeatherEffectProps>(
  () => import("./effects/rain/RainEffect"),
  { ssr: false }
);

const SnowEffect = dynamic<WeatherEffectProps>(
  () => import("./effects/snow/SnowEffect"),
  { ssr: false }
);

const FogEffect = dynamic<WeatherEffectProps>(
  () => import("./effects/fog/FogEffect"),
  { ssr: false }
);

// ---------- MAP WEATHER -> EFFECT FAMILY + VARIANT ----------

function pickEffectConfig(
  weather: WeatherRes | null
): { kind: "rain" | "snow" | "fog" | null; type?: string } {
  if (!weather?.current) return { kind: null };

  const icon = weather.current.icon ?? "01d";
  const prefix = icon.slice(0, 2);
  const desc = (weather.current.description ?? "").toLowerCase();

  // SNOW
  if (prefix === "13" || desc.includes("snow") || desc.includes("sleet")) {
    if (
      desc.includes("storm") ||
      desc.includes("blizzard") ||
      desc.includes("heavy")
    ) {
      return { kind: "snow", type: "Storm" };
    }
    return { kind: "snow", type: "Gentle" };
  }

  // RAIN
  if (
    prefix === "09" ||
    prefix === "10" ||
    prefix === "11" ||
    desc.includes("rain") ||
    desc.includes("drizzle") ||
    desc.includes("thunderstorm")
  ) {
    if (desc.includes("drizzle")) {
      return { kind: "rain", type: "Drizzle" };
    }

    if (prefix === "11" || desc.includes("thunderstorm") || desc.includes("storm")) {
      return { kind: "rain", type: "Storm" };
    }

    if (desc.includes("shower") || desc.includes("heavy") || desc.includes("downpour")) {
      return { kind: "rain", type: "Fallout" };
    }

    return { kind: "rain", type: "Rain" };
  }

  // FOG
  if (
    prefix === "50" ||
    desc.includes("fog") ||
    desc.includes("mist") ||
    desc.includes("haze") ||
    desc.includes("smoke")
  ) {
    if (
      desc.includes("dense") ||
      desc.includes("smoke") ||
      desc.includes("thick") ||
      desc.includes("heavy")
    ) {
      return { kind: "fog", type: "Dense" };
    }
    return { kind: "fog", type: "Light" };
  }

  return { kind: null };
}

function formatDayLabel(date: Date, idx: number) {
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

// ---------- COMPONENT ----------

export default function WeatherClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const latParam = searchParams.get("lat");
  const lonParam = searchParams.get("lon");
  const name = searchParams.get("name") ?? "Selected location";
  const unitsParam = searchParams.get("units");
  const units: "imperial" | "metric" =
    unitsParam === "metric" ? "metric" : "imperial";

  // URL overrides for testing (e.g. ?forceKind=rain&forceType=Storm)
  const fk = searchParams.get("forceKind");
  const forceKindParam =
    fk === "rain" || fk === "snow" || fk === "fog" ? fk : null;

  const forceTypeParam = searchParams.get("forceType") || undefined;

  const [bg, setBg] = useState<string>(`${BG.defaultLight} ${BG.defaultDark}`);
  const [weather, setWeather] = useState<WeatherRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWeekly, setShowWeekly] = useState(false);
  const [showWeeklyPanel, setShowWeeklyPanel] = useState(false);
  const [upperItems, setUpperItems] = useState<OutfitItem[]>([]);
  const [lowerItems, setLowerItems] = useState<OutfitItem[]>([]);
  const [accessoriesItems, setAccessoriesItems] = useState<OutfitItem[]>([]);
  const [shoesItems, setShoesItems] = useState<OutfitItem[]>([]);
  const [userKey, setUserKey] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("outfit_user_key") || "";
  });
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchCategory, setSearchCategory] = useState<OutfitCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<OutfitSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [pendingItem, setPendingItem] = useState<OutfitSearchResult | null>(null);
  const [pendingCategory, setPendingCategory] = useState<OutfitCategory | null>(null);
  const [pendingLabel, setPendingLabel] = useState("");
  const [pendingBrand, setPendingBrand] = useState("");
  const [pendingDescription, setPendingDescription] = useState("");
  const [pendingWarmth, setPendingWarmth] = useState(5);
  const [pendingWater, setPendingWater] = useState<"none" | "resistant" | "waterproof">("none");
  const [pendingWind, setPendingWind] = useState<"low" | "medium" | "high">("low");
  const [pendingBreath, setPendingBreath] = useState<"low" | "medium" | "high">("medium");
  const [pendingTop, setPendingTop] = useState<"none" | "short_sleeve" | "long_sleeve" | "jacket">("short_sleeve");
  const [pendingBottom, setPendingBottom] = useState<"shorts" | "full_length">("full_length");
  const [pendingFoot, setPendingFoot] = useState<"open" | "closed" | "boot">("closed");
  const [pendingTempMin, setPendingTempMin] = useState(10);
  const [pendingTempMax, setPendingTempMax] = useState(20);
  const [pendingColor, setPendingColor] = useState("");
  const [analyzingItemImage, setAnalyzingItemImage] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const analysisRequestRef = useRef(0);
  const [selectedStyle, setSelectedStyle] = useState("casual");
  const [selectedOccasion, setSelectedOccasion] = useState("everyday");
  const [recommendedByDay, setRecommendedByDay] = useState<Record<number, OutfitRecommendation>>({});
  const [recommending, setRecommending] = useState(false);
  const [reembedding, setReembedding] = useState(false);
  const [reembedMessage, setReembedMessage] = useState<string | null>(null);
  const [wardrobeError, setWardrobeError] = useState<string | null>(null);

  const syncOutfitState = (rows: any[]) => {
    setUpperItems(
      rows
        .filter((r) => r.category === "upper")
        .map((r) => ({
          id: r.id,
          label: r.label,
          category: "upper",
          image_url: (r as any).image_url ?? null,
          brand: (r as any).brand ?? null,
          store_url: (r as any).store_url ?? null,
          color: (r as any).color ?? null,
          description: (r as any).description ?? null,
          warmth_score: (r as any).warmth_score ?? null,
          water_resistance: (r as any).water_resistance ?? null,
          wind_block: (r as any).wind_block ?? null,
          breathability: (r as any).breathability ?? null,
          coverage_top: (r as any).coverage_top ?? null,
          coverage_bottom: (r as any).coverage_bottom ?? null,
          footwear_type: (r as any).footwear_type ?? null,
          min_temp_c: (r as any).min_temp_c ?? null,
          max_temp_c: (r as any).max_temp_c ?? null,
        }))
    );
    setLowerItems(
      rows
        .filter((r) => r.category === "lower")
        .map((r) => ({
          id: r.id,
          label: r.label,
          category: "lower",
          image_url: (r as any).image_url ?? null,
          brand: (r as any).brand ?? null,
          store_url: (r as any).store_url ?? null,
          color: (r as any).color ?? null,
          description: (r as any).description ?? null,
          warmth_score: (r as any).warmth_score ?? null,
          water_resistance: (r as any).water_resistance ?? null,
          wind_block: (r as any).wind_block ?? null,
          breathability: (r as any).breathability ?? null,
          coverage_top: (r as any).coverage_top ?? null,
          coverage_bottom: (r as any).coverage_bottom ?? null,
          footwear_type: (r as any).footwear_type ?? null,
          min_temp_c: (r as any).min_temp_c ?? null,
          max_temp_c: (r as any).max_temp_c ?? null,
        }))
    );
    setAccessoriesItems(
      rows
        .filter((r) => r.category === "accessories")
        .map((r) => ({
          id: r.id,
          label: r.label,
          category: "accessories",
          image_url: (r as any).image_url ?? null,
          brand: (r as any).brand ?? null,
          store_url: (r as any).store_url ?? null,
          color: (r as any).color ?? null,
          description: (r as any).description ?? null,
          warmth_score: (r as any).warmth_score ?? null,
          water_resistance: (r as any).water_resistance ?? null,
          wind_block: (r as any).wind_block ?? null,
          breathability: (r as any).breathability ?? null,
          coverage_top: (r as any).coverage_top ?? null,
          coverage_bottom: (r as any).coverage_bottom ?? null,
          footwear_type: (r as any).footwear_type ?? null,
          min_temp_c: (r as any).min_temp_c ?? null,
          max_temp_c: (r as any).max_temp_c ?? null,
        }))
    );
    setShoesItems(
      rows
        .filter((r) => r.category === "shoes")
        .map((r) => ({
          id: r.id,
          label: r.label,
          category: "shoes",
          image_url: (r as any).image_url ?? null,
          brand: (r as any).brand ?? null,
          store_url: (r as any).store_url ?? null,
          color: (r as any).color ?? null,
          description: (r as any).description ?? null,
          warmth_score: (r as any).warmth_score ?? null,
          water_resistance: (r as any).water_resistance ?? null,
          wind_block: (r as any).wind_block ?? null,
          breathability: (r as any).breathability ?? null,
          coverage_top: (r as any).coverage_top ?? null,
          coverage_bottom: (r as any).coverage_bottom ?? null,
          footwear_type: (r as any).footwear_type ?? null,
          min_temp_c: (r as any).min_temp_c ?? null,
          max_temp_c: (r as any).max_temp_c ?? null,
        }))
    );
  };

  const buildItemText = (item: Partial<OutfitItem>, category: OutfitCategory) => {
    const parts = [
      `label: ${item.label ?? ""}`,
      `category: ${category}`,
      item.description ? `description: ${item.description}` : "",
      item.color ? `color: ${item.color}` : "",
      item.brand ? `brand: ${item.brand}` : "",
      item.water_resistance ? `water: ${item.water_resistance}` : "",
      item.wind_block ? `wind: ${item.wind_block}` : "",
      item.breathability ? `breathability: ${item.breathability}` : "",
      item.coverage_top ? `coverage_top: ${item.coverage_top}` : "",
      item.coverage_bottom ? `coverage_bottom: ${item.coverage_bottom}` : "",
      item.footwear_type ? `footwear: ${item.footwear_type}` : "",
      item.warmth_score != null ? `warmth: ${item.warmth_score}` : "",
      item.min_temp_c != null ? `min_temp: ${item.min_temp_c}` : "",
      item.max_temp_c != null ? `max_temp: ${item.max_temp_c}` : "",
    ];
    return parts.filter(Boolean).join(". ");
  };

  const outfitSections: Array<{
    title: string;
    kind: OutfitCategory;
    items: OutfitItem[];
  }> = [
    { title: "Upper", kind: "upper", items: upperItems },
    { title: "Lower", kind: "lower", items: lowerItems },
    { title: "Accessories", kind: "accessories", items: accessoriesItems },
    { title: "Shoes", kind: "shoes", items: shoesItems },
  ];

  // Animation timing (ms). Adjust here to change speed globally.
  const layoutDuration = 350;

  const [effectKind, setEffectKind] = useState<"rain" | "snow" | "fog" | null>(
    null
  );
  const [effectType, setEffectType] = useState<string | undefined>(undefined);

  // Vanta refs
  const vantaRef = useRef<HTMLDivElement | null>(null);
  const vantaEffect = useRef<any>(null);

  // Init Vanta clouds
  useEffect(() => {
    if (!vantaRef.current) return;

    vantaEffect.current = CLOUDS({
      el: vantaRef.current,
      THREE,
      ...defaultCloudsOptions,
    });

    return () => {
      vantaEffect.current?.destroy?.();
    };
  }, []);

  // Fetch weather + update bg, vanta, and effect
  useEffect(() => {
    if (!latParam || !lonParam) {
      setError("Missing location. Go back and pick a place again.");
      setLoading(false);
      return;
    }

    const lat = latParam;
    const lon = lonParam;

    let intervalId: number | undefined;

    async function fetchWeatherOnce() {
      try {
        setError(null);

        const params = new URLSearchParams();
        params.set("lat", lat);
        params.set("lon", lon);
        params.set("units", units);

        const url = `/api/weather/openweather?${params.toString()}`;
        console.log("Requesting weather from:", url);

        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);

        const data: WeatherRes = await res.json();
        console.log("Weather data on /weather page:", data);

        setWeather(data);

        // gradient tint
        setBg(pickBgFromIcon(data.current?.icon));

        // update Vanta cloud colors
        const newClouds = cloudsOptionsForWeather(data);
        if (vantaEffect.current?.setOptions) {
          vantaEffect.current.setOptions(newClouds);
        }

        // pick particle effect
        const cfg = pickEffectConfig(data);
        setEffectKind(cfg.kind);
        setEffectType(cfg.type);
      } catch (err) {
        console.error(err);
        setError("Couldn't load weather for this location.");
      } finally {
        setLoading(false);
      }
    }

    setLoading(true);
    fetchWeatherOnce();

    intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetchWeatherOnce();
    }, 5 * 60 * 1000);

    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [latParam, lonParam, units]);

  // Ensure we have a stable userKey (guest UUID)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!userKey) {
      const key = crypto.randomUUID();
      localStorage.setItem("outfit_user_key", key);
      setUserKey(key);
    }
  }, [userKey]);

  // Fetch outfits from Supabase
  useEffect(() => {
    if (!userKey || !showWeeklyPanel) return;
    fetchOutfits(userKey)
      .then((rows) => {
        setWardrobeError(null);
        syncOutfitState(rows);
      })
      .catch((err: Error) => setWardrobeError(err.message));
  }, [userKey, showWeeklyPanel]);

  // Realtime updates for outfits (Supabase)
  useEffect(() => {
    const supabaseClient = supabase;
    if (!userKey || !showWeeklyPanel || !supabaseClient) return;

    const channel = supabaseClient
      .channel("outfit-items-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "outfit_items",
          filter: `user_key=eq.${userKey}`,
        },
        () => {
          fetchOutfits(userKey)
            .then((rows) => {
              setWardrobeError(null);
              syncOutfitState(rows);
            })
            .catch((err: Error) => setWardrobeError(err.message));
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [userKey, showWeeklyPanel]);

  // Fetch recommendations for the next 7 days when weekly panel opens
  useEffect(() => {
    const loadRecommendations = async () => {
      if (!showWeeklyPanel || !weather?.daily?.length || !userKey) return;
      setRecommending(true);
      setRecommendedByDay({});
      try {
        const requests = weather.daily.slice(0, 7).map((day: any, idx: number) => {
          const avgDisplayTemp =
            day?.temp && typeof day.temp === "object"
              ? (day.temp.min + day.temp.max) / 2
              : day?.min != null && day?.max != null
              ? (day.min + day.max) / 2
              : null;
          const avgTempC = toCelsius(avgDisplayTemp, units);
          const description =
            day?.weather?.[0]?.description ??
            day?.summary ??
            weather.current?.description ??
            "weather-based outfit";
          const precip = day?.pop != null ? `${Math.round(day.pop * 100)}% precip` : undefined;
          const wind = toMetersPerSecond(day?.wind_speed ?? weather.current?.wind_speed, units);

          return fetch("/api/outfits/recommend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_key: userKey,
              temp_c: avgTempC,
              description,
              precip,
              wind,
              style: selectedStyle,
              occasion: selectedOccasion,
            }),
          })
            .then((res) => res.json())
            .then((res) => ({ idx, recommendation: res as OutfitRecommendation }))
            .catch(() => ({ idx, recommendation: null }));
        });

        const results = await Promise.all(requests);
        const mapped: Record<number, OutfitRecommendation> = {};
        results.forEach(({ idx, recommendation }) => {
          if (recommendation?.outfit && recommendation?.alternatives) {
            mapped[idx] = recommendation;
          }
        });
        setRecommendedByDay(mapped);
      } finally {
        setRecommending(false);
      }
    };

    loadRecommendations();
  }, [showWeeklyPanel, weather, userKey, selectedStyle, selectedOccasion, units]);

  // Defer panel showing until layout animation finishes
  useEffect(() => {
    if (showWeekly) {
      const id = setTimeout(() => setShowWeeklyPanel(true), layoutDuration);
      return () => clearTimeout(id);
    }
    setShowWeeklyPanel(false);
  }, [showWeekly]);

  // Apply overrides (for testing)
  const finalKind = forceKindParam ?? effectKind;
  const finalType = forceTypeParam ?? effectType;
  console.log("Effect debug", {
    forceKindParam,
    forceTypeParam,
    effectKind,
    effectType,
    finalKind,
    finalType,
  });
  
  const weeklyButtonLabel = showWeeklyPanel
    ? "Hide weekly forecast"
    : "Show weekly forecast";

  const currentTempF =
    weather?.current?.temp != null
      ? units === "imperial"
        ? weather.current.temp
        : (weather.current.temp * 9) / 5 + 32
      : null;
  const clampedPercent = (() => {
    if (currentTempF == null || Number.isNaN(currentTempF)) return 50;
    const min = -10;
    const max = 100;
    return Math.min(100, Math.max(0, ((currentTempF - min) / (max - min)) * 100));
  })();

  const handleToggleWeekly = () => {
    if (!weather?.daily?.length) return;
    const next = !showWeekly;
    setShowWeekly(next);
    setShowWeeklyPanel(false);
  };

  const handleRemoveItem = async (kind: OutfitCategory, id: string) => {
    try {
      await removeOutfit(id);
      const remove = (items: OutfitItem[]) => items.filter((i) => i.id !== id);
      switch (kind) {
        case "upper":
          setUpperItems(remove);
          break;
        case "lower":
          setLowerItems(remove);
          break;
        case "accessories":
          setAccessoriesItems(remove);
          break;
        case "shoes":
          setShoesItems(remove);
          break;
      }
    } catch (err) {
      setWardrobeError(err instanceof Error ? err.message : "Unable to remove item.");
    }
  };

  const openSearch = (kind: OutfitCategory) => {
    setSearchCategory(kind);
    setShowSearchModal(true);
    setSearchResults([]);
    setSearchQuery("");
    setSearchError(null);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(
        `/api/outfits/search?q=${encodeURIComponent(searchQuery)}&category=${searchCategory ?? ""}`
      );
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      const body = await res.json();
      setSearchResults(body.items ?? []);
    } catch (err: any) {
      console.error("search outfits", err);
      setSearchError("Search failed. Try again.");
      // fallback demo data
      setSearchResults([
        {
          label: `${searchQuery} (demo)`,
          image_url: "https://via.placeholder.com/128?text=Item",
          brand: "Demo Brand",
          store_url: "https://example.com",
        },
      ]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSearchResult = async (item: OutfitSearchResult) => {
    const selectedCategory = searchCategory;
    if (!selectedCategory) return;
    const requestId = analysisRequestRef.current + 1;
    analysisRequestRef.current = requestId;

    setPendingCategory(selectedCategory);
    setPendingItem(item);
    setPendingLabel(item.label);
    setPendingBrand(item.brand ?? "");
    setPendingDescription(item.description ?? "");
    setPendingColor(item.color ?? "");
    setPendingWarmth(5);
    setPendingWater("none");
    setPendingWind("low");
    setPendingBreath("medium");
    setPendingTop("short_sleeve");
    setPendingBottom("full_length");
    setPendingFoot("closed");
    setPendingTempMin(10);
    setPendingTempMax(20);
    setAnalyzingItemImage(false);
    setAnalysisMessage(null);
    setShowDetailsModal(true);

    if (!item.image_url) {
      setAnalysisMessage("No product image available; default tags applied.");
      return;
    }

    setAnalyzingItemImage(true);
    try {
      const res = await fetch("/api/outfits/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: item.image_url,
          label: item.label,
          description: item.description ?? null,
          brand: item.brand ?? null,
          category_hint: selectedCategory,
        }),
      });
      const analysis = (await res.json()) as OutfitImageAnalysis & { error?: string };
      if (!res.ok) throw new Error(analysis?.error || "Image analysis failed");
      if (analysisRequestRef.current !== requestId) return;

      if (analysis.label) setPendingLabel(analysis.label);
      if (analysis.brand) setPendingBrand(analysis.brand);
      let nextCategory = selectedCategory;
      if (isOneOf(["upper", "lower", "accessories", "shoes"] as const, analysis.category)) {
        nextCategory = analysis.category;
        setPendingCategory(analysis.category);
      }
      if (analysis.description) setPendingDescription(analysis.description);
      if (analysis.color) setPendingColor(analysis.color);
      if (isOneOf(["none", "resistant", "waterproof"] as const, analysis.water_resistance)) {
        setPendingWater(analysis.water_resistance);
      }
      if (isOneOf(["low", "medium", "high"] as const, analysis.wind_block)) {
        setPendingWind(analysis.wind_block);
      }
      if (isOneOf(["low", "medium", "high"] as const, analysis.breathability)) {
        setPendingBreath(analysis.breathability);
      }
      if (isOneOf(["none", "short_sleeve", "long_sleeve", "jacket"] as const, analysis.coverage_top)) {
        setPendingTop(analysis.coverage_top);
      }
      if (isOneOf(["shorts", "full_length"] as const, analysis.coverage_bottom)) {
        setPendingBottom(analysis.coverage_bottom);
      }
      if (isOneOf(["open", "closed", "boot"] as const, analysis.footwear_type)) {
        setPendingFoot(analysis.footwear_type);
      }

      const warmth = clampRounded(analysis.warmth_score, 1, 10);
      if (warmth != null) setPendingWarmth(warmth);

      const minTemp = clampRounded(analysis.min_temp_c, -20, 50);
      const maxTemp = clampRounded(analysis.max_temp_c, -20, 50);
      if (minTemp != null || maxTemp != null) {
        const nextMin = minTemp ?? 10;
        const nextMax = maxTemp ?? 20;
        setPendingTempMin(Math.min(nextMin, nextMax));
        setPendingTempMax(Math.max(nextMin, nextMax));
      }

      const categoryNote =
        nextCategory !== selectedCategory
          ? ` Category changed to ${nextCategory}.`
          : "";
      setAnalysisMessage(
        analysis.source === "vision"
          ? `Image tags applied${categoryNote}`
          : "Image analysis unavailable; default tags applied."
      );
    } catch (err) {
      if (analysisRequestRef.current !== requestId) return;
      console.error("analyze outfit image", err);
      setAnalysisMessage("Image analysis unavailable; default tags applied.");
    } finally {
      if (analysisRequestRef.current === requestId) {
        setAnalyzingItemImage(false);
      }
    }
  };

  const renderOutfitRow = (title: string, kind: OutfitCategory, items: OutfitItem[]) => (
    <div key={title} className="space-y-1 pb-1">
      <p className="text-xs uppercase tracking-[0.15em] text-white/55 flex items-center gap-1">
        <span className="text-[11px]">
          {kind === "upper" ? "👕" : kind === "lower" ? "👖" : kind === "accessories" ? "🧢" : "👟"}
        </span>
        {title}
      </p>

      <div className="flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => openSearch(kind)}
          className="h-8 w-8 rounded-full border border-white/40 bg-white/20 text-white text-sm font-semibold leading-none flex items-center justify-center hover:bg-white/30 transition"
          aria-label={`Add ${title}`}
        >
          +
        </button>

        {items.map((item) => (
          <div key={item.id} className="flex flex-col items-center gap-1">
            <div
              className="h-12 w-12 rounded-full border border-white/15 bg-gradient-to-br from-white/15 to-white/5 flex items-center justify-center text-[10px] text-white/80 text-center px-1.5 overflow-hidden hover:border-white/40 hover:bg-white/20 transition-transform hover:-translate-y-0.5"
              title={item.label}
            >
              {item.image_url ? (
                <img src={item.image_url} alt={item.label} className="h-full w-full object-contain rounded-md" />
              ) : (
                <span className="line-clamp-2 leading-tight">{item.label}</span>
              )}
            </div>
            <button
              onClick={() => handleRemoveItem(kind, item.id)}
              className="text-[10px] px-2 py-0.5 rounded-full border border-white/20 text-white/70 hover:bg-white/10 transition"
              aria-label={`Remove ${item.label}`}
            >
              ×
            </button>
          </div>
        ))}

        {!items.length && <p className="text-xs text-white/60">No items yet</p>}
      </div>
    </div>
  );

  const handleReembedAll = async () => {
    if (!userKey) return;
    setReembedding(true);
    setReembedMessage(null);
    try {
      const res = await fetch("/api/outfits/reembed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_key: userKey }),
      });
      const js = await res.json();
      if (js?.message) setReembedMessage(js.message);
    } catch (err: any) {
      setReembedMessage("Failed to re-embed items");
      console.error("reembed click error", err);
    } finally {
      setReembedding(false);
    }
  };

  const renderSearchModal = () => {
    if (!showSearchModal) return null;

    return (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur" onClick={() => setShowSearchModal(false)} />

        <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-white/20 bg-black/80 text-white shadow-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Add item to {searchCategory}</h3>
            <button onClick={() => setShowSearchModal(false)} className="text-sm text-white/70 hover:text-white">
              Close
            </button>
          </div>

          <div className="flex gap-3">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search (e.g., black Nike hoodie)"
              className="flex-1 rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-4 py-2 rounded-lg bg-white/15 border border-white/30 text-sm hover:bg-white/25 transition disabled:opacity-50"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </div>

          {searchError && <p className="text-xs text-red-300">{searchError}</p>}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
            {searchResults.map((item, idx) => (
              <button
                key={`${item.label}-${idx}`}
                onClick={() => handleSelectSearchResult(item)}
                className="group text-left rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition p-3 flex flex-col gap-2"
              >
                <div className="w-full aspect-square rounded-lg overflow-hidden bg-white/10 border border-white/10 flex items-center justify-center">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.label} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-white/70">No image</span>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-semibold line-clamp-2">{item.label}</p>
                  {item.brand && <p className="text-xs text-white/60">{item.brand}</p>}
                </div>
              </button>
            ))}

            {!searchResults.length && !searching && (
              <p className="text-xs text-white/60">Search to see results.</p>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  // ---------- RENDER ----------

  return (
    <main className="relative min-h-screen overflow-hidden">
        {/* DEBUG BADGE */}
        {finalKind && (
        <div className="absolute top-4 right-4 z-[9999] bg-black/80 text-xs text-lime-300 px-3 py-1 rounded">
            Effect: {finalKind} ({finalType ?? "default"})
        </div>
        )}


      {/* 1) Vanta clouds base background */}
      <div ref={vantaRef} className="absolute inset-0 z-0" />

      {/* 2) Gradient tint based on weather icon */}
      <div
        className={`absolute inset-0 z-10 bg-gradient-to-b ${bg} opacity-25 pointer-events-none`}
      />

      {/* 3) Weather particles overlay (rain / snow / fog) */}
      <div className="absolute inset-0 z-20">
        {finalKind === "rain" && (
          <RainEffect type={finalType ?? "Rain"} />
        )}

        {finalKind === "snow" && (
          <SnowEffect type={finalType ?? "Gentle"} />
        )}

        {finalKind === "fog" && (
          <FogEffect type={finalType ?? "Light"} />
        )}
      </div>

      {/* 4) Content on top */}
      <div className="relative z-30 min-h-screen flex flex-col">
        <header className="pt-6 px-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="text-sm px-3 py-1.5 rounded-lg bg-black/60 border border-white/30 text-white shadow hover:bg-black/70 transition"
          >
            ← Change location
          </button>

          <span className="text-xs text-neutral-100/80">
            Units: {units === "imperial" ? "°F" : "°C"}
          </span>
        </header>

        <motion.section
          layout
          transition={{ layout: { duration: layoutDuration / 1000, ease: "easeInOut" } }}
          className={
            showWeekly
              ? "flex-1 px-5 py-8 flex flex-col gap-7 lg:flex-row lg:items-start lg:gap-8"
              : "flex-1 grid place-content-center px-5 py-8"
          }
        >
          {/* Temperature color legend */}
          {showWeeklyPanel && (
            <div className="absolute left-1/2 -translate-x-1/2 top-6 w-[min(760px,92vw)] text-white/70 text-[11px] z-20">
              <div className="rounded-xl border border-white/15 bg-black/60 backdrop-blur px-4 py-1.5 shadow-lg space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-cyan-100">≤32°F</span>
                  <span className="text-sky-100">55°F</span>
                  <span className="text-white">75°F</span>
                  <span className="text-amber-200 font-semibold">85°F+</span>
                </div>
                <div className="relative h-1.5 rounded-full overflow-hidden bg-white/10 border border-white/20">
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(90deg, #99f6e4 0%, #bae6fd 25%, #ffffff 50%, #fde68a 75%, #fecdd3 100%)",
                    }}
                  />
                  <div className="absolute left-1 text-lg top-1/2 -translate-y-1/2">❄️</div>
                  <div className="absolute right-1 text-lg top-1/2 -translate-y-1/2">🔥</div>
                  <div
                    className="absolute -top-[2px] h-2 w-2 rounded-full bg-amber-300 shadow"
                    style={{ left: `${clampedPercent}%`, transform: "translateX(-50%)" }}
                  />
                </div>
              </div>
            </div>
          )}

          <motion.div layout className="w-full max-w-[18rem] flex flex-col gap-4">
            <motion.div
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: layoutDuration / 1000 }}
              className="w-full rounded-xl border border-white/20 bg-black/70 text-white p-4 shadow-lg backdrop-blur"
            >
              {loading && (
                <p className="text-sm text-neutral-100/90">
                  Loading weather for{" "}
                  <span className="font-semibold">{name}</span>...
                </p>
              )}

              {error && (
                <p className="text-sm text-red-400">
                  {error}
                </p>
              )}

              {!loading && !error && weather && (
                <>
                  <h1 className="text-xl font-semibold mb-1">
                    {name}
                  </h1>

                  <p className="text-xs text-neutral-100/70 mb-4 capitalize">
                    {weather.current?.description ?? "Current conditions"}
                  </p>

                  <div className="flex items-baseline gap-2 mb-4">
                    <span
                      className={`text-5xl font-bold ${tempColorClass(
                        weather.current?.temp != null ? Math.round(weather.current.temp) : null,
                        units
                      )}`}
                    >
                      {weather.current?.temp != null ? Math.round(weather.current.temp) : "--"}
                    </span>
                    <span className="text-lg">
                      {units === "imperial" ? "°F" : "°C"}
                    </span>
                  </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-neutral-100/70">
                          Feels like
                        </p>
                        <p
                          className={`font-semibold ${tempColorClass(
                            weather.current?.feels_like != null ? Math.round(weather.current.feels_like) : null,
                            units
                          )}`}
                        >
                          {weather.current?.feels_like != null ? Math.round(weather.current.feels_like) : "--"}
                          {weather.current?.feels_like != null && (units === "imperial" ? "°F" : "°C")}
                        </p>
                      </div>

                      <div>
                        <p className="text-neutral-100/70">
                          Humidity
                        </p>
                        <p className="font-semibold">
                          {weather.current?.humidity != null
                            ? `${weather.current.humidity}%`
                            : "--"}
                        </p>
                      </div>

                      <div>
                        <p className="text-neutral-100/70">
                          Wind speed
                        </p>
                        <p className="font-semibold">
                          {weather.current?.wind_speed != null
                            ? `${weather.current.wind_speed} ${
                                units === "imperial" ? "mph" : "m/s"
                              }`
                            : "--"}
                        </p>
                      </div>
                    </div>
                </>
              )}
            </motion.div>

            <div className="flex justify-start w-full">
              <button
                disabled={!weather?.daily?.length}
                onClick={handleToggleWeekly}
                className="text-sm w-full max-w-md px-5 py-1 rounded-xl border border-white/30 bg-white/10 text-white/90 shadow hover:bg-white/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {weeklyButtonLabel}
              </button>
        </div>

            {showWeeklyPanel && (
              <motion.div
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: layoutDuration / 1000 }}
                className="w-full rounded-2xl border border-white/20 bg-black/65 text-white shadow-lg backdrop-blur px-5 py-4 space-y-2 text-sm"
              >
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <p className="text-sm font-semibold flex items-center gap-2 tracking-[0.15em] text-white/65">
                    <span className="text-[12px]">🪄</span> Outfit picks
                  </p>
                  {reembedMessage && (
                    <span className="text-[11px] text-white/70">{reembedMessage}</span>
                  )}
                </div>
                {wardrobeError && (
                  <p className="rounded-lg border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                    {wardrobeError}
                  </p>
                )}
                <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/50">
                      Style
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {STYLE_OPTIONS.map((style) => {
                        const active = selectedStyle === style;
                        return (
                          <button
                            key={style}
                            onClick={() => setSelectedStyle(style)}
                            className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                              active
                                ? "border-white/45 bg-white/22 text-white"
                                : "border-white/15 bg-black/15 text-white/65 hover:bg-white/10"
                            }`}
                          >
                            {displayChipLabel(style)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/50">
                      Occasion
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {OCCASION_OPTIONS.map((occasion) => {
                        const active = selectedOccasion === occasion;
                        return (
                          <button
                            key={occasion}
                            onClick={() => setSelectedOccasion(occasion)}
                            className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                              active
                                ? "border-white/45 bg-white/22 text-white"
                                : "border-white/15 bg-black/15 text-white/65 hover:bg-white/10"
                            }`}
                          >
                            {displayChipLabel(occasion)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {outfitSections.map(({ title, kind, items }) => renderOutfitRow(title, kind, items))}
                <div className="flex justify-end">
                  <button
                    onClick={handleReembedAll}
                    className="text-[11px] px-2 py-1 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 transition text-white/80 disabled:opacity-50"
                    disabled={reembedding}
                  >
                    {reembedding ? "Re-embedding..." : "Re-embed all"}
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>

          {renderSearchModal()}
          {showDetailsModal && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center px-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-black/60 backdrop-blur" onClick={() => setShowDetailsModal(false)} />
              <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/20 bg-black/85 text-white shadow-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Item details</h3>
                  <button onClick={() => setShowDetailsModal(false)} className="text-sm text-white/70 hover:text-white">
                    Close
                  </button>
                </div>

                <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  {pendingItem?.image_url && (
                    <img
                      src={pendingItem.image_url}
                      alt={pendingLabel || pendingItem.label}
                      className="h-16 w-16 shrink-0 rounded-lg border border-white/10 bg-white/10 object-contain"
                    />
                  )}
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm text-white/85">
                      {pendingLabel || pendingItem?.label} {pendingCategory ? `-> ${pendingCategory}` : ""}
                    </p>
                    <p className="text-xs text-white/60">
                      {analyzingItemImage
                        ? "Analyzing search image..."
                        : analysisMessage ?? "Review the tags before saving."}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <label className="space-y-1">
                    <span className="text-white/70 text-xs">Label</span>
                    <input
                      value={pendingLabel}
                      onChange={(e) => setPendingLabel(e.target.value)}
                      placeholder="e.g., Black rain jacket"
                      className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-white/70 text-xs">Category</span>
                    <select
                      value={pendingCategory ?? "upper"}
                      onChange={(e) => setPendingCategory(e.target.value as OutfitCategory)}
                      className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white"
                    >
                      <option value="upper">Upper</option>
                      <option value="lower">Lower</option>
                      <option value="accessories">Accessories</option>
                      <option value="shoes">Shoes</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-white/70 text-xs">Brand / source</span>
                    <input
                      value={pendingBrand}
                      onChange={(e) => setPendingBrand(e.target.value)}
                      placeholder="Optional"
                      className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-white/70 text-xs">Color / variant</span>
                    <input
                      value={pendingColor}
                      onChange={(e) => setPendingColor(e.target.value)}
                      placeholder="e.g., Black, Navy, Beige"
                      className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-white/70 text-xs">Description</span>
                    <textarea
                      value={pendingDescription}
                      onChange={(e) => setPendingDescription(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                      placeholder="Optional"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-white/70 text-xs">Warmth score (1–10)</span>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={pendingWarmth}
                      onChange={(e) => setPendingWarmth(Number(e.target.value))}
                      className="w-full"
                    />
                    <span className="text-white/80 text-xs">Current: {pendingWarmth}</span>
                  </label>

                  <label className="space-y-1">
                    <span className="text-white/70 text-xs">Water resistance</span>
                    <select
                      value={pendingWater}
                      onChange={(e) => setPendingWater(e.target.value as any)}
                      className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white"
                    >
                      <option value="none">None</option>
                      <option value="resistant">Resistant</option>
                      <option value="waterproof">Waterproof</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-white/70 text-xs">Wind block</span>
                    <select
                      value={pendingWind}
                      onChange={(e) => setPendingWind(e.target.value as any)}
                      className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-white/70 text-xs">Breathability</span>
                    <select
                      value={pendingBreath}
                      onChange={(e) => setPendingBreath(e.target.value as any)}
                      className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>

                  {pendingCategory === "upper" && (
                    <label className="space-y-1">
                      <span className="text-white/70 text-xs">Coverage (top)</span>
                      <select
                        value={pendingTop}
                        onChange={(e) => setPendingTop(e.target.value as any)}
                        className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white"
                      >
                        <option value="none">None</option>
                        <option value="short_sleeve">Short sleeve</option>
                        <option value="long_sleeve">Long sleeve</option>
                        <option value="jacket">Jacket</option>
                      </select>
                    </label>
                  )}

                  {pendingCategory === "lower" && (
                    <label className="space-y-1">
                      <span className="text-white/70 text-xs">Coverage (bottom)</span>
                      <select
                        value={pendingBottom}
                        onChange={(e) => setPendingBottom(e.target.value as any)}
                        className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white"
                      >
                        <option value="shorts">Shorts</option>
                        <option value="full_length">Full length</option>
                      </select>
                    </label>
                  )}

                  {pendingCategory === "shoes" && (
                    <label className="space-y-1">
                      <span className="text-white/70 text-xs">Footwear type</span>
                      <select
                        value={pendingFoot}
                        onChange={(e) => setPendingFoot(e.target.value as any)}
                        className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white"
                      >
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                        <option value="boot">Boot</option>
                      </select>
                    </label>
                  )}

                  <div className="space-y-2 sm:col-span-2">
                    <div className="flex items-center justify-between text-white/70 text-xs">
                      <span className="flex items-center gap-2">
                        Preferred temperature range (°C)
                        <span className="text-lg">
                          {((pendingTempMin + pendingTempMax) / 2 || 0) < 5
                            ? "❄️"
                            : ((pendingTempMin + pendingTempMax) / 2 || 0) < 15
                            ? "🧥"
                            : ((pendingTempMin + pendingTempMax) / 2 || 0) < 25
                            ? "👕"
                            : "☀️"}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 text-white/60">
                        <span className="text-lg">❄️</span>
                        <span>colder</span>
                        <span className="text-lg">☀️</span>
                        <span>hotter</span>
                      </span>
                    </div>
                    <div className="space-y-1">
                      <label className="flex items-center gap-3">
                        <span className="text-white/60 text-xs w-16">Min</span>
                        <input
                          type="range"
                          min={-20}
                          max={50}
                          value={pendingTempMin}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setPendingTempMin(Math.min(v, pendingTempMax));
                          }}
                          className="flex-1"
                        />
                        <span className="text-white text-xs w-12 text-right">{pendingTempMin}°</span>
                      </label>
                      <label className="flex items-center gap-3">
                        <span className="text-white/60 text-xs w-16">Max</span>
                        <input
                          type="range"
                          min={-20}
                          max={50}
                          value={pendingTempMax}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setPendingTempMax(Math.max(v, pendingTempMin));
                          }}
                          className="flex-1"
                        />
                        <span className="text-white text-xs w-12 text-right">{pendingTempMax}°</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="px-4 py-2 rounded-lg border border-white/20 text-sm text-white/80 hover:bg-white/10 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!pendingItem || !pendingCategory || !userKey || analyzingItemImage) return;
                      const category = pendingCategory;
                      const itemLabel = pendingLabel.trim() || pendingItem.label;
                      const itemBrand = pendingBrand.trim() || null;
                      try {
                        // Build text and fetch embedding
                        const embedPayload: Partial<OutfitItem> = {
                          label: itemLabel,
                          description: pendingDescription || pendingItem.description || null,
                          color: pendingColor || null,
                          brand: itemBrand,
                          water_resistance: pendingWater,
                          wind_block: pendingWind,
                          breathability: pendingBreath,
                          coverage_top: pendingTop,
                          coverage_bottom: pendingBottom,
                          footwear_type: pendingFoot,
                          warmth_score: pendingWarmth,
                          min_temp_c: pendingTempMin,
                          max_temp_c: pendingTempMax,
                        };
                        let embedding: number[] | undefined;
                        try {
                          const res = await fetch("/api/outfits/embed", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ text: buildItemText(embedPayload, category) }),
                          });
                          const js = await res.json();
                          if (Array.isArray(js?.embedding)) embedding = js.embedding;
                        } catch (err) {
                          console.error("embedding fetch failed", err);
                        }

                        const row = await addOutfit(userKey, category, itemLabel, {
                          image_url: pendingItem.image_url,
                          brand: itemBrand ?? undefined,
                          store_url: pendingItem.store_url,
                          description: pendingDescription || pendingItem.description || null,
                          color: pendingColor || null,
                          warmth_score: pendingWarmth,
                          water_resistance: pendingWater,
                          wind_block: pendingWind,
                          breathability: pendingBreath,
                          coverage_top: pendingTop,
                          coverage_bottom: pendingBottom,
                          footwear_type: pendingFoot,
                          min_temp_c: pendingTempMin,
                          max_temp_c: pendingTempMax,
                          ...(embedding ? { embedding } : {}),
                        });
                        const entry: OutfitItem = {
                          id: row.id,
                          label: row.label,
                          category,
                          image_url: (row as any).image_url ?? pendingItem.image_url ?? null,
                          brand: (row as any).brand ?? itemBrand,
                          store_url: (row as any).store_url ?? pendingItem.store_url ?? null,
                          description: (row as any).description ?? pendingDescription ?? pendingItem.description ?? null,
                          color: (row as any).color ?? pendingColor ?? null,
                          warmth_score: (row as any).warmth_score ?? pendingWarmth,
                          water_resistance: (row as any).water_resistance ?? pendingWater,
                          wind_block: (row as any).wind_block ?? pendingWind,
                          breathability: (row as any).breathability ?? pendingBreath,
                          coverage_top: (row as any).coverage_top ?? pendingTop,
                          coverage_bottom: (row as any).coverage_bottom ?? pendingBottom,
                          footwear_type: (row as any).footwear_type ?? pendingFoot,
                          min_temp_c: (row as any).min_temp_c ?? pendingTempMin,
                          max_temp_c: (row as any).max_temp_c ?? pendingTempMax,
                        };
                        switch (category) {
                          case "upper":
                            setUpperItems((items) => [...items, entry]);
                            break;
                          case "lower":
                            setLowerItems((items) => [...items, entry]);
                            break;
                          case "accessories":
                            setAccessoriesItems((items) => [...items, entry]);
                            break;
                          case "shoes":
                            setShoesItems((items) => [...items, entry]);
                            break;
                        }
                        setShowDetailsModal(false);
                        setShowSearchModal(false);
                      } catch (err) {
                        const message = err instanceof Error ? err.message : "Unable to save item.";
                        setWardrobeError(message);
                        setSearchError(message);
                      }
                    }}
                    disabled={analyzingItemImage || !pendingItem || !pendingCategory || !userKey}
                    className="px-4 py-2 rounded-lg bg-white/15 border border-white/30 text-sm hover:bg-white/25 transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {analyzingItemImage ? "Analyzing..." : "Save item"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {showWeeklyPanel && weather?.daily?.length ? (
            <div className="w-full max-w-5xl lg:max-w-none mx-auto space-y-6 mt-6">
              <motion.div
              layout
              transition={{ layout: { duration: layoutDuration / 1000, ease: "easeInOut" } }}
              className="w-full rounded-2xl border border-white/12 bg-black/30 text-white/90 p-7 shadow backdrop-blur"
            >
              <p className="text-xs uppercase tracking-[0.15em] text-white/60 mb-3">
                7-day outlook
              </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
                  {(weather.daily ?? [])
                    .slice(0, 7)
                    .map((day, idx) => {
                      const date = new Date(day.dt * 1000);
                      const label = formatDayLabel(date, idx);
                      const pop = day.pop != null ? Math.round(day.pop * 100) : null;
                      const iconCode = day.icon ?? "";
                      const iconUrl = iconCode
                        ? `https://openweathermap.org/img/wn/${iconCode}@2x.png`
                        : null;
                      const isSnow = iconCode.startsWith("13");
                      const precipLabel =
                        pop != null ? `${pop}% ${isSnow ? "snow" : "rain"}` : "—";
                      return (
                        <div
                          key={`${day.dt}-${idx}`}
                          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm shadow-sm"
                        >
                          <p className="font-semibold text-sm">{label}</p>
                          <div className="flex items-center gap-2 text-xs text-white/80">
                            {iconUrl ? (
                              <img
                                src={iconUrl}
                                alt={iconCode}
                                className="h-8 w-8 object-contain drop-shadow"
                                loading="lazy"
                              />
                            ) : (
                              <span role="img" aria-label="weather" className="text-lg">
                                {isSnow ? "❄️" : "🌧️"}
                              </span>
                            )}
                          </div>
                          <p className="text-xs flex items-center gap-1 justify-end text-white/80">
                            <span>{day.min != null ? Math.round(day.min) : "--"}°</span>
                            <span className="text-white/60">/</span>
                            <span>{day.max != null ? Math.round(day.max) : "--"}°</span>
                            <span className="text-white/60">{units === "imperial" ? "F" : "C"}</span>
                          </p>
                        </div>
                      );
                    })}
                </div>
              </motion.div>

              <motion.div
                layout
                transition={{ layout: { duration: layoutDuration / 1000, ease: "easeInOut" } }}
                className="w-full rounded-2xl border border-white/12 bg-black/35 text-white p-5 shadow backdrop-blur space-y-3"
              >
                  <p className="text-xs uppercase tracking-[0.18em] text-white/60 mb-1">
                  Outfit slots by day
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {(weather.daily ?? []).slice(0, 7).map((day, idx) => {
                    const date = new Date(day.dt * 1000);
                    const label = formatDayLabel(date, idx);
                    const recommendation = recommendedByDay[idx] ?? null;
                    const isToday = idx === 0;
                    return (
                      <motion.div
                        whileHover={{ y: -2, scale: 1.01 }}
                        transition={{ duration: 0.15 }}
                        key={`planner-${day.dt}-${idx}`}
                        className={`rounded-2xl border px-4 py-3 space-y-2 ${
                          isToday
                            ? "border-white/28 bg-black/30 backdrop-blur shadow-[0_0_30px_rgba(0,0,0,0.45)]"
                            : "border-white/15 bg-black/25"
                        }`}
                      >
                        <div className={`flex items-center justify-between ${isToday ? "text-sm font-semibold" : "text-[13px] font-semibold"}`}>
                          <div className="flex items-center gap-2">
                            <span>{label}</span>
                            {isToday ? (
                              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] text-white/80 border border-white/25">
                                Today
                              </span>
                            ) : null}
                          </div>
                          <span className="text-xs flex items-center gap-1">
                            <span className={isToday ? tempColorClass(day.min != null ? Math.round(day.min) : null, units) : "text-white/80"}>
                              {day.min != null ? Math.round(day.min) : "--"}°
                            </span>
                            <span className="text-white/60">/</span>
                            <span className={isToday ? tempColorClass(day.max != null ? Math.round(day.max) : null, units) : "text-white/80"}>
                              {day.max != null ? Math.round(day.max) : "--"}°
                            </span>
                          </span>
                        </div>
                        <OutfitRecommendationGrid
                          recommendation={recommendation}
                          loading={recommending}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          ) : null}
        </motion.section>

      </div>
    </main>
  );
}
