-- Customer review library for MurphOS-managed public website selections.
-- Additive and idempotent. All database access is server-side through the
-- service_role key; the public website receives a display-only projection from
-- /api/public/reviews. RLS has no policies, so direct anon/authenticated access
-- remains denied.

create table if not exists public.customer_reviews (
  id                       uuid primary key default gen_random_uuid(),
  source                   text not null default 'google',
  source_review_key        text unique,
  reviewer_name            text not null,
  reviewer_location        text,
  rating                   smallint not null default 5,
  review_text              text not null,
  review_date              date,
  relative_date_label      text,
  homepage_featured        boolean not null default false,
  homepage_excerpt         text,
  homepage_sort_order      integer not null default 0,
  services_featured        boolean not null default false,
  services_sort_order      integer not null default 0,
  hidden                   boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint customer_reviews_rating_check check (rating between 1 and 5)
);

create index if not exists customer_reviews_homepage_idx
  on public.customer_reviews (homepage_sort_order, created_at desc)
  where homepage_featured = true and hidden = false;

create index if not exists customer_reviews_services_idx
  on public.customer_reviews (services_sort_order, created_at desc)
  where services_featured = true and hidden = false;

alter table public.customer_reviews enable row level security;

revoke all on table public.customer_reviews from anon, authenticated;
grant select, insert, update, delete on table public.customer_reviews to service_role;
