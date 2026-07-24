# MurphOS Preview Deployment Safety

How to test a feature (e.g. Pricing Management) on a Cloudflare Pages branch
preview **without touching production** — no production Supabase writes, no
production migrations, no real customer emails / SMS / push / Pushover.

## Environment signal

`functions/api/_env.js` is the single source of truth:

- `getEnvironmentName(env)` / `isPreviewEnvironment(env)`.
- Precedence: **`MURPHOS_ENV`** (authoritative: `preview`/`staging`/`dev` →
  preview; `production`/`prod`/unset/unrecognized → production) → then
  `CF_PAGES_BRANCH` (if set and ≠ `PRODUCTION_BRANCH`, default `main`, →
  preview) → default **production** (fail-safe).
- `GET /api/env` exposes only `{ ok, preview, environment }` (no secrets).

Fail-safe design: notification suppression keys off `isPreviewEnvironment()`, so
the **only** way real customer messages send is when this resolves to
`production`. Production leaves `MURPHOS_ENV` unset (or `production`) and sends
normally. **Preview must set `MURPHOS_ENV=preview`.**

## Notification suppression (preview only)

When `isPreviewEnvironment(env)` is true, these send helpers return early, send
nothing, and log `"[preview] Suppressed …"`:

- `functions/api/_webpush.js` → `sendWebPushToAll` (web push, all callers)
- `functions/api/orders.js` → `sendBrandedEmail` (Resend), `sendTwilioSms` (SMS)
- `functions/api/intake.js` → `sendBrandedEmail`, `sendTwilioText`,
  `sendPushoverNotification`
- `functions/api/sms-reply.js` → `notifyOwner` (Pushover)

Callers still receive a success-shaped result, so admin flows remain testable.
Production behavior is unchanged.

## Preview badge

A compact red `PREVIEW` pill is injected only when `/api/env` reports preview —
in MurphOS admin (`admin/admin.js` + `.mm-preview-badge` in `admin/admin.css`)
and on the public site (`assets/js/main.js` + `.mm-preview-badge` in
`assets/css/styles-17.css`). It never renders in production.

## Owner setup — required before pushing the feature branch

The preview must use an **isolated, non-production Supabase**. This repo has no
Supabase CLI branching config, so pick one:

1. **Separate staging Supabase project** (recommended, free tier is fine), or
2. **Supabase branching** enabled on the project (paid add-on) tied to the git
   branch.

Then, in **Cloudflare Pages → the murphsmitts project → Settings → Environment
variables**, set these for the **Preview** scope only (never change Production):

| Variable | Preview value |
| --- | --- |
| `MURPHOS_ENV` | `preview` (required — enables suppression + badge) |
| `SUPABASE_URL` | the **staging** project URL (must differ from production) |
| `SUPABASE_SERVICE_ROLE_KEY` | the **staging** service-role key |
| `ADMIN_PIN` | a preview-only PIN |
| `ADMIN_SESSION_SECRET` | a preview-only secret |
| `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_REPLY_TO` | omit, or dummy (also suppressed) |
| `PUSHOVER_APP_TOKEN`, `PUSHOVER_USER_KEY` | omit, or dummy (also suppressed) |
| `TWILIO_*` | omit, or dummy (also suppressed) |
| `OWNER_NOTIFICATION_EMAIL` | a test address (nothing is sent anyway) |

Confirm isolation: the Preview `SUPABASE_URL` project ref must **not** equal the
production project ref. Never print secret values.

Cloudflare Pages does not automatically copy Production variables to Preview;
whatever is unset for Preview is simply absent. If `SUPABASE_URL` is unset for
Preview, the pricing/orders Functions return a safe "missing env" error rather
than touching production.

## Apply the migration to preview only

Against the **staging** database only (verify the project ref first):

```
supabase/migrations/20260724120000_service_pricing.sql
```

Apply via the Supabase SQL editor or `supabase db push` **linked to the staging
project**. Never run it against production. After applying, verify
`service_pricing`, `service_pricing_revisions`, `shop_settings`, and
`service_pricing_job_types` exist and the seven services are published.

## Trigger the preview

Push the feature branch; the existing GitHub↔Cloudflare Pages integration builds
a branch preview at `https://murphos-pricing-management.murphsmitts.pages.dev/`.
If branch previews are disabled, enable them in Pages → Settings → Builds &
deployments → Preview deployments (All branches, or include this branch).
