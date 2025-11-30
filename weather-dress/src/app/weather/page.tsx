// src/app/weather/page.tsx
import { Suspense } from "react";
import WeatherClient from "./WeatherClient";

export default function WeatherPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center">
          <p className="text-sm text-neutral-700 dark:text-neutral-200">
            Loading weather...
          </p>
        </main>
      }
    >
      <WeatherClient />
    </Suspense>
  );
}
