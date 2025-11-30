"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import CLOUDS from "vanta/src/vanta.clouds";
import { LocationPicker } from "@/src/app/components/location/LocationPicker";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

type Location = { name: string; latitude: number; longitude: number };

const defaultCloudsOptions = {
  gyroControls: false,
  cloudShadowColor: 0x1b314a,
  sunColor: 0x646425,
  sunGlareColor: 0xbbabab,
  sunlightColor: 0x8c6d51,
};

const DEFAULT_BG =
  "from-white to-neutral-50 dark:from-neutral-950 dark:to-neutral-900";

export default function Page() {
  const router = useRouter();
  const units: "imperial" | "metric" = "imperial";

  // we keep a simple static gradient here
  const [bg] = useState<string>(DEFAULT_BG);

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

  async function handleSelect(loc: Location) {
    const units: "imperial" | "metric" = "imperial";
  
    const qs = new URLSearchParams({
      lat: String(loc.latitude),
      lon: String(loc.longitude),
      name: loc.name,
      units,
    }).toString();
  
    router.push(`/weather?${qs}`);
  }
  

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Vanta CLOUDS full-screen background */}
      <div ref={vantaRef} className="absolute inset-0 -z-20" />

      {/* Semi-transparent weather gradient overlay */}
      <div
        className={`absolute inset-0 -z-10 bg-gradient-to-b ${bg} opacity-10 pointer-events-none`}
      />

      {/* Actual content layer */}
      <div className="relative z-10 min-h-screen">
        <header className="pt-10 sm:pt-12 text-center">
          <h1 className="text-3xl sm:text-8xl font-bold tracking-tight">
            Weather Dress
          </h1>
        </header>

        <section className="min-h-[60vh] grid place-content-center px-4 py-8">
          <p className="ml-4 text-sm text-neutral-800/80 dark:text-neutral-200/80">
            Pick a location to view weather and outfit suggestions.
          </p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/60 p-4 shadow-sm backdrop-blur"
          >
            <LocationPicker
              onSelect={handleSelect}
              className=""
              defaultLabel="Search city or use GPS"
            />
          </motion.div>
        </section>
      </div>
    </main>
  );
}
