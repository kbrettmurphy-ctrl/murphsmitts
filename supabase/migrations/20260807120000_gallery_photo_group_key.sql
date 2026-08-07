-- Group key for gallery photos that aren't tied to a customer order.
-- "Shop gloves" (Brett's own gloves, his kids', or gloves he'll sell) have
-- no order_number, so today each of their photos is its own standalone tile
-- with no way to say "these angles are the same glove."
--
-- Photos that share a group_key form one glove album exactly like photos that
-- share an order_number. order_number always takes precedence; group_key is
-- only used to group photos that have no order link. Independent of the
-- gloves_for_sale / glove_sale_photos subsystem.
alter table public.gallery_photo_links
  add column if not exists group_key text;

create index if not exists gallery_photo_links_group_key_idx
  on public.gallery_photo_links (group_key);
