# MurphOS Deployment Environment

As-built baseline reviewed 2026-07-19. Variable names are documented; values must remain in Cloudflare/Supabase/provider secret stores or ignored local files.

## Build and runtime

- Production is deployed by the Cloudflare Pages Git integration from `main`; branch deployments are preview environments. The successful Cloudflare check attached to baseline commit `6786c23` confirms the Git integration is active.
- Jekyll 4.3 with WEBrick builds the static public site. `_config.yml` defines the production site URL.
- The exact Pages dashboard Build command and Build output directory are external settings and are not checked into this repository. The deployed output is demonstrably Jekyll-generated: Jekyll-default exclusions such as `_config.yml` and `Gemfile` are absent, while files copied by the pre-Phase-1 Jekyll build were present. The expected settings are a Jekyll build command such as `bundle exec jekyll build` and output directory `_site`; confirm those exact dashboard fields before the Phase 1 preview.
- `wrangler.jsonc` is a Workers Static Assets configuration, not the Cloudflare Pages Git build configuration. Its `assets.directory` currently points to `.`. Running `wrangler deploy` would therefore create or update a Workers static-assets deployment from the repository root and is unsafe for this repository. It does not configure or deploy the file-routed Pages Functions.
- Pages Functions are file-routed from the root-level `functions/api/` directory. During a Pages Git build, Cloudflare discovers and compiles that source separately while static assets are uploaded from the configured `_site` output directory. The repository has no package manifest, bundler, test runner, or checked-in Cloudflare deployment workflow.
- Supabase migrations are owner-reviewed and applied separately; application deploy does not apply them.
- `_config.yml` explicitly excludes internal documentation, repository metadata, local secrets, migrations, Functions source, editor files, caches, and deployment-only files from `_site`.
- Deploy the generated `_site` directory as static assets. Do not run `wrangler deploy` from this repository. If a manual Pages deployment is ever required, build first and use the explicit command `wrangler pages deploy _site --project-name=murphsmitts`; running it from the repository root allows Wrangler to discover the sibling `functions/` directory while `_site` remains the static upload directory. Never use `wrangler pages deploy .`.
- Leaflet 1.9.4 is vendored under `assets/vendor/leaflet/1.9.4/` from the official 1.9.4 distribution. Its JavaScript and CSS SHA-256 values match Leaflet's published release integrity values. Keep its `images/` directory beside the CSS.

## Phase 1 perimeter verification

Before the Phase 1 deployment, production returned the actual contents of `CLAUDE.md`, the admin-users SQL migration, and `murphsmitts.code-workspace`. The Function-source probe returned the site's HTML fallback rather than JavaScript. After deployment, verify status, content type, and body rather than assuming any `200` is the requested file:

```sh
for path in \
  CLAUDE.md \
  supabase/migrations/20260708000000_add_admin_users.sql \
  functions/api/orders.js \
  murphsmitts.code-workspace
do
  curl -sS -D - "https://murphsmitts.com/$path" -o /tmp/murphos-exposure-check
  wc -c /tmp/murphos-exposure-check
  head -n 5 /tmp/murphos-exposure-check
done
```

Pass condition: none of the responses contains the requested repository source. A custom not-found page may still use HTTP 200, so a status-only check is insufficient.

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
6. Run the perimeter verification above and confirm the vendored Leaflet CSS, JavaScript, and marker images return 200 from `/assets/vendor/leaflet/1.9.4/`.

## Login rate limiting: manual Cloudflare action

No rate-limiting rule is repository-managed in Phase 1. `/api/orders` multiplexes login with normal authenticated actions, so a path-only rule would throttle the whole admin API. Failed and successful application logins also both return HTTP 200, so an edge rule cannot identify failures by response status.

Cloudflare can distinguish the JSON `action` only on plans that expose Advanced Rate Limiting with request-payload inspection. If the dashboard expression editor accepts `lookup_json_string`, configure this manually:

1. Open the `murphsmitts.com` zone in Cloudflare, then **Security > WAF > Rate limiting rules > Create rule**.
2. Name the rule `MurphOS login attempts`.
3. Use this matching expression:

   ```text
   http.host eq "murphsmitts.com" and http.request.method eq "POST" and http.request.uri.path eq "/api/orders" and lookup_json_string(http.request.body.raw, "action") eq "login"
   ```

4. Count by source IP address.
5. Set the rate to **10 requests per 60 seconds**.
6. Select **Block**, use HTTP **429**, and set the mitigation duration to **5 minutes**. If custom responses are available, use JSON such as `{"ok":false,"error":"Too many login attempts. Try again shortly."}`; otherwise retain Cloudflare's default 429 response.
7. Deploy the rule. This counts all login attempts, not only failures, but does not match passkey ceremonies or authenticated non-login actions.
8. Test from a controlled non-owner IP with a deliberately incorrect value—never the production passphrase:

   ```sh
   for n in $(seq 1 11); do
     curl -sS -o /dev/null -w "%{http_code}\n" \
       -H 'Content-Type: application/json' \
       --data '{"action":"login","email":"","password":"deliberately-wrong-test-value"}' \
       https://murphsmitts.com/api/orders
   done
   ```

   The request exceeding the threshold should return 429. Confirm ordinary authenticated admin actions remain unaffected.
9. To disable immediately, return to **Security > WAF > Rate limiting rules** and toggle `MurphOS login attempts` off (or delete it), then confirm login requests again reach the Function.

If `lookup_json_string` is unavailable or rejected, do **not** rate-limit the whole `/api/orders` path. Defer protection until a dedicated `/api/login` path, application-level throttling, or another edge-visible login route is implemented.

## Owner recovery password: optional rotation and incident response

`ADMIN_PIN` is a legacy environment-variable name, not a numeric constraint. The production value is managed as a strong recovery password, not a six-digit PIN. The login field is a standard password input, the client passes an arbitrary trimmed string, and the Function compares it as a string. Do not rename the variable without a separately planned compatibility change.

The repository can verify only how the variable is consumed; it cannot read or verify the production secret value and must not claim that it has. The owner reports that the current production value is a strong, unique 16-character password containing uppercase letters, lowercase letters, numbers, and special characters. Immediate rotation is not required merely because it is 16 characters. Login rate limiting remains recommended as defense in depth.

Use the following procedure for a routine future rotation or incident response, not as a required Phase 1 action:

1. Generate a unique longer value with a password manager; 24–32 or more random characters is appropriate for a future rotation. An offline alternative is `openssl rand -base64 32`. Do not paste the result into source, documentation, tickets, chat, or shell history.
2. In Cloudflare, open **Workers & Pages > MurphOS project > Settings > Variables and Secrets**.
3. In the Production environment, replace `ADMIN_PIN` and store it as an encrypted secret. Update Preview separately only if the owner fallback must work on preview deployments.
4. Save and redeploy so the new binding takes effect.
5. In a private browser session, leave email blank and verify the new passphrase signs in. Also verify account/password and passkey login still work.
6. Remove the old value from the password manager only after successful verification.

Rotating `ADMIN_PIN` does not invalidate already-issued 14-day signed sessions. Only rotating `ADMIN_SESSION_SECRET` invalidates them; that broader rotation is not part of Phase 1.

## Operational unknowns

Cloudflare dashboard settings, branch/build configuration, custom-domain/DNS settings, Supabase RLS and Storage policies, provider webhook configuration, backups, and production migration state are external to Git and were not verified by this repository-only review.
