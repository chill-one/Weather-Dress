"use client";
import React, { useState } from "react";
import { LocationPicker } from "@/src/app/components/location/LocationPicker";
import { motion } from "framer-motion";
export default function Page() {
  const [location, setLocation] = useState<{
    name: string;
    latitude: number;
    longitude: number;
  } | null>(null);

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-neutral-50 dark:from-neutral-950 dark:to-neutral-900">
      {/* Top title */}
      <header className="pt-10 sm:pt-12 text-center">
        <h1 className="text-3xl sm:text-8xl font-bold tracking-tight">
          Weather Dress
        </h1>
      </header>
      

      {/* Centered search area */}
      <section className="min-h-[60vh] grid place-content-center px-4 py-8">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Pick a location, to view weather and outfit suggestions.
        </p>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/60 p-4 shadow-sm"
        >
          <LocationPicker
            onSelect={(loc) => {
              setLocation(loc);
              // Navigate or reveal the rest of the UI after a selection
              // e.g., router.push(`/results?lat=${loc.latitude}&lon=${loc.longitude}`)
            }}
            className=""
            defaultLabel="Search city or use GPS"
          />
        </motion.div>
      </section>
    </main>
  );
}
