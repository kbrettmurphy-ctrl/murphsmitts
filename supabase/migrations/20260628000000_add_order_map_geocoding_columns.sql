alter table public.orders
  add column if not exists map_lat numeric,
  add column if not exists map_lng numeric,
  add column if not exists map_geocoded_address text,
  add column if not exists map_geocode_source text,
  add column if not exists map_geocode_status text,
  add column if not exists map_geocode_error text,
  add column if not exists map_address_hash text,
  add column if not exists map_geocoded_at timestamptz;
