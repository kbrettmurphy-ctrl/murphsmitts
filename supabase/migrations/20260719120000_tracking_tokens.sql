-- Customer tracking page (3.2): unguessable per-order token. The token IS
-- the access key for a read-only status page — 64 hex chars, no login.
alter table public.orders add column if not exists tracking_token text;

update public.orders
set tracking_token = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
where tracking_token is null;

create unique index if not exists orders_tracking_token_idx
  on public.orders (tracking_token);
