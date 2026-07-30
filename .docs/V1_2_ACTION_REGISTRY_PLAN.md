# MurphOS v1.2: Action Registry Plan

Status: planning only

Baseline: `main` at `3afc3cd95863ab25102de246377cb44eab11c504`

Audited implementation: `functions/api/orders.js` (6,964 lines)

Behavior changes in this stage: none

## Goals and invariants

The v1.2 refactor will replace the linear `if (action === "...")` dispatcher with an explicit action registry and one central authorization/demo gate. Handler extraction must not change:

- response bodies, HTTP status codes, JSON headers, or the GET health response;
- body parsing, action trimming, unknown-action behavior, or top-level exception behavior;
- `_token`-in-body authentication;
- owner PIN login, password login, invite, and WebAuthn behavior;
- current owner/admin/demo behavior, including immediate role/deactivation resolution only where it happens today;
- demo-mode denial bodies and the unusual behavior of anonymous public requests that include a valid demo token;
- validation order and messages;
- order-update and inventory-update whitelists;
- Supabase tables, storage buckets, REST paths, and `Prefer` behavior;
- email, SMS, push, geocoding, and preview-suppression behavior;
- environment-variable preflight behavior;
- Cloudflare Pages Functions' `onRequest(context)` entry point;
- dependency-free Web APIs and the repository's no-build deployment.

This document describes the current behavior, including behavior that should receive security or product review. The first migration must reproduce it before any intentional policy change.

## Current request pipeline

