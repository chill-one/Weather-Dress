import asyncio
import asyncpg
from sentence_transformers import SentenceTransformer
import os

DB_URL = os.environ["DATABASE_URL"]  # e.g., postgres://user:pass@host:5432/db
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

def textify(row):
    parts = [
        f"label: {row['label']}",
        f"description: {row.get('description') or ''}",
        f"category: {row.get('category') or ''}",
        f"color: {row.get('color') or ''}",
        f"warmth: {row.get('warmth_score') or ''}",
        f"water: {row.get('water_resistance') or ''}",
        f"wind: {row.get('wind_block') or ''}",
        f"breathability: {row.get('breathability') or ''}",
        f"coverage_top: {row.get('coverage_top') or ''}",
        f"coverage_bottom: {row.get('coverage_bottom') or ''}",
        f"footwear: {row.get('footwear_type') or ''}",
        f"temp_min: {row.get('min_temp_c') or ''}",
        f"temp_max: {row.get('max_temp_c') or ''}",
    ]
    return ". ".join(parts)

async def main():
    conn = await asyncpg.connect(DB_URL)
    rows = await conn.fetch("select id, label, description, category, color, warmth_score, water_resistance, wind_block, breathability, coverage_top, coverage_bottom, footwear_type, min_temp_c, max_temp_c from outfit_items where embedding is null")
    print(f"Embedding {len(rows)} rows")
    for row in rows:
        text = textify(row)
        emb = model.encode([text])[0].tolist()
        await conn.execute("update outfit_items set embedding = $1 where id = $2", emb, row["id"])
    await conn.close()

asyncio.run(main())
