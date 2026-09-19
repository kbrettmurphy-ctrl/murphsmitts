-- Keep glove model descriptions compact while preserving search aliases in the
-- admin and public gallery application code.
update public.orders
set brand_model = regexp_replace(
  brand_model,
  '\mheart[[:space:]]+of[[:space:]]+the[[:space:]]+hide\M',
  'HoH',
  'gi'
)
where brand_model ~* '\mheart[[:space:]]+of[[:space:]]+the[[:space:]]+hide\M';

-- Standalone gallery gloves use their own descriptor instead of an order row.
update public.gallery_photo_links
set brand_model = regexp_replace(
  brand_model,
  '\mheart[[:space:]]+of[[:space:]]+the[[:space:]]+hide\M',
  'HoH',
  'gi'
)
where brand_model ~* '\mheart[[:space:]]+of[[:space:]]+the[[:space:]]+hide\M';
