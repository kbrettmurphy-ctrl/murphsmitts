-- Album cover: the flagged photo leads its glove's gallery album (tile image
-- and first lightbox slide) instead of whatever storage lists first.
alter table public.gallery_photo_links
  add column if not exists is_cover boolean not null default false;
