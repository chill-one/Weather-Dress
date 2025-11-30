"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import CLOUDS from "vanta/src/vanta.clouds";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";

type WeatherRes = {
  name?: string;
  weather?: { id: number; main: string; description: string; icon: string }[];
  main?: {
    temp: number;
    feels_like?: number;
    temp_min?: number;
    temp_max?: number;
    humidity?: number;
  };
  wind?: { speed?: number };
};

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

function pickBg(w: WeatherRes): string {
  const icon = w.weather?.[0]?.icon ?? "01d";
  const code = w.weather?.[0]?.id ?? 800;
  const day = icon.endsWith("d");

  if (code >= 200 && code <= 232) return day ? BG.thunderDay : BG.thunderNight;
  if (code >= 300 && code <= 321) return day ? BG.drizzleDay : BG.drizzleNight;
  if (code >= 500 && code <= 531) return day ? BG.rainDay : BG.rainNight;
  if (code >= 600 && code <= 622) return day ? BG.snowDay : BG.snowNight;
  if (code >= 701 && code <= 781) return day ? BG.fogDay : BG.fogNight;
  if (code === 800) return day ? BG.clearDay : BG.clearNight;
  if (code >= 801 && code <= 804) return day ? BG.cloudsDay : BG.cloudsNight;
  return `${BG.defaultLight} ${BG.defaultDark}`;
}

function cloudsOptionsForWeather(w: WeatherRes | null) {
  if (!w || !w.weather?.[0]) return defaultCloudsOptions;

  const icon = w.weather[0].icon ?? "01d";
  const code = w.weather[0].id ?? 800;
  const day = icon.endsWith("d");

  if (code >= 200 && code <= 232) {
    return {
      ...defaultCloudsOptions,
      cloudShadowColor: 0x050520,
      sunColor: 0xff8800,
      sunGlareColor: 0xffcc88,
      sunlightColor: 0x884422,
    };
  }

  if (!day) {
    return {
      ...defaultCloudsOptions,
      cloudShadowColor: 0x0b1220,
      sunColor: 0x243255,
      sunGlareColor: 0x8888aa,
      sunlightColor: 0x445577,
    };
  }

  return {
    ...defaultCloudsOptions,
    cloudShadowColor: 0x1b314a,
    sunColor: 0xfff3c0,
    sunGlareColor: 0xffffff,
    sunlightColor: 0xffe0a0,
  };
}

export default function WeatherPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const name = searchParams.get("name") ?? "Selected location";
  const unitsParam = searchParams.get("units");
  const units: "imperial" | "metric" =
    unitsParam === "metric" ? "metric" : "imperial";

  const [bg, setBg] = useState<string>(`${BG.defaultLight} ${BG.defaultDark}`);
  const [weather, setWeather] = useState<WeatherRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const vantaRef = useRef<HTMLDivElement | null>(null);
  const vantaEffect = useRef<any>(null);

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

  useEffect(() => {
    if (!lat || !lon) {
      setError("Missing location. Please go back and pick a place.");
      setLoading(false);
      return;
    }

    async function fetchWeather() {
      try {
        setLoading(true);
        setError(null);

        const qs = new URLSearchParams({
          lat,
          lon,
          units,
        }).toString();

        const res = await fetch(`/api/weather/openweather?${qs}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }

        const data: WeatherRes = await res.json();
        setWeather(data);
        setBg(pickBg(data));

        const newClouds = cloudsOptionsForWeather(data);
        if (vantaEffect.current?.setOptions) {
          vantaEffect.current.setOptions(newClouds);
        }
      } catch (err) {
        console.error(err);
        setError("Couldn't load weather for this location.");
      } finally {
        setLoading(false);
      }
    }

    fetchWeather();
  }, [lat, lon, units]);

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Vanta CLOUDS full-screen background */}
      <div ref={vantaRef} className="absolute inset-0 -z-20" />

      {/* Semi-transparent gradient overlay based on weather */}
      <div
        className={`absolute inset-0 -z-10 bg-gradient-to-b ${bg} opacity-10 pointer-events-none`}
      />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="pt-6 px-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-neutral-800/80 dark:text-neutral-200/80 underline underline-offset-4"
          >
            ← Change location
          </button>

          <span className="text-xs text-neutral-800/70 dark:text-neutral-200/70">
            Units: {units === "imperial" ? "°F" : "°C"}
          </span>
        </header>

        <section className="flex-1 grid place-content-center px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/75 dark:bg-neutral-900/70 p-6 shadow-lg backdrop-blur"
          >
            {loading && (
              <p className="text-sm text-neutral-800/80 dark:text-neutral-200/80">
                Loading weather for{" "}
                <span className="font-semibold">{name}</span>...
              </p>
            )}

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            {!loading && !error && weather && (
              <>
                <h1 className="text-xl font-semibold mb-1">{name}</h1>

                <p className="text-xs text-neutral-800/70 dark:text-neutral-200/70 mb-4 capitalize">
                  {weather.weather?.[0]?.description ?? "Current conditions"}
                </p>

                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-5xl font-bold">
                    {weather.main?.temp != null
                      ? Math.round(weather.main.temp)
                      : "--"}
                  </span>
                  <span className="text-lg">
                    {units === "imperial" ? "°F" : "°C"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-neutral-800/70 dark:text-neutral-300/70">
                      Feels like
                    </p>
                    <p className="font-semibold">
                      {weather.main?.feels_like != null
                        ? Math.round(weather.main.feels_like)
                        : "--"}
                      {weather.main?.feels_like != null &&
                        (units === "imperial" ? "°F" : "°C")}
                    </p>
                  </div>

                  <div>
                    <p className="text-neutral-800/70 dark:text-neutral-300/70">
                      Humidity
                    </p>
                    <p className="font-semibold">
                      {weather.main?.humidity != null
                        ? `${weather.main.humidity}%`
                        : "--"}
                    </p>
                  </div>

                  <div>
                    <p className="text-neutral-800/70 dark:text-neutral-300/70">
                      Low / High
                    </p>
                    <p className="font-semibold">
                      {weather.main?.temp_min != null
                        ? Math.round(weather.main.temp_min)
                        : "--"}
                      {weather.main?.temp_min != null &&
                        (units === "imperial" ? "°F" : "°C")}
                      {" / "}
                      {weather.main?.temp_max != null
                        ? Math.round(weather.main.temp_max)
                        : "--"}
                      {weather.main?.temp_max != null &&
                        (units === "imperial" ? "°F" : "°C")}
                    </p>
                  </div>

                  <div>
                    <p className="text-neutral-800/70 dark:text-neutral-300/70">
                      Wind speed
                    </p>
                    <p className="font-semibold">
                      {weather.wind?.speed != null
                        ? `${weather.wind.speed} ${
                            units === "imperial" ? "mph" : "m/s"
                          }`
                        : "--"}
                    </p>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </section>
      </div>
    </main>
  );
}
