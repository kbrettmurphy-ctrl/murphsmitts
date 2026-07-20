# MurphOS Deployment Environment

As-built baseline reviewed 2026-07-19. Variable names are documented; values must remain in Cloudflare/Supabase/provider secret stores or ignored local files.

## Build and runtime

- Production is documented as Cloudflare Pages from `main`; branch deployments are preview environments.
- Jekyll 4.3 with WEBrick builds the static public site. `_config.yml` defines the production site URL.
- `wrangler.jsonc` names the deployment, serves assets from the repository root, enables observability, uses `nodejs_compat`, and pins a compatibility date.
- Pages Functions are file-routed from `functions/api/`. The repository has no package manifest, bundler, test runner, CI workflow, or checked-in Pages build command.
- Supabase migrations are owner-reviewed and applied separately; application deploy does not apply them.

## Environment variable contract

| Variable | Used for |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | All database and Storage access |
| `ADMIN_PIN`, `ADMIN_SESSION_SECRET` | Owner fallback login and signed session/challenge tokens |
| `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` | Optional explicit passkey relying-party/origin configuration |
| `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_REPLY_TO` | Customer status, owner, and invite email |
| `OWNER_NOTIFICATION_EMAIL` | Optional explicit new-order recipient |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` | Outbound SMS/MMS and inbound media download authentication |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Admin Web Push |
| `PUSHOVER_APP_TOKEN`, `PUSHOVER_USER_KEY` | Optional owner alerts |

The app has feature-specific graceful skips for some optional bindings, but intake currently requires Resend configuration before it accepts an order. The admin API currently requires both admin session variables even for public actions housed in that Function.

## Deployment order

1. Review and apply new SQL migrations to the intended Supabase project.
2. Confirm required Cloudflare environment bindings exist for both production and any preview environment being tested.
3. Build Jekyll and run JavaScript/configuration checks.
4. Deploy Pages assets and Functions.
5. Smoke-test public intake/tracking/gallery/store and authenticated admin operations without recording secret values.

## Operational unknowns

Cloudflare dashboard settings, branch/build configuration, custom-domain/DNS settings, Supabase RLS and Storage policies, provider webhook configuration, backups, and production migration state are external to Git and were not verified by this repository-only review.
