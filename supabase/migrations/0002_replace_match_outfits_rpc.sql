create extension if not exists vector;

alter table if exists public.outfit_items
  add column if not exists user_key text,
  add column if not exists category text,
  add column if not exists label text,
  add column if not exists image_url text,
  add column if not exists brand text,
  add column if not exists store_url text,
  add column if not exists description text,
  add column if not exists color text,
  add column if not exists warmth_score int,
  add column if not exists water_resistance text,
  add column if not exists wind_block text,
  add column if not exists breathability text,
  add column if not exists coverage_top text,
  add column if not exists coverage_bottom text,
  add column if not exists footwear_type text,
  add column if not exists min_temp_c numeric,
  add column if not exists max_temp_c numeric,
  add column if not exists embedding vector(384),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

drop function if exists public.match_outfits(int, vector, numeric);
drop function if exists public.match_outfits(vector, int, numeric);
drop function if exists public.match_outfits(vector, int, text, numeric);
drop function if exists public.match_outfits(vector, int, text, text, numeric);

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

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.outfit_items to anon, authenticated;
grant execute on function public.match_outfits(vector, int, text, text, numeric)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
