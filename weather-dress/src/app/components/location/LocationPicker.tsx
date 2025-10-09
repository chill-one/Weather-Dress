"use client";
import React, { useEffect, useId, useState } from "react";
import { getBrowserLocation } from "@/src/app/lib/geolocation";
import { useDebounced } from "@/src/app/lib/hooks";
import { AnimatePresence, motion } from "framer-motion";

interface GeoPlace {
  id: string;
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}
export interface LocationPickerProps {
  onSelect: (loc: {
    name: string;
    latitude: number;
    longitude: number;
    source: "geo" | "search";
  }) => void;
  defaultLabel?: string;
  className?: string;
}

export function LocationPicker({
  onSelect,
  defaultLabel = "Search city or use GPS",
  className = "",
}: LocationPickerProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GeoPlace[]>([]);
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(query, 300);

  useEffect(() => {
    const run = async () => {
      if (!debounced || debounced.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
        url.searchParams.set("name", debounced);
        url.searchParams.set("count", "8");
        url.searchParams.set("language", "en");
        url.searchParams.set("format", "json");
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("Failed to fetch geocoding results");
        const json = await res.json();
        const out: GeoPlace[] = (json?.results || []).map((r: any) => ({
          id: `${r.id}`,
          name: r.name,
          country: r.country,
          admin1: r.admin1,
          latitude: r.latitude,
          longitude: r.longitude,
        }));
        setResults(out);
        setOpen(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Search failed";
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [debounced]);

  const onUseMyLocation = async () => {
    setLoading(true);
    setError(null);
    try {
      const pos = await getBrowserLocation();
      const { latitude, longitude } = pos.coords;
      onSelect({ name: "My Location", latitude, longitude, source: "geo" });
      setOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not get location";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const selectPlace = (p: GeoPlace) => {
    onSelect({
      name: `${p.name}${p.admin1 ? ", " + p.admin1 : ""}, ${p.country}`,
      latitude: p.latitude,
      longitude: p.longitude,
      source: "search",
    });
    setQuery("");
    setOpen(false);
  };

  const listboxId = useId();

  return (
    <div className={`relative ${className}`}>
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={defaultLabel}
            className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/80 px-4 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500/50"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={open}
            aria-haspopup="listbox"
          />
        </div>
        <button
          onClick={onUseMyLocation}
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 dark:border-neutral-700 px-3 sm:px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800/50 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <span className="i-lucide-crosshair cursor-default" aria-hidden /> Use
          my location
        </button>
      </div>
      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.ul
            id={listboxId}
            role="listbox"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xl"
          >
            {results.map((r) => (
              <li
                key={r.id}
                role="option"
                tabIndex={0}
                onClick={() => selectPlace(r)}
                onKeyDown={(e) => e.key === "Enter" && selectPlace(r)}
                className="cursor-pointer px-4 py-2.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
              >
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-neutral-500">
                  {[r.admin1, r.country].filter(Boolean).join(", ")}
                </div>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
      {loading && <div className="mt-2 text-xs text-neutral-500">Loading…</div>}
      {error && (
        <div className="mt-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
