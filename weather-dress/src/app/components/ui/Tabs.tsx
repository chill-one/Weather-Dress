"use client";
import React, { useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface TabItem {
  key: string;
  label: string;
  badge?: string | number;
  disabled?: boolean;
}
export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (key: string) => void;
  className?: string;
  fitted?: boolean;
}

export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  className = "",
  fitted,
}: TabsProps) {
  const [internal, setInternal] = useState<string>(
    defaultValue || items[0]?.key
  );
  const current = value ?? internal;
  useEffect(() => {
    if (value == null && internal == null && items.length)
      setInternal(items[0].key);
  }, [items, value, internal]);
  return (
    <div className={`w-full ${className}`}>
      <div
        role="tablist"
        aria-label="Tabs"
        className={`flex gap-2 border-b border-neutral-200 dark:border-neutral-800`}
      >
        {items.map((it) => {
          const active = current === it.key;
          const base =
            "relative px-3 sm:px-4 py-2 text-sm font-medium rounded-t-xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 transition-colors";
          const state = it.disabled
            ? "text-neutral-400 cursor-not-allowed"
            : active
            ? "text-blue-600 dark:text-blue-400"
            : "text-neutral-600 dark:text-neutral-300 hover:text-blue-600";
          return (
            <button
              key={it.key}
              role="tab"
              aria-selected={active}
              aria-controls={`panel-${it.key}`}
              disabled={it.disabled}
              className={`${base} ${state} ${
                fitted ? "flex-1 text-center" : ""
              }`}
              onClick={() => {
                if (it.disabled) return;
                if (value == null) setInternal(it.key);
                onValueChange?.(it.key);
              }}
            >
              <span className="inline-flex items-center gap-2">
                {it.label}
                {it.badge != null && (
                  <span className="text-[10px] rounded-full border border-current/30 px-1.5 py-0.5 opacity-80">
                    {it.badge}
                  </span>
                )}
              </span>
              <AnimatePresence>
                {active && (
                  <motion.span
                    layoutId="tab-underline"
                    className="absolute left-0 right-0 -bottom-[1px] h-[2px] bg-blue-600 dark:bg-blue-400"
                  />
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>
      <div className="pt-4" aria-live="polite" />
    </div>
  );
}
