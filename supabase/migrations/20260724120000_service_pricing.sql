-- Pricing Management (MurphOS Pricing) — owner-controlled public service pricing
-- with a draft/publish workflow, immutable price history, editable business
-- settings, and analytics mappings from public services to measured job buckets.
--
-- Additive and idempotent. The app reaches Supabase only through the
-- service_role key (server-side Cloudflare Functions), which BYPASSES RLS; the
-- public /api/public/service-pricing endpoint is server-side too. RLS is enabled
-- with no policies so the anon/public role is denied direct table access,
-- matching 20260721140000_enable_rls_all_tables.sql.
--
-- Seeding publishes the approved live prices immediately. Re-running the file is
-- safe: `on conflict do nothing` and `where not exists` guards never clobber
-- values the owner has since edited in MurphOS.

-- ============================================================================
-- 1. service_pricing — the LIVE, published state the public website reads.
--    One row per stable service_key. Editing never writes here directly;
--    only publishing a draft does.
-- ============================================================================
create table if not exists public.service_pricing (
  id                uuid primary key default gen_random_uuid(),
  service_key       text not null unique,                     -- stable internal key
  service_name      text not null,                            -- editable public name
  category          text not null default 'additional',       -- 'relacing' | 'additional'
  short_description text,                                      -- internal/quote one-liner
  bullet_details    jsonb not null default '[]'::jsonb,        -- array of plain-text strings
  pricing_type      text not null default 'fixed',            -- fixed|range|starting_at|per_item|variable|tiered
  base_price        numeric,                                  -- standard / starting / per-item price
  premium_price     numeric,                                  -- upper tier (tiered/range)
  price_suffix      text,                                     -- e.g. 'each'
  display_override  text,                                     -- manual public display; wins when set
  is_public         boolean not null default true,            -- appears on the public website
  is_active         boolean not null default true,            -- offered for new quote suggestions
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  published_at      timestamptz
);

create index if not exists service_pricing_sort_idx
  on public.service_pricing (category, sort_order);

create index if not exists service_pricing_public_idx
  on public.service_pricing (is_public, is_active);

-- ============================================================================
-- 2. service_pricing_revisions — pending drafts + immutable published history.
--    At most one 'draft' per service; every publish leaves a 'published' row
--    recording the previous and new public price display.
-- ============================================================================
create table if not exists public.service_pricing_revisions (
  id                 uuid primary key default gen_random_uuid(),
  service_pricing_id uuid not null references public.service_pricing(id) on delete cascade,
  service_key        text not null,
  status             text not null default 'draft',           -- draft|published|archived
  data               jsonb not null default '{}'::jsonb,      -- full snapshot of editable fields
  previous_display   text,                                    -- public price display before publish
  new_display        text,                                    -- public price display after publish
  note               text,                                    -- internal reason
  created_at         timestamptz not null default now(),
  published_at       timestamptz
);

create index if not exists service_pricing_revisions_service_idx
  on public.service_pricing_revisions (service_pricing_id, status, created_at desc);

-- At most one open draft per service.
create unique index if not exists service_pricing_one_draft_idx
  on public.service_pricing_revisions (service_pricing_id)
  where status = 'draft';

