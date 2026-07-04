-- Shop Economics V1: per-order lace piece override for job costing.
alter table public.orders
  add column if not exists lace_pieces_used integer;
