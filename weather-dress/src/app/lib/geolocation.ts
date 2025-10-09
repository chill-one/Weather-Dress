export function getBrowserLocation(
  options?: PositionOptions
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    const timer = setTimeout(
      () => reject(new Error("Location request timed out")),
      15000
    );
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve(pos);
      },
      (err) => {
        clearTimeout(timer);
        const map: Record<number, string> = {
          1: "Permission denied",
          2: "Position unavailable",
          3: "Timeout",
        };
        reject(new Error(map[err.code] || "Failed to get location"));
      },
      {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: 12_000,
        ...(options || {}),
      }
    );
  });
}
