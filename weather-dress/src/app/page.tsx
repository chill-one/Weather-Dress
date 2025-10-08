// app/page.tsx
export default function Home() {
  return (
    <main className="mx-auto max-w-screen-md px-4 py-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">WeatherDress</h1>
        <button aria-label="Toggle theme" className="rounded-xl px-3 py-2 border">☀️/🌙</button>
      </header>

      {/* Location + tabs */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <button className="rounded-full border px-3 py-2">📍 Manassas ▾</button>
          <nav className="flex gap-2">
            {["Today","Hourly","7-Day"].map(tab => (
              <button key={tab} className="rounded-full px-3 py-1 border">{tab}</button>
            ))}
          </nav>
        </div>

        {/* Weather card */}
        <div className="rounded-2xl border p-4">
          <div className="flex items-center justify-between">
            <div className="text-5xl font-bold">62°</div>
            <div className="text-sm text-muted-foreground">Feels 60° • 8 mph • 10% 🌧️</div>
          </div>
        </div>
      </section>

      {/* Outfit grid */}
      <section>
        <h2 className="text-lg font-medium mb-3">Outfit for 60°–65°</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {["Light Jacket","T-Shirt","Jeans","Sneakers"].map(item => (
            <article key={item} className="rounded-xl border p-3">
              <div className="text-3xl">👕</div>
              <div className="mt-2 font-medium">{item}</div>
              <a className="text-sm underline mt-1 inline-block" href="#">Buy</a>
            </article>
          ))}
        </div>
      </section>

      {/* Feedback */}
      <section className="rounded-2xl border p-4">
        <label className="block text-sm mb-2">How did this feel?</label>
        <input type="range" min="-2" max="2" defaultValue={0} className="w-full" />
        <div className="mt-3 flex gap-2">
          <button className="rounded-xl px-3 py-2 border">Submit</button>
          <button className="rounded-xl px-3 py-2 border">Save</button>
        </div>
      </section>

      <footer className="text-xs text-muted-foreground">© WeatherDress</footer>
    </main>
  );
}
