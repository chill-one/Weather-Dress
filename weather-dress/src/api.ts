export async function getWeather(q: string, units: "imperial" | "metric" = "imperial") {
    const res = await fetch(`/api/weather/openweather?q=${encodeURIComponent(q)}&units=${units}`);
    if (!res.ok) throw new Error(`GET failed: ${res.status}`);
    return res.json();
  }
  
  export async function getRecommendation(q: string, units: "imperial" | "metric" = "imperial") {
    const res = await fetch(`/api/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q, units }),
    });
    if (!res.ok) throw new Error(`POST failed: ${res.status}`);
    return res.json();
  }