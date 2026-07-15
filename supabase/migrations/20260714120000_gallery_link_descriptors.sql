-- Descriptor fields so curated gallery photos WITHOUT an order number
-- (shop gloves: personal, family, restored-and-sold) can appear in the
-- public glove search. When order_number is set, descriptors stay null and
-- search matches on the linked order's fields as before.

alter table public.gallery_photo_links
  add column if not exists brand_model text,
  add column if not exists glove_type text,
  add column if not exists web_type text,
  add column if not exists primary_lace_color text,
  add column if not exists secondary_lace_color text;

-- Orderless rows are now valid: descriptors carry the searchable details.
alter table public.gallery_photo_links
  alter column order_number drop not null;
