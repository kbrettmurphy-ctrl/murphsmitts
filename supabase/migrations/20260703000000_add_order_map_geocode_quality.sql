alter table public.orders
  add column if not exists map_geocode_quality text;