-- Security: enable Row-Level Security on every public table. The app accesses
-- Supabase exclusively via the service_role key (server-side Cloudflare
-- Functions), which BYPASSES RLS — so enabling RLS with no policies denies the
-- anon/public role entirely while leaving the app fully functional. Closes the
-- Supabase advisor "rls_disabled_in_public" warnings.
alter table public.admin_users            enable row level security;
alter table public.gallery_photo_links    enable row level security;
alter table public.glove_sale_photos      enable row level security;
alter table public.gloves_for_sale        enable row level security;
alter table public.lace_inventory         enable row level security;
alter table public.order_activity         enable row level security;
alter table public.order_labor_sessions   enable row level security;
alter table public.order_lace_usage       enable row level security;
alter table public.orders                 enable row level security;
alter table public.push_subscriptions     enable row level security;
alter table public.shop_expenses          enable row level security;
alter table public.sms_messages           enable row level security;
alter table public.webauthn_credentials   enable row level security;