1. GET returns `{ ok: true, message: "admin-api is alive" }` with HTTP 200.
2. non-POST methods return `{ ok: false, error: "Method not allowed: ..." }` with HTTP 405.
3. POST reads and JSON-parses the complete request body and trims `body.action`.
4. Every POST action, including public actions, fails with HTTP 500 unless all four baseline bindings exist: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PIN`, and `ADMIN_SESSION_SECRET`.
5. Before action dispatch, every action outside the five-name demo allowlist validates any `_token` in the body. A valid token with role `demo` receives `{ ok:false, error:"Demo mode: that action runs in your sandbox only.", demo:true }` with HTTP 200. A missing or invalid token does not trigger this global denial and is left to the action.
6. The matching action block performs its own authentication, authorization, validation, and work.
7. Unknown or blank actions return HTTP 200 with `{ ok:false, error:"Unknown action: ..." }`.
8. Uncaught errors return HTTP 500 with `{ ok:false, error }`.

The demo allowlist is currently:

```js
new Set([
  "login",
  "getInvite",
  "acceptInvite",
  "webauthnLoginOptions",
  "webauthnLoginVerify"
]);
```

## Authentication taxonomy and counts

The requested categories are assigned by the strongest requirement currently enforced by each action:

| Category | Count | Current meaning |
|---|---:|---|
| public | 8 | No valid session is required for the normal public path. `listGalleryPhotos` becomes session-protected when `includeHidden === true`. |
| valid session | 63 | Only the HMAC signature and expiration of `body._token` are checked. The backing user is not reloaded and active status is not resolved. |
| resolved active user | 0 | No current action requires a valid session and resolves a non-owner account as active without also requiring admin. |
| admin only | 5 | `requireAdmin` validates the token, resolves the owner's escape hatch or reloads the user by token email, rejects missing/inactive users, and requires current role `admin`. |
| **Total** | **76** | Distinct supported action strings, counting the three gallery lifecycle actions separately. |

`login` does resolve an active user while authenticating credentials, but its API access category remains public. It is not counted as a “resolved active user” protected action.

## Binding legend

Every action inherits the four-binding POST preflight:

- **CORE** — `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PIN`, `ADMIN_SESSION_SECRET`.

Additional binding abbreviations:

- **RESEND** — `RESEND_API_KEY` required on a real email-send path; `RESEND_FROM` and `RESEND_REPLY_TO` optional formatting overrides.
- **TWILIO** — `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`.
- **VAPID** — `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`; push is best-effort and silently skipped when absent. `getPushPublicKey` returns an empty string when the public key is absent.
- **WEBAUTHN** — optional `WEBAUTHN_ORIGIN` and `WEBAUTHN_RP_ID`; hard-coded production defaults are used when absent.
- **ENV-SIGNAL** — optional `MURPHOS_ENV`, `CF_PAGES_BRANCH`, and `PRODUCTION_BRANCH`; controls suppression of email, SMS, and push in previews.
- **GEO** — no secret binding; external US Census and OpenStreetMap Nominatim HTTP services.

Supabase REST and Storage are external HTTP services reached through CORE rather than native Worker bindings.

## Proposed registry metadata

The example `auth`, `demo`, and `handler` fields are not sufficient to preserve this dispatcher. The registry should record enough policy to make central enforcement explicit while leaving business validation in handlers:

```js
const ACTIONS = {
  listOrders: {
    auth: "session",                 // public | session | active-user | admin
    demo: "deny",                    // allow | deny
    handler: handleListOrders,
    effects: ["db:orders:read"],
    bindings: { required: CORE, optional: [] }
  },
  listGalleryPhotos: {
    auth: ({ body }) => body.includeHidden === true ? "session" : "public",
    demo: "deny",
    handler: handleListGalleryPhotos,
    effects: ["db:gallery_photo_links:read", "storage:gallery:list"],
    bindings: { required: CORE, optional: [] }
  }
};
```

Recommended complete metadata:

- `auth`: static policy or a narrowly defined resolver for the one current conditional action;
- `demo`: exact global allow/deny policy, evaluated before auth to preserve today’s ordering;
- `handler`: extracted function reference;
- `effects`: auditable DB/storage/notification/external-service capabilities;
- `bindings.required` and `bindings.optional`: documentation and later startup diagnostics, not a new per-action preflight in the behavior-preserving phase;
- optional `notes`: only for exceptional compatibility constraints such as conditional auth or partial-success responses.

The central dispatcher should resolve the entry first, preserve the global environment preflight, apply demo policy in the current order, apply the declared auth policy exactly once, and then invoke `handler({ context, request, env, body, action, auth, jsonHeaders })`. Handlers should return the same `Response` objects they return today. An `active-user` policy should exist in the architecture even though no current action uses it.

## Complete action inventory and proposed entries

The tables are in exact source order. “Demo deny” means the current pre-dispatch backstop rejects a valid demo token. For the three public actions outside the demo allowlist, an anonymous request is still allowed; that inconsistency is called out as “deny-token/anonymous-allow.”

### Authentication, users, push, and messages

| # | Action → proposed handler | Auth | Demo | Major side effects | Bindings | Current in-block validation and authorization |
|---:|---|---|---|---|---|---|
| 1 | `login` → `handleLogin` | public | allow | DB read `admin_users`; successful password login patches `last_login_at`; signs session token | CORE | Normalize email; accept blank-email exact `ADMIN_PIN` owner escape hatch; otherwise require email/password; find user; require `active !== false`; PBKDF2 verify; generic lookup failure, specific bad-credential response. |
| 2 | `getInvite` → `handleGetInvite` | public | allow | DB read `admin_users` by invite token | CORE | Require a matching non-null invite token indirectly; reject missing/used and expired invite; exposes only email, display name, role. |
| 3 | `acceptInvite` → `handleAcceptInvite` | public | allow | DB read/patch `admin_users`; best-effort push to all; signs session token | CORE; optional VAPID, ENV-SIGNAL | Password minimum 8; require valid unused/unexpired invite; hash password; set password fields, clear invite, activate user, stamp login. Push failures do not affect response. |
| 4 | `listUsers` → `handleListUsers` | admin only | deny | DB read `admin_users` | CORE | `requireAdmin`; current user/owner role resolution; maps rows without password material. |
| 5 | `createUserInvite` → `handleCreateUserInvite` | admin only | deny | DB read/insert `admin_users`; optional Resend email | CORE; optional RESEND, ENV-SIGNAL, WEBAUTHN-origin-as-link-base | `requireAdmin`; normalize/validate email; coerce role to `admin` or `demo`; reject existing email; random token, seven-day expiry. Email is attempted only if key exists; `emailed` reports outcome. |
| 6 | `setUserPassword` → `handleSetUserPassword` | admin only | deny | DB patch `admin_users` | CORE | `requireAdmin`; require user ID and 8-character password; hash; clear invite; activate target. Does not verify affected row exists. |
| 7 | `updateUser` → `handleUpdateUser` | admin only | deny | DB patch `admin_users` | CORE | `requireAdmin`; require user ID; whitelist role, active, display name; role coerced to `admin`/`demo`; require at least one update. No self/last-admin guard. |
| 8 | `deleteUser` → `handleDeleteUser` | admin only | deny | DB delete `admin_users` | CORE | `requireAdmin`; require user ID. No self/last-admin guard and no returned-row existence check. |
| 9 | `getPushPublicKey` → `handleGetPushPublicKey` | public | deny-token/anonymous-allow | none | CORE; optional `VAPID_PUBLIC_KEY` | No local auth or input validation; returns key or empty string. |
| 10 | `savePushSubscription` → `handleSavePushSubscription` | valid session | deny | DB upsert `push_subscriptions` | CORE | Validate `_token`; require endpoint and `p256dh`/`auth` keys; optional cleaned label. Does not validate endpoint scheme/origin. |
| 11 | `sendTestPush` → `handleSendTestPush` | valid session | deny | DB read/prune `push_subscriptions`; external Web Push sends | CORE; optional VAPID, ENV-SIGNAL | Validate `_token`; no admin/active-user resolution; push helper suppresses preview, skips missing VAPID, catches all failures. Always returns success after helper. |
| 12 | `listMessages` → `handleListMessages` | valid session | deny | DB read up to 300 `sms_messages` | CORE | Validate `_token`; no additional input. |
| 13 | `markMessagesRead` → `handleMarkMessagesRead` | valid session | deny | DB patch `sms_messages` | CORE | Validate `_token`; optional cleaned phone narrows update; blank phone marks every unread message read. |
| 14 | `deleteMessage` → `handleDeleteMessage` | valid session | deny | DB delete `sms_messages` | CORE | Validate `_token`; require cleaned message ID. |
| 15 | `deleteMessageThread` → `handleDeleteMessageThread` | valid session | deny | DB delete `sms_messages` for phone list | CORE | Validate `_token`; require array, filter truthy, cap 20; strip quotes when building PostgREST `in` list. No phone normalization. |
| 16 | `sendMessageReply` → `handleSendMessageReply` | valid session | deny | optional Storage upload to `order-photos/sms-out`; Twilio SMS/MMS; DB insert `sms_messages` | CORE, TWILIO; optional ENV-SIGNAL | Validate `_token`; normalize US destination; require text or media; require all Twilio bindings; accept `data:image/*`, decode and upload as png/jpg; send; best-effort/unverified message-log insert. No explicit media size cap. |

### Orders, activity, WebAuthn, and labor

| # | Action → proposed handler | Auth | Demo | Major side effects | Bindings | Current in-block validation and authorization |
|---:|---|---|---|---|---|---|
| 17 | `listOrders` → `handleListOrders` | valid session | deny | DB read all `orders` | CORE | Validate `_token`; maps DB rows to client shape. |
| 18 | `listInventory` → `handleListInventory` | valid session | deny | DB read `lace_inventory` | CORE | Validate `_token`; no additional input. |
| 19 | `createInventoryItem` → `handleCreateInventoryItem` | valid session | deny | DB read then insert `lace_inventory` | CORE | Validate `_token`; require color; case/space-normalized uniqueness check; validate nonnegative integer quantity/reorder values; capability-detect columns; whitelist payload. |
| 20 | `updateInventoryItem` → `handleUpdateInventoryItem` | valid session | deny | DB read then patch `lace_inventory` | CORE | Validate `_token`; require current color and existing row; validate renamed-color uniqueness; whitelist supported fields; integer checks; empty update returns current row. |
| 21 | `getOrder` → `handleGetOrder` | valid session | deny | DB read one `orders` row | CORE | Validate `_token`; trim/require order number; generic not-found response also covers read failure. |
| 22 | `listOrderActivity` → `handleListOrderActivity` | valid session | deny | DB read up to 50 `order_activity` rows | CORE | Validate `_token`; require cleaned order number. |
| 23 | `listOrdersWithActivity` → `handleListOrdersWithActivity` | valid session | deny | DB read `order_activity` | CORE | Validate `_token`; excludes `order_created_manual`; deduplicates order numbers. |
| 24 | `webauthnRegisterOptions` → `handleWebauthnRegisterOptions` | valid session | deny | DB read all `webauthn_credentials`; signs challenge token | CORE; optional WEBAUTHN | Validate `_token` only; create five-minute registration challenge; construct fixed owner/RP options; exclude all stored credentials. Does not resolve active user or require admin. |
| 25 | `webauthnRegisterVerify` → `handleWebauthnRegisterVerify` | valid session | deny | DB insert `webauthn_credentials`; WebCrypto verification | CORE; optional WEBAUTHN | Validate `_token`; verify signed challenge kind/expiry; parse client data and CBOR; require create ceremony, challenge, allowed origin, RP hash, presence, ES256/P-256; store credential and label. Does not resolve active user or require admin. |
| 26 | `webauthnLoginOptions` → `handleWebauthnLoginOptions` | public | allow | DB read all `webauthn_credentials`; signs challenge token | CORE; optional WEBAUTHN | No session; creates five-minute auth challenge and exposes registered credential IDs. |
| 27 | `webauthnLoginVerify` → `handleWebauthnLoginVerify` | public | allow | DB read/patch `webauthn_credentials`; WebCrypto verification; signs owner/admin session token | CORE; optional WEBAUTHN | Verify challenge, credential ID, get ceremony, challenge, allowed origin, RP hash, presence, signature; store max sign count without enforcing monotonicity; always issues `sub:"owner", role:"admin"`. |
| 28 | `listLaborSessions` → `handleListLaborSessions` | valid session | deny | DB read `order_labor_sessions` for order | CORE | Validate `_token`; require order number; no check that order exists. |
| 29 | `startLaborSession` → `handleStartLaborSession` | valid session | deny | DB reads open sessions; inserts labor session; best-effort DB insert `order_activity` | CORE | Validate `_token`; require order number and phase; phase allowlist; reject any running timer and any open timer for this order. Does not verify order exists. |
| 30 | `stopLaborSession` → `handleStopLaborSession` | valid session | deny | DB read/patch labor session; best-effort activity insert | CORE | Validate `_token`; require session ID; require existing, not stopped; calculate active duration excluding pause; optional note replacement. |
| 31 | `listOpenLaborSessions` → `handleListOpenLaborSessions` | valid session | deny | DB read all open labor sessions | CORE | Validate `_token`; no input. |
| 32 | `listLaborSummary` → `handleListLaborSummary` | valid session | deny | DB read all stopped labor session summary fields | CORE | Validate `_token`; no input; Money/pricing consumer. |
| 33 | `pauseLaborSession` → `handlePauseLaborSession` | valid session | deny | DB read/patch labor session | CORE | Validate `_token`; require session ID; require existing, open, and not already paused; optional note replacement. |
| 34 | `resumeLaborSession` → `handleResumeLaborSession` | valid session | deny | DB reads session/all open sessions; patches session | CORE | Validate `_token`; require ID; require existing, open, paused; reject another running timer; add paused seconds; optional note replacement. |
| 35 | `updateLaborSessionNotes` → `handleUpdateLaborSessionNotes` | valid session | deny | DB read/patch labor session | CORE | Validate `_token`; require session ID and existing row; clean note to string/null. |
| 36 | `deleteOrder` → `handleDeleteOrder` | valid session | deny | DB delete `orders` | CORE | Validate `_token`; require trimmed order number; does not require admin, verify a row was deleted, or explicitly delete related storage/data. |
| 37 | `uploadOrderPhoto` → `handleUploadOrderPhoto` | valid session | deny | DB read/patch `orders`; Storage upload `order-photos`; best-effort activity insert | CORE | Validate `_token`; require order number, filename, data URL; image MIME prefix; require existing order; decoded payload max 8 MiB; deduplicate photo URLs. |
| 38 | `removeOrderPhoto` → `handleRemoveOrderPhoto` | valid session | deny | DB read/patch `orders`; best-effort activity insert | CORE | Validate `_token`; require order number/URL; require existing order and URL membership. Removes DB reference only; does not delete Storage object. |
| 39 | `createOrder` → `handleCreateOrder` | valid session | deny | DB read order numbers; insert `orders`; best-effort activity insert | CORE | Validate `_token`; require customer name and phone/email; SMS opt-in requires phone; shipped orders require full address; update whitelist; generate tracking token; retry order-number collision up to three times. |
| 40 | `resendStatusEmail` → `handleResendStatusEmail` | valid session | deny | DB read/patch `orders`; Resend email; best-effort activity insert | CORE, RESEND; optional ENV-SIGNAL, RESEND overrides | Validate `_token`; require existing order/status; reject internal status and missing recipient/key; send before stamping and logging. Preview returns suppressed success and is still stamped/logged. |
| 41 | `resendStatusText` → `handleResendStatusText` | valid session | deny | DB read/patch `orders`; Twilio SMS; DB insert `sms_messages`; best-effort activity insert | CORE, TWILIO; optional ENV-SIGNAL | Validate `_token`; require existing order/status; require text-enabled status, opt-in, phone, bindings; send before stamp/log. Preview suppression behavior differs from `sendStatusText` path noted below. |
| 42 | `updateOrder` → `handleUpdateOrder` | valid session | deny | DB read/patch `orders`; DB inventory reads/patches; activity inserts; conditional Resend/Twilio; message logging; status stamp patches | CORE; conditional RESEND/TWILIO; optional ENV-SIGNAL and RESEND overrides | Validate `_token`; require order number/existing row; apply `mapUpdatesToDb` whitelist; shipped-completed payment guard; auto completion date; require Resend key before patch when email needed; adjust inventory and log field changes after patch; conditionally send/stamp/log email and SMS. Multiple documented partial-success responses. |

### Map, gallery upload, Money, and pricing

| # | Action → proposed handler | Auth | Demo | Major side effects | Bindings | Current in-block validation and authorization |
|---:|---|---|---|---|---|---|
| 43 | `geocodeAddresses` → `handleGeocodeAddresses` | valid session | deny | Census and Nominatim reads; deliberate delays | CORE, GEO | Validate `_token`; coerce items array; helper drops invalid items, caps 250 items and 8 candidates each; no DB writes. |
| 44 | `geocodeMissingOrderAddresses` → `handleGeocodeMissingOrderAddresses` | valid session | deny | DB read/patch `orders`; Census/Nominatim reads; delays | CORE, GEO | Validate `_token`; array/caps as above; require per-item order number/candidates; reuse matching stored hash/coordinates; store success or failure metadata. |
| 45 | `uploadGalleryPhoto` → `handleUploadGalleryPhoto` | valid session | deny | Storage upload `gallery` | CORE | Validate `_token`; require filename/data; image MIME prefix; sanitize/default section/name; no explicit decoded-size cap. |
| 46 | `listExpenses` → `handleListExpenses` | valid session | deny | DB read up to 500 `shop_expenses` | CORE | Validate `_token`; maps numeric fields. |
| 47 | `createExpense` → `handleCreateExpense` | valid session | deny | DB insert `shop_expenses` | CORE | Validate `_token`; require date/category and finite positive amount; optional positive quantity and cleaned fields. Date format/category vocabulary are not constrained. |
| 48 | `deleteExpense` → `handleDeleteExpense` | valid session | deny | DB delete `shop_expenses` | CORE | Validate `_token`; require expense ID; does not verify affected row. |
| 49 | `listServicePricing` → `handleListServicePricing` | valid session | deny | DB reads `service_pricing`, revisions, job types, settings | CORE | Validate `_token`; live-row read is required; draft/mapping failures degrade to empty; settings helper supplies defaults. |
| 50 | `saveServicePricingDraft` → `handleSaveServicePricingDraft` | valid session | deny | DB read service/draft; insert or patch revision | CORE | Validate `_token`; require existing service key; `buildPricingDraftData` validates service name, category/type and numeric price requirements; clean note; upsert-by-branch behavior. |
| 51 | `discardServicePricingDraft` → `handleDiscardServicePricingDraft` | valid session | deny | DB read service; delete draft revisions | CORE | Validate `_token`; require existing service; no affected-row requirement. |
| 52 | `publishServicePricing` → `handlePublishServicePricing` | valid session | deny | DB read service/draft; patch live service; patch revision history | CORE | Validate `_token`; require service and object draft; whitelist live snapshot fields/defaults; live patch occurs before revision promotion. Not admin-only. |
| 53 | `listServicePricingHistory` → `handleListServicePricingHistory` | valid session | deny | DB read published revisions | CORE | Validate `_token`; optional service key; limit 200; maps snapshot. |
| 54 | `restoreServicePricingRevision` → `handleRestoreServicePricingRevision` | valid session | deny | DB read revision/draft; patch or insert draft | CORE | Validate `_token`; require revision ID and revision data; creates dated restore note. Does not independently verify target live service still exists. |
| 55 | `createServicePricing` → `handleCreateServicePricing` | valid session | deny | DB reads service/sort orders; inserts `service_pricing` | CORE | Validate `_token`; require name; derive or validate lowercase key; uniqueness lookup; category/type allowlists; new row forced hidden/inactive/unpublished. Not admin-only. |
| 56 | `getShopSettings` → `handleGetShopSettings` | valid session | deny | DB read `shop_settings` | CORE | Validate `_token`; defaults missing/failed settings through helper. |
| 57 | `saveShopSettings` → `handleSaveShopSettings` | valid session | deny | DB upsert/read `shop_settings` | CORE | Validate `_token`; positive target/rounding and nonnegative minimum; require at least one valid value. |

### Gallery management, store, and public actions

| # | Action → proposed handler | Auth | Demo | Major side effects | Bindings | Current in-block validation and authorization |
|---:|---|---|---|---|---|---|
| 58 | `setGalleryPhotoCover` → `handleSetGalleryPhotoCover` | valid session | deny | DB read/patch `gallery_photo_links` | CORE | Validate `_token`; require URL and linked order; clear every cover for order, then set URL cover. Non-transactional; first patch result ignored. |
| 59 | `setGalleryPhotoOrder` → `handleSetGalleryPhotoOrder` | valid session | deny | optional DB read `orders`; delete/upsert `gallery_photo_links` | CORE | Validate `_token`; require URL; accept either existing order number or cleaned descriptors; blank both clears link; linking order and descriptors are mutually exclusive; path is not validated as gallery storage path. |
| 60 | `moveGalleryPhoto` → `handleMoveGalleryPhoto` | valid session | deny | Storage move `gallery`; DB patch `gallery_photo_links` | CORE | Validate `_token`; validate path and allowlisted target section; reject same section; move; best-effort link URL/path patch when old URL supplied. |
| 61 | `hideGalleryPhoto` → `handleHideGalleryPhoto` | valid session | deny | Storage move visible → `_hidden` | CORE | Validate `_token`; require valid visible gallery path. Does not update linked photo URL/path. |
| 62 | `restoreGalleryPhoto` → `handleRestoreGalleryPhoto` | valid session | deny | Storage move `_hidden` → visible | CORE | Validate `_token`; require valid hidden gallery path. Does not update linked photo URL/path. |
| 63 | `deleteGalleryPhoto` → `handleDeleteGalleryPhoto` | valid session | deny | Storage delete `gallery`; DB delete matching gallery links | CORE | Validate `_token`; require valid gallery path; delete storage first; best-effort link delete matched by filename suffix. |
| 64 | `listSaleGloves` → `handleListSaleGloves` | valid session | deny | DB read `gloves_for_sale` | CORE | Validate `_token`; no input. |
| 65 | `getSaleGlove` → `handleGetSaleGlove` | valid session | deny | DB read one `gloves_for_sale` row | CORE | Validate `_token`; require ID; distinguish query failure/not found. |
| 66 | `createSaleGlove` → `handleCreateSaleGlove` | valid session | deny | DB insert `gloves_for_sale` | CORE | Validate `_token`; constructs fixed payload but performs little cleaning/validation; defaults status/sort; no required title/slug checks in action. |
| 67 | `updateSaleGlove` → `handleUpdateSaleGlove` | valid session | deny | DB patch `gloves_for_sale` | CORE | Validate `_token`; require ID; fixed full payload with cleaning/numeric coercion; no partial whitelist semantics beyond fixed fields. |
| 68 | `deleteSaleGlove` → `handleDeleteSaleGlove` | valid session | deny | DB delete `gloves_for_sale` | CORE | Validate `_token`; require ID; no explicit photo-storage cleanup. |
| 69 | `uploadLacePhoto` → `handleUploadLacePhoto` | valid session | deny | Storage upload `lace` | CORE | Validate `_token`; require color/filename/data; image MIME prefix; sanitized path; no explicit decoded-size cap and no inventory update. |
| 70 | `uploadSaleGlovePhoto` → `handleUploadSaleGlovePhoto` | valid session | deny | DB read glove/photos; Storage upload `gloves-for-sale`; DB insert `glove_sale_photos` | CORE | Validate `_token`; require glove ID/filename/data; image MIME prefix; require glove; sort order from row count; storage upload precedes DB insert. No explicit decoded-size cap. |
| 71 | `listSaleGlovePhotos` → `handleListSaleGlovePhotos` | valid session | deny | DB read `glove_sale_photos` | CORE | Validate `_token`; require glove ID. |
| 72 | `setSalePhotoPrimary` → `handleSetSalePhotoPrimary` | valid session | deny | DB patches `glove_sale_photos` | CORE | Validate `_token`; require glove/photo IDs; clear all, then set selected photo constrained to glove. Non-transactional. |
| 73 | `setSalePhotoHover` → `handleSetSalePhotoHover` | valid session | deny | DB patches `glove_sale_photos` | CORE | Same as primary: validate token/IDs; clear all then set constrained photo; non-transactional. |
| 74 | `deleteSaleGlovePhoto` → `handleDeleteSaleGlovePhoto` | valid session | deny | DB delete `glove_sale_photos` | CORE | Validate `_token`; require glove/photo IDs; returns deleted row. Does not delete Storage object. |
| 75 | `searchPublicGloves` → `handleSearchPublicGloves` | public | deny-token/anonymous-allow | DB reads `gallery_photo_links` and selected non-customer `orders` fields | CORE | No local auth; trim/lower query; fewer than 2 chars returns empty; all terms must match; cap results 24; only curated linked URLs; deliberately excludes customer identity/address/intake photos. |
| 76 | `listGalleryPhotos` → `handleListGalleryPhotos` | public; valid session if `includeHidden === true` | deny-token/anonymous-allow | DB read `gallery_photo_links`; Storage list visible sections and optionally hidden sections | CORE | Conditional `_token` validation only for strict boolean `includeHidden`; fixed five-section allowlist; public response includes visible gallery, photo→order-number links, covers; hidden mode additionally returns descriptors and hidden gallery. |

## Actions requiring special review

These are findings, not approved behavior changes. Preserve them during extraction, then review in separate commits/issues.

1. **Session versus active account:** 63 actions validate only token signature/expiry. A deactivated or role-changed non-demo account keeps access to these actions until token expiry. Only the five admin actions resolve the current user. The registry should support `active-user`, but reclassifying actions is a behavior/security change requiring explicit approval.
2. **Passkey registration authority:** `webauthnRegisterOptions` and `webauthnRegisterVerify` require only a valid non-demo session, yet a registered passkey later creates an owner/admin session. They are strong candidates for admin-only after the behavior-preserving migration.
3. **Destructive and financial actions are session-only:** `deleteOrder`, message deletion, expense mutation, pricing publish/create/settings, gallery deletion, inventory mutation, and store mutation are not admin-only.
4. **Conditional public auth:** `listGalleryPhotos` changes auth based on `includeHidden === true`; it needs a policy function or two internal entries without altering the public action name.
5. **Public/demo inconsistency:** `getPushPublicKey`, `searchPublicGloves`, and public `listGalleryPhotos` work anonymously but reject a request carrying a valid demo token because they are outside the demo allowlist.
6. **Global binding preflight:** all public actions require `ADMIN_PIN` and `ADMIN_SESSION_SECRET` to be configured even when their local code does not use the PIN. Per-action binding enforcement would change failures/statuses and must not be introduced during extraction.
7. **WebAuthn identity model:** password users are per-user, but all passkeys are global and successful passkey login always becomes owner/admin. Registration options expose all credential IDs to any valid non-demo session.
8. **Token comparison:** session/challenge HMAC signatures use direct string comparison; password comparison and byte-array comparisons are constant-time loops. Any cryptographic hardening must preserve token format and be reviewed separately.
9. **Partial-success `updateOrder`:** the order may be committed before inventory, activity, email, SMS, or delivery stamps fail. Responses intentionally report “Order updated, but ...”; extraction must keep sequencing and text exact.
10. **Preview notification differences:** `sendBrandedEmail` and `sendTwilioSms` suppress in previews. `sendStatusText` itself does not call the preview helper, so status SMS invoked by `updateOrder`/`resendStatusText` appears capable of reaching Twilio in preview. Verify intended behavior before changing it. Push is best-effort and suppressed in preview.
11. **Non-transactional multi-write actions:** pricing publish, cover/primary/hover changes, order update, gallery moves, uploads followed by DB inserts, and communication stamp/log flows can leave partial state.
12. **Storage orphans/references:** removing an order photo and deleting a sale photo/listing remove DB references only; failed sale-photo DB insert leaves uploaded storage; hide/restore do not update gallery links; move link patch is best-effort.
13. **Delete cascades are implicit:** `deleteOrder` and `deleteSaleGlove` do not describe or perform related labor/activity/photo cleanup; behavior depends on database constraints and leaves storage outside DB transactions.
14. **Loose upload validation:** gallery, lace, sale, and SMS uploads accept any `image/*`; only order photos enforce an 8 MiB decoded limit. Data URL/MIME agreement and image decoding are not verified.
15. **Loose store/expense validation:** sale listing create/update and expense category/date accept values largely as supplied; preserve today, then review validation separately.
16. **Public metadata:** public gallery output intentionally returns photo→order-number links. Public search reads `services_requested` and color fields but returns a reduced safe shape. Keep field selection and response mapping exact.
17. **Best-effort writes:** message-reply logging, activity logging, inventory adjustment errors, link cleanup, and push sends can be ignored. Registry `effects` must not imply transactional guarantees.
18. **WebAuthn counter:** sign count is stored but intentionally not enforced because synced passkeys often report zero.
19. **Admin lifecycle:** admin user update/delete has no self-delete, owner-target, or last-admin protection.
20. **Geocoding runtime:** up to 250 items × 8 candidates with sequential external requests and one-second Nominatim pacing may exceed a Pages Function execution budget. Any batching change is outside the behavior-preserving refactor.

## Migration sequence

Each commit below must be independently deployable and preserve behavior.

1. **Planning baseline (this commit):** add only this audit. Run syntax/self-tests. No runtime changes.
2. **Characterization harness:** add dependency-free tests around a factored dispatch test seam or pure policy helpers without changing the live entry point. Snapshot status/body for method handling, missing bindings, unknown actions, invalid/expired/demo/owner/user tokens, and conditional gallery auth. Keep production dispatcher untouched.
3. **Handler context and one no-op extraction:** introduce a small `invokeAction`/handler-context convention and extract one simple public read action (recommended `getPushPublicKey`) while leaving all other `if` blocks in place. Registry lookup must fall through to the legacy chain so behavior is deployable.
4. **Central policy primitives:** add pure `authorizeAction` supporting `public`, `session`, `active-user`, `admin`, and conditional policies. Initially route only already-extracted actions. Preserve demo-before-auth order and exact error payloads.
5. **Extract public authentication/WebAuthn actions:** move `login`, invite actions, push key, and WebAuthn login actions one at a time. Keep cryptographic helpers and token-in-body format unchanged.
6. **Extract admin user actions:** move the five `requireAdmin` actions. Central auth must pass resolved auth context but retain exact current `requireAdmin` semantics and response text.
7. **Extract read-only session actions:** orders/activity, messages list, inventory list, labor reads, Money summary, expenses list, pricing reads/settings read, store reads, and admin gallery reads.
8. **Extract isolated writes:** message read/delete, inventory create/update, labor mutations, expenses, shop settings, simple store writes. Compare exact validation order and `Prefer` headers.
9. **Extract order workflows:** create/delete/photo actions, resend actions, then `updateOrder` last. Characterize side-effect call order and partial-success responses before moving it.
10. **Extract storage/gallery/store-photo workflows:** preserve storage-first/DB-second ordering, best-effort cleanup, and grouped gallery action response shapes.
11. **Extract pricing writes:** drafts/history/create, with `publishServicePricing` last because it is a non-transactional live/history sequence.
12. **Extract map/external-service actions:** preserve item/candidate limits, sequential order, fallback order, pacing, and result maps.
13. **Remove legacy chain:** only after all 76 names are registry-backed and a source-order manifest/test confirms no missing or duplicate action. Preserve unknown-action and top-level catch.
14. **Policy-review follow-ups:** separately consider active-user enforcement, admin reclassification, passkey registration authority, preview SMS suppression, upload limits, and transactional cleanup. Do not combine these with mechanical migration commits.

For every migration commit:

- migrate a coherent, small action group;
- keep the action string and handler response unchanged;
- keep registry entries in current source order for reviewability;
- add/extend characterization tests before removing the old block;
- run `node --check functions/api/orders.js`, repository self-tests, `git diff --check`, and a focused preview smoke test;
- do not alter `admin/admin.js` call bodies or `_token` placement.

## Verification checklist

### Transport, auth, and demo

- [ ] GET health response remains byte-for-byte equivalent in shape/status/headers.
- [ ] unsupported method remains HTTP 405; malformed JSON and uncaught errors remain HTTP 500.
- [ ] blank/unknown action remains HTTP 200 with the current message.
- [ ] missing CORE bindings fail before dispatch with the current HTTP 500 messages.
- [ ] owner PIN login works with blank email and produces the same 14-day admin token.
- [ ] password login rejects inactive users, accepts active users, updates `last_login_at`, and preserves response bodies.
- [ ] missing, malformed, bad-signature, and expired `_token` errors remain unchanged.
- [ ] valid demo token is denied for every currently denied action with `demo:true`.
- [ ] the five demo-allowed action names retain current behavior.
- [ ] anonymous versus demo-token behavior for the three public-but-demo-denied actions is unchanged.

### Passkeys

- [ ] registration options retain RP/origin defaults, challenge lifetime, owner identity, ES256 params, and exclusion list.
- [ ] registration verify checks ceremony/challenge/origin/RP hash/presence/key type and stores the same fields.
- [ ] login options remain public and expose the same credential allowlist/`hasCredentials`.
- [ ] login verify preserves signature conversion/verification, non-enforced sign counter, credential touch, and owner/admin token.
- [ ] apex, `www`, and configured origin overrides behave exactly as before.

### Users

- [ ] admin-only list/create invite/set password/update/delete rejects valid non-admin/demo tokens exactly as before.
- [ ] owner escape-hatch token remains admin.
- [ ] invite duplicate/expiry/password rules, role coercion, invite link, optional email, and accepted-invite push remain unchanged.
- [ ] user response mapping never exposes hashes/salts/tokens.

### Orders and workflow

- [ ] list/get/create/update/delete responses and ordering are unchanged.
- [ ] create validation, order-number retry, tracking token, defaults, and activity entry are unchanged.
- [ ] `mapUpdatesToDb` whitelist, aliases, numeric/date/boolean cleaning, and ignored fields are unchanged.
- [ ] shipped-completed payment guard and automatic completion date are unchanged.
- [ ] lace inventory adjustments and activity events occur in the current order.
- [ ] status email/SMS decision rules, stamps, logs, and partial-success responses are unchanged.
- [ ] order photo upload limit/path/reference behavior and reference-only removal are unchanged.
- [ ] order save works; workflow menus remain unaffected.

### Messages and notifications

- [ ] message list limit/order/mapping, mark-all behavior, single/thread deletion, and phone-list cap remain unchanged.
- [ ] SMS reply validates destination/body/media, uploads MMS media to the same bucket/path, sends through the same service, and logs the same row.
- [ ] Resend from/reply-to/BCC/body/tracking/payment behavior is unchanged.
- [ ] Twilio opt-in/status rules and message mirroring are unchanged.
- [ ] VAPID key response, subscription upsert, test push, dead-subscription pruning, preview suppression, and best-effort semantics are unchanged.

### Gallery

- [ ] public visible gallery requires no token and returns the same five sections, links, and covers.
- [ ] `includeHidden === true` requires a valid non-demo session and returns descriptors/hidden sections.
- [ ] upload/move/hide/restore/delete paths, storage buckets, and current link-update/cleanup behavior are unchanged.
- [ ] cover clear/set and order/descriptors mutual exclusion remain unchanged.
- [ ] public search keeps the two-character threshold, all-term match, 24-result cap, curated URLs, and safe response fields.

### Inventory

- [ ] list ordering, create/update normalization, duplicate detection, integer validation, column capability detection, and payload whitelist remain unchanged.
- [ ] order completion/update usage adjustments remain unchanged.
- [ ] lace photo upload path and response remain unchanged.

### Pricing

- [ ] live/draft/mapping/settings aggregation and degradation behavior remain unchanged.
- [ ] draft validation, save/discard, history/restore, service creation defaults, and settings validation remain unchanged.
- [ ] publish keeps live-update-before-history ordering and exact partial-failure messages.
- [ ] public pricing endpoint outside this file remains unaffected.
- [ ] `node scripts/pricing-selftest.mjs` passes.

### Store

- [ ] listing list/get/create/update/delete shapes and sort behavior remain unchanged.
- [ ] photo upload storage-first flow, sort assignment, photo list, primary/hover clear-set sequences, and DB-only photo deletion remain unchanged.
- [ ] public store endpoints in other function files remain unaffected.

### Map

- [ ] geocode-only action performs no DB writes.
- [ ] missing-address action reuses matching stored locations and stores success/failure fields identically.
- [ ] 250-item/8-candidate caps, Census-first/Nominatim fallback, US restriction, user agent, quality classification, pacing, and result shapes remain unchanged.
- [ ] map routing, zoom, Show on Map, and geocode quality UI remain unaffected.

### Labor and Money

- [ ] phase allowlist, single-running-timer rule, pause/resume accumulation, stop duration rounding, note semantics, and activity logging remain unchanged.
- [ ] list/open/summary queries and mappings remain unchanged.
- [ ] timer works from Order Detail and Clubhouse.
- [ ] Money summary and Pricing Intelligence receive the same labor data and remain unchanged.
- [ ] Clubhouse and Finance Snapshot remain unchanged.

### Public and platform compatibility

- [ ] all eight public actions retain their current auth/demo behavior.
- [ ] no customer identity/contact/address fields leak from public search/gallery responses.
- [ ] Cloudflare Pages Functions discovers `onRequest` without a build step.
- [ ] no npm/runtime dependency, framework, Node-only server API, or generated bundle is introduced.
- [ ] WebCrypto, `fetch`, `Request`/`Response`, `atob`/`btoa`, and context/env usage remain Pages-compatible.
- [ ] preview and production environment signals retain precedence.
- [ ] admin and public pages have no mobile horizontal scroll.

## Stage-one acceptance

This planning stage is complete when:

- this is the only committed file on `refactor/murphos-v1.2-action-registry`;
- the 76-action inventory matches source order;
- authentication counts total 76;
- no application, migration, configuration, or test file is modified;
- JavaScript syntax checks and the existing pricing self-test pass;
- the working tree is clean after the planning commit.
