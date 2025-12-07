// src/app/weather/WeatherClient.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import CLOUDS from "vanta/src/vanta.clouds";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { supabase } from "@/src/app/lib/supabaseClient";

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

type OutfitItem = { id: string; label: string };

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
  const { data, error } = await supabase
    .from("outfit_items")
    .select("*")
    .eq("user_key", userKey)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("supabase fetchOutfits error", {
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }
  return data;
}

async function addOutfit(userKey: string, category: OutfitCategory, label: string) {
  const { data, error } = await supabase
    .from("outfit_items")
    .insert([{ user_key: userKey, category, label }])
    .select()
    .single();
  if (error) {
    console.error("supabase addOutfit error", {
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }
  return data;
}

async function removeOutfit(id: string) {
  const { error } = await supabase.from("outfit_items").delete().eq("id", id);
  if (error) {
    console.error("supabase removeOutfit error", {
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw error;
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

    async function fetchWeather() {
      try {
        setLoading(true);
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
        setShowWeekly(false);
        setShowWeeklyPanel(false);
      }
    }

    fetchWeather();
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
    if (!userKey) return;
    fetchOutfits(userKey)
      .then((rows) => {
        setUpperItems(rows.filter((r) => r.category === "upper").map((r) => ({ id: r.id, label: r.label })));
        setLowerItems(rows.filter((r) => r.category === "lower").map((r) => ({ id: r.id, label: r.label })));
        setAccessoriesItems(rows.filter((r) => r.category === "accessories").map((r) => ({ id: r.id, label: r.label })));
        setShoesItems(rows.filter((r) => r.category === "shoes").map((r) => ({ id: r.id, label: r.label })));
      })
      .catch((err) => console.error("fetch outfits", err));
  }, [userKey]);

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
      console.error("remove outfit", err);
    }
  };

  const handleAddItem = async (kind: OutfitCategory) => {
    const value = typeof window !== "undefined" ? window.prompt("Add an item") : null;
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed || !userKey) return;
    try {
      const row = await addOutfit(userKey, kind, trimmed);
      const entry = { id: row.id, label: row.label };
      switch (kind) {
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
    } catch (err) {
      console.error("add outfit", err);
    }
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
              ? "flex-1 px-4 py-7 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8"
              : "flex-1 grid place-content-center px-4 py-8"
          }
        >
          <motion.div layout className="w-full max-w-md flex flex-col gap-6">
            <motion.div
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: layoutDuration / 1000 }}
              className="w-full rounded-2xl border border-white/20 bg-black/60 text-white p-6 shadow-lg backdrop-blur"
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
                    <span className="text-5xl font-bold">
                      {weather.current?.temp != null
                        ? Math.round(weather.current.temp)
                        : "--"}
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
                        <p className="font-semibold">
                          {weather.current?.feels_like != null
                            ? Math.round(weather.current.feels_like)
                            : "--"}
                          {weather.current?.feels_like != null &&
                            (units === "imperial" ? "°F" : "°C")}
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
                className="w-full rounded-2xl border border-white/25 bg-black/75 text-white shadow-lg backdrop-blur px-4 py-3 space-y-4 text-sm"
              >
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <p className="text-sm font-semibold">Outfit picks</p>
                  <span className="text-[10px] uppercase tracking-wide text-white/60">
                    curated
                  </span>
                </div>
                {[
                  { title: "Upper", items: upperItems, kind: "upper" as const },
                  { title: "Lower", items: lowerItems, kind: "lower" as const },
                  {
                    title: "Accessories",
                    items: accessoriesItems,
                    kind: "accessories" as const,
                  },
                  { title: "Shoes", items: shoesItems, kind: "shoes" as const },
                ].map(({ title, items, kind }) => (
                  <div key={title} className="space-y-2 pb-1">
                    <p className="text-xs uppercase tracking-wide text-white/70">
                      {title}
                    </p>
                    <div className="flex items-center gap-3 overflow-x-auto">
                      <button
                        onClick={() => handleAddItem(kind)}
                        className="h-8 w-8 rounded-full border border-white/30 bg-white/15 text-white text-lg leading-none flex items-center justify-center hover:bg-white/25 transition"
                        aria-label={`Add ${title}`}
                      >
                        +
                      </button>
                      {items.map((item) => (
                        <div key={item.id} className="flex flex-col items-center gap-1">
                          <div
                            className="h-14 w-14 rounded-full border border-white/15 bg-gradient-to-br from-white/15 to-white/5 flex items-center justify-center text-[11px] text-white/90 text-center px-2"
                            title={item.label}
                          >
                            <span className="line-clamp-2 leading-tight">
                              {item.label}
                            </span>
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
                      {!items.length && (
                        <p className="text-xs text-white/60">No items yet</p>
                      )}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </motion.div>

          {showWeeklyPanel && weather?.daily?.length ? (
            <motion.div
              layout
              transition={{ layout: { duration: layoutDuration / 1000, ease: "easeInOut" } }}
              className="mt-6 lg:mt-0 w-full lg:flex-1 max-w-5xl lg:max-w-none mx-auto rounded-2xl border border-white/20 bg-black/40 text-white/90 p-6 shadow backdrop-blur"
            >
              <p className="text-xs uppercase tracking-wide text-white/60 mb-3">
                7-day outlook
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {weather.daily.slice(0, 7).map((day, idx) => {
                  const date = new Date(day.dt * 1000);
                  const label = date.toLocaleDateString(undefined, {
                    weekday: "short",
                  });
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
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                    >
                      <p className="font-semibold">{label}</p>
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
                      <p className="text-white/70 text-xs">
                        {day.min != null ? Math.round(day.min) : "--"}° /{" "}
                        {day.max != null ? Math.round(day.max) : "--"}°
                        {units === "imperial" ? "F" : "C"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : null}
        </motion.section>

      </div>
    </main>
  );
}