-- ============================================================================
-- 3. shop_settings — editable pricing-development business settings (key/value).
-- ============================================================================
create table if not exists public.shop_settings (
  key        text primary key,
  value      numeric,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 4. service_pricing_job_types — maps a public service to measured job buckets.
--    Flexible: match by glove type + primary service value (+ trapeze web for
--    the premium tier). glove_type NULL means "any glove".
-- ============================================================================
create table if not exists public.service_pricing_job_types (
  id                 uuid primary key default gen_random_uuid(),
  service_pricing_id uuid not null references public.service_pricing(id) on delete cascade,
  service_key        text not null,
  glove_type         text,                                    -- 'Fielders Glove' etc. (NULL = any)
  services           text,                                    -- primary selected service value
  trapeze            boolean not null default false,          -- fielders trapeze/mod-trapeze web (premium tier)
  created_at         timestamptz not null default now()
);

create index if not exists service_pricing_job_types_service_idx
  on public.service_pricing_job_types (service_pricing_id);

-- ============================================================================
-- RLS — enable with no policies (service_role bypasses; anon is denied).
-- ============================================================================
alter table public.service_pricing            enable row level security;
alter table public.service_pricing_revisions  enable row level security;
alter table public.shop_settings              enable row level security;
alter table public.service_pricing_job_types  enable row level security;

-- ============================================================================
-- SEED — approved live prices, published immediately. Idempotent.
-- ============================================================================
insert into public.service_pricing
  (service_key, service_name, category, short_description, bullet_details,
   pricing_type, base_price, premium_price, price_suffix, display_override,
   is_public, is_active, sort_order, published_at)
values
  ('standard_full_service', 'Standard Full Service', 'relacing',
   'Full clean, condition, and relace with the lace color or colors of your choice.',
   '["Thorough cleaning.","Conditioning with The Craftsman''s Works glove lotion.","Full relace with the lace color or colors of your choice.","Conditioning with The Craftsman''s Works glove salve.","Standard fielders price is $90. Catcher''s mitts, first base mitts, trapeze webs, and modified trapeze webs are $110.","All lace is pre-stressed and conditioned before installation."]'::jsonb,
   'tiered', 90, 110, null, null, true, true, 10, now()),

  ('full_relace', 'Full Relace', 'relacing',
   'New lace or a color change for gloves that are still in good shape.',
   '["For gloves that are in good shape but need new lace or a color change.","Standard fielders price is $60. First base mitts, catcher''s mitts, trapeze webs, and modified trapeze webs are $80.","All laces are pre-stressed and conditioned before install."]'::jsonb,
   'tiered', 60, 80, null, null, true, true, 20, now()),

  ('clean_condition', 'Clean & Condition', 'additional',
   'Cleaning and conditioning for gloves whose laces are still in good shape.',
   '["For gloves whose laces are still in good shape and do not need to be replaced.","Only recommended if laces are not dry, cracking, or damaged.","I typically clean before conditioning so dirt and contaminants are not sealed into the leather."]'::jsonb,
   'fixed', 50, null, null, null, true, true, 30, now()),

  ('lace_repair', 'Lace Repair', 'additional',
   'Targeted lace work on a specific section of the glove.',
   '["Minor lace work on a specific section of the glove. Pricing starts at $30 and may vary depending on the extent and location of the damage.","We will discuss options after the service request is reviewed.","Depending on the extent of the damage, I may recommend a full relace."]'::jsonb,
   'starting_at', 30, null, null, null, true, true, 40, now()),

  ('palm_padding', 'Palm Padding', 'additional',
   'Extra palm padding installed between the two layers of leather.',
   '["Additional palm padding installed between the two layers of leather.","Uses SHOCKtec Air2Gel."]'::jsonb,
   'fixed', 20, null, null, null, true, true, 50, now()),

  ('loop_replacement', 'Thumb / Pinky Loop Replacement', 'additional',
   'Thumb and pinky loop replacement, priced per loop.',
   '["Thumb and pinky loops can be replaced upon request.","This can be done on most gloves on the market."]'::jsonb,
   'per_item', 30, null, 'each', null, true, true, 60, now()),

  ('web_replacement', 'Web Replacement', 'additional',
   'Web replacement on request; pricing varies by web type.',
   '["Webs can be replaced upon request.","This can increase lead time because I do not keep replacement webs in stock.","Pricing varies by web type."]'::jsonb,
   'variable', null, null, null, null, true, true, 70, now())
on conflict (service_key) do nothing;

-- Initial published revision per service (the price-history genesis record).
insert into public.service_pricing_revisions
  (service_pricing_id, service_key, status, data, previous_display, new_display, note, published_at)
select sp.id, sp.service_key, 'published',
       jsonb_build_object(
         'service_name', sp.service_name,
         'category', sp.category,
         'short_description', sp.short_description,
         'bullet_details', sp.bullet_details,
         'pricing_type', sp.pricing_type,
         'base_price', sp.base_price,
         'premium_price', sp.premium_price,
         'price_suffix', sp.price_suffix,
         'display_override', sp.display_override,
         'is_public', sp.is_public,
         'is_active', sp.is_active,
         'sort_order', sp.sort_order
       ),
       null,
       case sp.service_key
         when 'standard_full_service' then '$90–$110'
         when 'full_relace' then '$60–$80'
         when 'clean_condition' then '$50'
         when 'lace_repair' then 'Starting at $30'
         when 'palm_padding' then '$20'
         when 'loop_replacement' then '$30 each'
         when 'web_replacement' then 'Prices vary'
       end,
       'Initial published pricing',
       now()
from public.service_pricing sp
where not exists (
  select 1 from public.service_pricing_revisions r
  where r.service_pricing_id = sp.id
);

-- Business settings.
insert into public.shop_settings (key, value) values
  ('target_labor_rate', 45),
  ('min_shop_charge', 30),
  ('rounding_increment', 5)
on conflict (key) do nothing;

-- Analytics mappings: public service -> measured job buckets. Standard Full
-- Service and Full Relace map across glove types (trapeze fielders is the
-- premium tier of the same service). Clean & Condition, Lace Repair, and Palm
-- Padding map by primary service value across any glove. Loop and Web
-- replacement are custom/variable and intentionally left unmapped.
insert into public.service_pricing_job_types
  (service_pricing_id, service_key, glove_type, services, trapeze)
select sp.id, m.service_key, m.glove_type, m.services, m.trapeze
from (values
  ('standard_full_service', 'Fielders Glove',  'Cleaning + Conditioning + Relacing', false),
  ('standard_full_service', 'Fielders Glove',  'Cleaning + Conditioning + Relacing', true),
  ('standard_full_service', 'Catchers Mitt',   'Cleaning + Conditioning + Relacing', false),
  ('standard_full_service', 'First Base Mitt', 'Cleaning + Conditioning + Relacing', false),
  ('full_relace',           'Fielders Glove',  'Relacing', false),
  ('full_relace',           'Fielders Glove',  'Relacing', true),
  ('full_relace',           'Catchers Mitt',   'Relacing', false),
  ('full_relace',           'First Base Mitt', 'Relacing', false),
  ('clean_condition',       null,              'Cleaning + Conditioning', false),
  ('lace_repair',           null,              'Lace Repair', false),
  ('palm_padding',          null,              'ShockTec Air2Gel Palm Pad', false)
) as m(service_key, glove_type, services, trapeze)
join public.service_pricing sp on sp.service_key = m.service_key
where not exists (
  select 1 from public.service_pricing_job_types j
  where j.service_key = m.service_key
);
