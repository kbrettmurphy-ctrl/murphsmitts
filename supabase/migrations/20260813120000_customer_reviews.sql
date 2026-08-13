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

-- Seed the six reviews already approved on the public site. Stable source keys
-- make this safe to re-run and let later Google-copy imports recognize them.
insert into public.customer_reviews
  (source_review_key, reviewer_name, reviewer_location, rating, review_text,
   homepage_featured, homepage_excerpt, homepage_sort_order,
   services_featured, services_sort_order)
values
  ('site-sergio-vazquez', 'Sergio Vazquez', 'Brock, TX', 5,
   'Huge shoutout to Murph''s Mitt Maintenance for bringing my softball catcher’s glove back to life! 🥎🔥 I sent it in for a full relace and deep clean, and we honestly couldn’t be happier. The leather looks rich and refreshed, the pocket is perfectly formed again, and the new laces are tight, strong, and game-ready. My daughter said it feels secure behind the plate and has that perfect snap when catching. You can tell they truly care about craftsmanship and detail — everything was done with precision. Daughter''s glove feels broken-in but brand new at the same time. If your mitt needs some love, don’t hesitate. Brett absolutely delivers quality work and top-notch service! 💪🏆',
   true, 'The leather looks rich and refreshed, and the new laces are tight, strong, and game-ready.', 10, true, 10),
  ('site-beau-bilock', 'Beau Bilock', 'Woodbridge, VA', 5,
   'I had three gloves done by Murph''s Mitt Maintenance. Each came back better than expected. I have had relacing done in the past, but there was no difference in the structure. That was not the case after getting the gloves back from Murph. Will be doing business again.',
   true, 'I had three gloves done by Murph''s Mitt Maintenance. Each came back better than expected.', 20, true, 20),
  ('site-joshua-mcgirl', 'Joshua McGirl', 'Holly Ridge, NC', 5,
   'Very timely and professional service. Made my loose glove feel brand new yet still broke in. Fantastic service and Brett was a true professional throughout the entire process. 10/10 service and customer service.',
   true, 'Very timely and professional service. Fantastic service and customer service.', 30, true, 30),
  ('site-robert-gilliland', 'Robert Gilliland', 'Hampstead, NC', 5,
   'Brett did an amazing job on my son’s mitt and has relaced my daughter’s glove twice. If I or someone I know need a glove laced, Brett is the only one I will recommend for the job.',
   false, null, 40, true, 40),
  ('site-jason-eiseman', 'Jason Eiseman', 'Northville, MI', 5,
   'I am honestly so impressed by the quality of work and the professionalism. Just added season to my daughter’s glove',
   false, null, 50, true, 50),
  ('site-corey-swinson', 'Corey Swinson', 'Hampstead, NC', 5,
   'Had 2 gloves re-laced and restored that were in pretty awful shape. The end result was fantastic and the quick turnaround was amazing. I highly recommend Murph’s Mitt Maintenance for all your glove repair needs.',
   false, null, 60, true, 60)
on conflict (source_review_key) do nothing;
