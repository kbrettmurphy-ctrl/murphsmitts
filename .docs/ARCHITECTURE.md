# MurphOS Architecture

As-built baseline reviewed 2026-07-19. Source code and checked-in migrations are authoritative; `_site/` is generated output and local caches are not architecture sources.

## Runtime

MurphOS is one Cloudflare Pages deployment containing:

- a Jekyll-built public site;
- a dependency-free admin SPA under `/admin/`;
- Cloudflare Pages Functions under `/functions/api/`;
- Supabase Postgres and public Storage buckets, accessed only by Functions with the service-role credential;
- Resend email, Twilio SMS/MMS, Web Push/VAPID, optional Pushover, and Leaflet/OpenStreetMap/Nominatim integrations.

The browser never receives the Supabase service-role key. Most admin operations post an `action` payload to `/api/orders`; public read endpoints and intake are deliberately separate except for public gallery listing/search actions hosted by the orders Function.

## Source map

| Area | Source | Current responsibility |
| --- | --- | --- |
| Public site | root HTML, `_layouts/`, `_includes/`, `assets/` | Marketing pages, shared navigation/lightbox, service request form, lace availability |
| Public store | `for-sale/`, `/api/gloves-for-sale` | Read-only glove listings and photo galleries |
| Public tracking | `track/`, `/api/track` | Token-gated, customer-safe order progress and curated finished photos |
| Admin shell | `admin/index.html`, `admin/admin.css` | SPA views and presentation |
| Admin behavior | `admin/admin.js` | Authentication UI, demo sandbox, orders, dashboard, customers, calendar, map, labor, money, inventory, gallery, store, messages, users, PWA update/push behavior |
| Admin API | `functions/api/orders.js` | Signed sessions, WebAuthn, action dispatch, database/storage writes, notifications, geocoding, job logic |
| Intake | `functions/api/intake.js` | Multi-glove request validation/insertion, post-submit photos, confirmation and owner notifications |
| Inbound SMS | `functions/api/sms-reply.js` | Twilio webhook, SMS/MMS storage, YES/NO estimate response handling, alerts |
| Push helper | `functions/api/_webpush.js` | VAPID payload encryption, fan-out, expired-subscription removal |
| Data changes | `supabase/migrations/` | Additive migrations after the original live schema |
| Deployment | `wrangler.jsonc`, `_config.yml`, `Gemfile` | Pages/Workers compatibility and Jekyll build inputs |

## Admin SPA

The admin is a single HTML/CSS/JavaScript application, not a framework build. Its views are Clubhouse, Orders and Order Detail, Customers, Calendar, Map, Money, Lace Inventory, Gallery, Gloves For Sale, Messages, and admin-only Users. The browser stores the signed session token and role in `localStorage`. Demo users operate entirely against an in-browser seeded sandbox; the API independently rejects demo tokens for real-data actions.

`admin/admin.js` owns both rendering and business presentation logic. `functions/api/orders.js` repeats security-sensitive validation and server-side calculations where required. This duplication is intentional in the current system but is a maintenance risk recorded in `TECHNICAL_DEBT.md`.

## Data boundaries

- Functions call Supabase REST and Storage with server-side environment bindings.
- Public lace and store endpoints expose selected active/non-hidden records.
- Public tracking requires a 64-hex per-order token and returns only first name, order/glove identifiers, status/stage, dates, shipment tracking, and gallery photos linked to that order.
- Gallery listing and glove search expose public gallery URLs plus linkage/search descriptors, not customer contact data.
- `orders.glove_photos` is a JSON array in current writes, with defensive support for legacy serialized JSON text.

## PWA behavior

The public site has a favicon manifest but no public service worker. `/admin/` is installable with its own manifest and service worker. The admin service worker intentionally performs no caching: it claims clients, shows Web Push notifications, focuses/navigates an existing admin window on notification click, and notifies open clients to refresh messages. The SPA also hashes fetched admin assets periodically and reloads when it detects a changed build.

## Generated and local-only paths

`_site/`, `.jekyll-cache/`, `.wrangler/`, and `supabase/.temp/` are generated/local state and ignored by Git. Local secret files are ignored. Documentation must list variable names only, never values.
