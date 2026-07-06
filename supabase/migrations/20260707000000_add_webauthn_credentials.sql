create table if not exists public.webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  credential_id text not null unique,
  public_key text not null,
  sign_count bigint not null default 0,
  transports text null,
  label text null default 'Passkey',
  created_at timestamptz not null default now(),
  last_used_at timestamptz null
);

create index if not exists webauthn_credentials_credential_id_idx
  on public.webauthn_credentials (credential_id);
