create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.outfit_items (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  category text not null check (category in ('upper', 'lower', 'accessories', 'shoes')),
  label text not null,
  image_url text,
  brand text,
  store_url text,
  description text,
  color text,
  warmth_score int,
  water_resistance text,
  wind_block text,
  breathability text,
  coverage_top text,
  coverage_bottom text,
  footwear_type text,
  min_temp_c numeric,
  max_temp_c numeric,
  embedding vector(384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.outfit_items to anon, authenticated;

create index if not exists outfit_items_user_key_idx
  on public.outfit_items (user_key);

create index if not exists outfit_items_category_idx
  on public.outfit_items (category);

create index if not exists outfit_items_embedding_hnsw_idx
  on public.outfit_items
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_outfit_items_updated_at on public.outfit_items;

create trigger set_outfit_items_updated_at
before update on public.outfit_items
for each row
execute function public.set_updated_at();

create or replace function public.match_outfits(
  query_embedding vector(384),
  match_count int default 24,
  input_user_key text default null,
  input_category text default null,
  temp_c numeric default null
)
returns table (
  id uuid,
  user_key text,
  category text,
  label text,
  image_url text,
  brand text,
  store_url text,
  description text,
  color text,
  warmth_score int,
  water_resistance text,
  wind_block text,
  breathability text,
  coverage_top text,
  coverage_bottom text,
  footwear_type text,
  min_temp_c numeric,
  max_temp_c numeric,
  created_at timestamptz,
  updated_at timestamptz,
  similarity double precision
)
language sql
stable
as $$
  select
    oi.id,
    oi.user_key,
    oi.category,
    oi.label,
    oi.image_url,
    oi.brand,
    oi.store_url,
    oi.description,
    oi.color,
    oi.warmth_score,
    oi.water_resistance,
    oi.wind_block,
    oi.breathability,
    oi.coverage_top,
    oi.coverage_bottom,
    oi.footwear_type,
    oi.min_temp_c,
    oi.max_temp_c,
    oi.created_at,
    oi.updated_at,
    1 - (oi.embedding <=> query_embedding) as similarity
  from public.outfit_items oi
  where
    input_user_key is not null
    and oi.user_key = input_user_key
    and oi.embedding is not null
    and (input_category is null or oi.category = input_category)
  order by oi.embedding <=> query_embedding
  limit least(greatest(coalesce(match_count, 24), 1), 100);
$$;

grant execute on function public.match_outfits(vector, int, text, text, numeric)
  to anon, authenticated, service_role;
