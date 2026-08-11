create table if not exists public.newsletter_consents (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  first_name text,
  source text not null,
  request_key text not null unique,
  consented_at timestamptz not null default now(),
  resend_sync_status text not null default 'pending',
  resend_sync_error text,
  resend_synced_at timestamptz,
  constraint newsletter_consents_email_check
    check (email = lower(btrim(email)) and position('@' in email) > 1),
  constraint newsletter_consents_source_check
    check (source in ('homepage', 'footer', 'service_request')),
  constraint newsletter_consents_sync_status_check
    check (resend_sync_status in ('pending', 'synced', 'failed', 'suppressed'))
);

create index if not exists newsletter_consents_email_idx
  on public.newsletter_consents (email);

alter table public.newsletter_consents enable row level security;

revoke all on table public.newsletter_consents from anon, authenticated;
grant select, insert, update on table public.newsletter_consents to service_role;
