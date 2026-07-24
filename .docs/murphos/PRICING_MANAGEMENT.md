# MurphOS Pricing Management

Owner-controlled public service pricing. Brett sets and publishes the prices on
the public Services page from MurphOS Admin — no GitHub edits, no manual Supabase
inserts. A draft/publish workflow keeps the public site stable until a change is
intentionally published, price history is recorded on every publish, and a
pricing-intelligence layer compares the published price against measured labor
and material data without ever changing historical orders.

> Note on location: the request specified `/docs/murphos/PRICING_MANAGEMENT.md`.
> This repository keeps its MurphOS docs under `.docs/murphos/`, so this file
> lives there to match the existing structure.

## Architecture

```
Public Services page (services/index.html + assets/js/main.js)
        │  GET /api/public/service-pricing   (read-only, no auth, cached)
        ▼
functions/api/public/service-pricing.js ──► service_pricing (published rows only)
        ▲
        │ imports display logic
functions/api/_pricing.js  (shared: display formatting, rounding, public mapper, fallback)
        ▲
        │ imports formatServiceDisplayPrice
functions/api/orders.js  (admin actions, ADMIN_SESSION_SECRET-gated)
        ▲
        │ postJson({ action: ... }, useAuth=true)
MurphOS Admin → Pricing view + Money view + Order Detail (admin/admin.js)
```

- **Public reads** only ever touch `service_pricing` rows that are
  `is_public = true` and `published_at IS NOT NULL`. `is_active` is **not**
  required for public visibility — it governs internal quote availability only
  (see "Active vs public"). Drafts, internal notes, and raw base/premium fields
  never reach the browser.
- **Admin writes** all go through `functions/api/orders.js` action blocks, each
  validated with `validateTokenFromBody(body, env.ADMIN_SESSION_SECRET)`.
- **Supabase** is reached exclusively with the service-role key from server-side
  Cloudflare Functions. That key is never exposed to client JavaScript.

## Tables and fields

Migration: `supabase/migrations/20260724120000_service_pricing.sql` (additive,
idempotent, RLS enabled with no policies — the service-role key bypasses RLS,
so the anon role is denied direct access).

### `service_pricing` — the live, published state the public site reads

| Column | Notes |
| --- | --- |
| `id` uuid | primary key |
| `service_key` text unique | stable internal key (never renamed) |
| `service_name` text | editable public name |
| `category` text | `relacing` \| `additional` (display grouping) |
| `short_description` text | internal / quote context, not shown publicly |
| `bullet_details` jsonb | array of plain-text strings (no HTML stored) |
| `pricing_type` text | `fixed` \| `range` \| `starting_at` \| `per_item` \| `variable` \| `tiered` |
| `base_price` numeric | standard / starting / per-item price |
| `premium_price` numeric | upper tier (tiered/range) |
| `price_suffix` text | e.g. `each` |
| `display_override` text | manual public display; wins over generated text |
| `is_public` boolean | appears on the public website |
| `is_active` boolean | offered for new quote suggestions / new orders |
| `sort_order` integer | display order within a category |
| `created_at` / `updated_at` / `published_at` timestamptz | lifecycle stamps |

### `service_pricing_revisions` — drafts + immutable published history

| Column | Notes |
| --- | --- |
| `id` uuid | primary key |
| `service_pricing_id` uuid | FK → `service_pricing` (cascade delete) |
| `service_key` text | denormalized for convenience |
| `status` text | `draft` \| `published` \| `archived` |
| `data` jsonb | full snapshot of editable fields (snake_case) |
| `previous_display` text | public price display before this publish |
| `new_display` text | public price display after this publish |
| `note` text | internal reason |
| `created_at` / `published_at` timestamptz | lifecycle stamps |

A partial unique index (`status = 'draft'`) enforces **at most one open draft per
service**. Publishing flips the draft row to `status = 'published'`, so it becomes
the history record and frees the draft slot for the next edit.

### `shop_settings` — editable pricing-development settings (key/value)

Seeded keys: `target_labor_rate` (45), `min_shop_charge` (30),
`rounding_increment` (5). Editable in the Pricing view. These never change
recorded labor or historical prices.

### `service_pricing_job_types` — analytics mappings

Maps a public service to measured job buckets: `glove_type` (NULL = any),
`services` (primary selected service value), `trapeze` (fielders trapeze/mod-
trapeze premium tier). Flexible — not hardcoded to the current seven. New glove
types or service combinations can be mapped by inserting rows.

## Draft and publish workflow

