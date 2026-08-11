alter table public.newsletter_consents
  drop constraint if exists newsletter_consents_source_check;

alter table public.newsletter_consents
  add constraint newsletter_consents_source_check
  check (source in ('homepage', 'footer', 'service_request', 'customer_invitation'));

create table if not exists public.newsletter_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  email text not null,
  first_name text,
  source text not null default 'past_customer',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  revoked_at timestamptz,
  constraint newsletter_invites_token_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint newsletter_invites_email_check
    check (email = lower(btrim(email)) and position('@' in email) > 1),
  constraint newsletter_invites_source_check
    check (source in ('past_customer')),
  constraint newsletter_invites_expiry_check
    check (expires_at > created_at)
);

create index if not exists newsletter_invites_email_idx
  on public.newsletter_invites (email);

alter table public.newsletter_invites enable row level security;

revoke all on table public.newsletter_invites from anon, authenticated;
grant select, insert, update on table public.newsletter_invites to service_role;
