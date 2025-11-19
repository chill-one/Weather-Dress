"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import CLOUDS from "vanta/src/vanta.clouds";
import { LocationPicker } from "@/src/app/components/location/LocationPicker";
import { motion } from "framer-motion";

type Location = { name: string; latitude: number; longitude: number };

type WeatherRes = {
  weather?: { id: number; main: string; description: string; icon: string }[];
  main?: { temp: number };
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

// 🌥️ your default CLOUDS look
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

// 🌀 choose Vanta CLOUDS options based on weather (you can tweak this)
function cloudsOptionsForWeather(w: WeatherRes | null) {
  if (!w || !w.weather?.[0]) return defaultCloudsOptions;

  const icon = w.weather[0].icon ?? "01d";
  const code = w.weather[0].id ?? 800;
  const day = icon.endsWith("d");

  // example: make storms more dramatic, nights cooler, etc.
  if (code >= 200 && code <= 232) {
    // thunderstorm
    return {
      ...defaultCloudsOptions,
      cloudShadowColor: 0x050520,
      sunColor: 0xff8800,
      sunGlareColor: 0xffcc88,
      sunlightColor: 0x884422,
    };
  }

  if (!day) {
    // night
    return {
      ...defaultCloudsOptions,
      cloudShadowColor: 0x0b1220,
      sunColor: 0x243255,
      sunGlareColor: 0x8888aa,
      sunlightColor: 0x445577,
    };
  }

  // day, clear-ish
  return {
    ...defaultCloudsOptions,
    cloudShadowColor: 0x1b314a,
    sunColor: 0xfff3c0,
    sunGlareColor: 0xffffff,
    sunlightColor: 0xffe0a0,
  };
}

export default function Page() {
  const [location, setLocation] = useState<Location | null>(null);
  const [bg, setBg] = useState<string>(`${BG.defaultLight} ${BG.defaultDark}`);
  const [weather, setWeather] = useState<WeatherRes | null>(null);
  const units: "imperial" | "metric" = "imperial";

  const vantaRef = useRef<HTMLDivElement | null>(null);
  const vantaEffect = useRef<any>(null);

  useEffect(() => {
    if (!vantaRef.current) return;

    // 🔹 initial / default Vanta config
    vantaEffect.current = CLOUDS({
      el: vantaRef.current,
      THREE,
      ...defaultCloudsOptions,
    });

    return () => {
      vantaEffect.current?.destroy?.();
    };
  }, []);

  async function handleSelect(loc: Location) {
    setLocation(loc);

    const qs = new URLSearchParams({ q: loc.name, units }).toString();
    const res = await fetch(`/api/weather/openweather?${qs}`, {
      cache: "no-store",
    });
    const data: WeatherRes = await res.json();
    setWeather(data);
    setBg(pickBg(data));

    // 🌍 update Vanta based on new location/weather
    const newClouds = cloudsOptionsForWeather(data);
    if (vantaEffect.current?.setOptions) {
      vantaEffect.current.setOptions(newClouds);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Vanta CLOUDS full-screen background */}
      <div ref={vantaRef} className="absolute inset-0 -z-20" />

      {/* Semi-transparent weather gradient overlay */}
      <div
        className={`absolute inset-0 -z-10 bg-gradient-to-b ${bg} opacity-60 pointer-events-none`}
      />

      {/* Actual content layer */}
      <div className="relative z-10 min-h-screen">
        <header className="pt-10 sm:pt-12 text-center">
          <h1 className="text-3xl sm:text-8xl font-bold tracking-tight">
            Weather Dress
          </h1>
        </header>

        <section className="min-h-[60vh] grid place-content-center px-4 py-8">
          <p className="text-sm text-neutral-800/80 dark:text-neutral-200/80">
            Pick a location to view weather and outfit suggestions.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/60 p-4 shadow-sm backdrop-blur"
          >
            <LocationPicker
              onSelect={async (loc) => {
                await handleSelect(loc);
              }}
              className=""
              defaultLabel="Search city or use GPS"
            />
          </motion.div>

          {weather && (
            <div className="mt-6">
              <pre className="text-xs p-3 rounded-lg bg-black/30 text-white/90 overflow-auto">
                {JSON.stringify(
                  {
                    id: weather.weather?.[0]?.id,
                    main: weather.weather?.[0]?.main,
                    icon: weather.weather?.[0]?.icon,
                    temp: weather.main?.temp,
                    appliedBg: bg,
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