1. **Editing** a service in the Pricing view writes/updates a `draft` revision
   (`saveServicePricingDraft`). The live row — and the public website — are
   unchanged.
2. The Pricing screen flags a service **`Draft`** when the draft differs from
   the live row, and shows the draft price alongside the live price.
3. **Publish Changes** (`publishServicePricing`) requires a confirmation, then:
   - copies the draft snapshot into the live `service_pricing` row,
   - sets `published_at` / `updated_at`,
   - flips the draft revision to `published`, recording `previous_display` and
     `new_display` for history.
4. **Discard Draft** (`discardServicePricingDraft`) deletes the draft; live
   pricing is untouched.
5. The public endpoint reads only published rows, so **draft data never leaks**.

## Public endpoint

`GET /api/public/service-pricing` — `functions/api/public/service-pricing.js`

- GET only, no admin token.
- Returns only `is_public = true` and `published_at IS NOT NULL` services,
  sorted by category then sort order. `is_active` is intentionally **not**
  filtered — a public but inactive service still shows on the website. The
  PostgREST query enforces this, and the endpoint re-applies `publiclyVisible()`
  from `_pricing.js` in code as defense in depth so a hidden/unpublished row can
  never leak even if the query changes.
- Response shape per service: `serviceKey`, `name`, `category`,
  `shortDescription`, `bullets[]`, `pricingType`, `price` (display string),
  `sortOrder`. No drafts, notes, raw base/premium, or secrets.
- Cache headers: `public, max-age=300, s-maxage=300, stale-while-revalidate=600`.
  Error responses use `no-store`.

## Admin endpoints (actions in `functions/api/orders.js`)

All require a valid admin session token.

| Action | Purpose |
| --- | --- |
| `listServicePricing` | Live rows + current draft (with `differs` flag) + settings + analytics mappings |
| `saveServicePricingDraft` | Create/update the draft for a service |
| `discardServicePricingDraft` | Delete the draft |
| `publishServicePricing` | Publish draft → live + write history record |
| `listServicePricingHistory` | Published revisions (optionally per service) |
| `restoreServicePricingRevision` | Copy a published revision into a new draft (rollback) |
| `createServicePricing` | Add a new service (starts hidden + inactive, unpublished) |
| `getShopSettings` / `saveShopSettings` | Read/update target rate, min charge, rounding |

## Pricing formulas

- **Published price** — customer-facing price on the website (the live row).
- **Average charged price** — mean `priceQuoted` of completed/ready historical
  jobs mapped to the service (what was actually charged).
- **Target labor rate** — a pricing-development input (`$45/hr` default).
- **Effective labor rate** — an actual result:
  `(price − materials) ÷ measured labor hours`, aggregated across the service's
  measured jobs. Only jobs with logged labor + a price count.
- **Target-price estimate**:
  `raw = (median measured hours × target rate) + average material cost`
  then `suggested = round( max(raw, minimum shop charge) , rounding increment )`.
  Both the **raw** amount and the **rounded suggestion** are shown.

Shared display formatting and `roundToIncrement` live in
`functions/api/_pricing.js`; the admin client mirrors them in `admin.js`
(`pricingDisplayText`, `pricingRoundToIncrement`). `scripts/pricing-selftest.mjs`
asserts these against the spec examples.

## Minimum shop charge behavior

The minimum shop charge floors the **suggested** price only:
`max(labor-and-material price, minimum shop charge)`. It never affects recorded
labor time, effective rate, or any historical value. When the floor is applied,
the suggestion is labeled `(min charge)`.

## Confidence levels

Graduated by count of measured jobs (jobs with logged labor and usable
price/material data). The sample count is always shown.

| Jobs | Label |
| --- | --- |
| 0 | No data |
| 1–2 | Early estimate |
| 3–5 | Learning |
| 6–10 | Good confidence |
| 11–25 | Strong confidence |
| 26+ | Established benchmark |

## Target rate vs effective rate, and price health

The interpretation deliberately avoids simplistic "Under/Over Target" labels.
Once a fixed price is set, completing the same-quality job faster **raises** the
effective labor rate — that is positive efficiency, not a reason to cut the
price. Labels: `Needs More Data`, `Learning`, `Price Covers Target`,
`Below Target at Current Median Time`, `Efficiency Improved`, `Strong Margin`,
`Review Recommended`.

- *Example A*: $90 price, median 1h40, materials $15, target $45/hr →
  "Price Covers Target".
- *Example B*: median improves to 1h20 at the same $90 → "Efficiency Improved"
  (effective rate rose; price unchanged). The system never recommends lowering
  the price because you got faster.

## Time trend

Where at least 4 measured jobs exist, recent job times are compared with earlier
ones: `Efficiency Improved`, `Stable`, `Slower Recently`, or `Not Enough Data`.
Faster work is never treated as a pricing problem.

## Analytics mappings

A public service can map to several measured job buckets (glove type + service
combination, with a trapeze flag for the premium tier). Attribution picks the
richest primary service when an order matches more than one (relacing first,
then by sort order), so add-ons like Palm Padding never steal a job's labor.
Mappings are DB rows (`service_pricing_job_types`), returned by
`listServicePricing`, so new glove types / combinations are added by inserting
rows — not by changing code.

## Price history

Every publish writes a readable record: service, previous public price → new
public price, publish date, optional internal note, and the full field snapshot.
Viewable per service in the Pricing editor ("View price history").

## Historical-order protection

Publishing pricing changes only affects the public website, future quote
suggestions, and new orders where a default price is requested. It never alters
existing order quotes, approved/charged prices, completed revenue, or historical
analytics inputs. In the order flow the published price is shown as a
**display-only** hint next to Price Quoted and in Send Estimate — it never
overwrites a manually entered quote, and changing the glove type or service does
not silently replace an existing quote.

## Active vs public

- **Public** controls whether the service appears on the public website.
- **Active** controls whether the service is offered for future quote
  suggestions / new-order selection.

They are **independent** flags — one never gates the other:

| is_public | is_active | On website? | Available for new quotes? |
| --- | --- | --- | --- |
| true | true | yes | yes |
| true | false | yes | no |
| false | true | no | yes (internal) |
| false | false | no | no |

An inactive service stays in historical reporting; a hidden service can remain
active internally. Enforcement points share one source of truth in
`_pricing.js`: `publiclyVisible()` (public endpoint, published + `is_public`)
and `quoteAvailable()` (published + `is_active`; the admin client's
`getPublishedPriceForOrder` applies the camelCase equivalent). Publishing is
required for either to be true.

## How to add a new service through the GUI

1. Pricing view → **+ New service** → name + category → **Create Service**.
   The service is created hidden and inactive (never leaks publicly).
2. Its editor opens. Fill in pricing type, prices, bullets, etc. Turn on
   **Public** and **Active** when ready.
3. **Save Draft** to keep working, or **Publish Changes** to make it live.
4. To also show it on the public page, the service renders automatically once
   published — `assets/js/main.js` appends any published service that has no
   static article into the matching category section.

## How to publish pricing

Pricing view → open the service → edit fields → **Publish Changes** → confirm.
The public site updates on its next cache cycle (≤ 5 minutes; the page also
fetches fresh on load).

## How to roll back or restore a prior published revision

Pricing view → open the service → **View price history** → **Restore as draft**
on the desired revision. This creates a draft from that revision's snapshot.
Review it, then **Publish Changes** to make it live again. Rolling back is always
a review-then-publish action — it never silently changes the live price.

## How public fallback pricing works

`initPublicServicePricing()` in `assets/js/main.js` resolves pricing in three
tiers, so the page never goes blank and never shows a stale hardcoded value once
a newer price has been published:

1. **Live** — fetch `/api/public/service-pricing`. On a valid, non-empty
   response it renders the services and saves a **last-known-good** snapshot to
   `localStorage` (`mm.servicePricing.v1`): `{ version, savedAt, services }`,
   where each service is normalized to public fields only. A successful response
   always replaces any previous snapshot.
2. **Last-known-good** — if the API fails or returns malformed/empty data, the
   loader reads and validates the stored snapshot (version + non-empty
   well-formed services) and renders it. This keeps the *most recently
   published* prices showing after future changes, not just today's.
3. **Static markup** — only if the API is unavailable **and** no valid snapshot
   exists does the page keep the static approved-price markup already in
   `services/index.html`.

Guarantees: only public, published endpoint data is ever cached (never drafts);
the stored object is validated before use; malformed or outdated-schema storage
is ignored rather than breaking the page (bump `SERVICE_PRICING_CACHE_VERSION` to
invalidate old snapshots); no private data or secrets are stored; and every
fallback is logged to the browser console — customers never see a technical
error. The cache helpers mirror `functions/api/_pricing.js`
(`SERVICE_PRICING_CACHE_VERSION`, `normalizeServiceForCache`,
`isValidServicesPayload`), which the self-test exercises directly.
