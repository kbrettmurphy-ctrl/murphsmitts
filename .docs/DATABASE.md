# MurphOS Database and Migrations

As-built baseline reviewed 2026-07-19.

## Important limitation

The repository does not contain the original schema migration for the core tables (`orders`, `lace_inventory`, `gloves_for_sale`, and `glove_sale_photos`) or Storage buckets. The definitions below combine fields used by current source with the additive migrations that are checked in. A new Supabase project cannot be reproduced from this repository alone.

## Tables

### `orders`

Core customer/job fields used by the application include identity and timestamps; customer contact; glove type/model/web; requested services and lace colors; delivery/address; notes/photos; order number and status; received/estimated/completed dates; quote/payment/shipping; email/SMS delivery stamps; SMS opt-in and latest inbound message; approval time; lace usage; map/geocoding metadata; and `tracking_token`.

`order_number` is the application-facing key used by related tables and URLs. Intake currently finds the maximum existing number and increments it. `glove_photos` holds an array of order/intake/SMS photo URLs; readers tolerate either a native array or serialized JSON text.

### `lace_inventory`

Tracks color, quantity, reorder threshold (`reorder_at` or a legacy `reorder_threshold` tolerated by migration logic), active state, and `reorder_alert_enabled`. Public responses expose active color/quantity only. Admin order updates adjust inventory by the delta between old and new per-color usage values.

### `order_activity`

Append-only activity events keyed by order number with type, label, optional detail, actor, metadata, and timestamp. It records significant order, labor, photo, and delivery actions.

### `order_labor_sessions`

Sessions contain order number, phase, start/end timestamps, computed duration minutes, notes, status (`running`, `paused`, `stopped`), pause timestamp, accumulated paused seconds, and timestamps. A partial index covers open sessions. Optional `bench_work_session_id` and `started_from_bench` fields audit phases performed during Bench Focus and constrain the original Bench timestamp to one labor row.

### `bench_work_sessions`

Bench Work records physical workbench context independently from labor and workflow status. Start/end timestamps, resolution (`pending`, `labor_recorded`, `discarded`), one-time backdate consumption, reminder snooze, actor, and audit timestamps support recovery and reconciliation. A partial unique index permits one active row globally; ended pending rows remain non-blocking. Transactional RPCs coordinate Bench Work and labor changes.

### `admin_users` and `webauthn_credentials`

Users have email, display name, `admin` or `demo` role, PBKDF2 password material, active/invite state, and login timestamps. WebAuthn credentials store credential ID, P-256 public-key data, signature counter, transports, label, and use timestamps. Passkeys currently authenticate as the owner/admin rather than mapping to an `admin_users` row.

### `sms_messages`

Conversation history contains direction, phone/customer/order association, text, media URL JSON, Twilio SID, read state, and timestamp. The initial migration backfills each order's last inbound text once.

### `push_subscriptions`

Stores unique push endpoint, browser `p256dh` and auth keys, label, and timestamps. Expired endpoints are deleted after push providers return 404 or 410.

### `gallery_photo_links`

Associates a unique public gallery photo URL/path with an optional order number. Orderless curated photos may carry glove/search descriptors. `is_cover` selects an album cover. Order-linked photos inherit searchable glove descriptors from the order at query time.

### `shop_expenses`

Manual expenses contain date, category, description, amount, optional quantity and unit kind, and timestamp. Valid `lace_piece` purchases use cumulative weighted-average landed cost (`sum(amount) / sum(quantity)`); other categorized units retain their existing newest-valid-purchase behavior.

### Completed-order economics and deletion

`orders.economics_snapshot` and `orders.economics_locked_at` freeze historical actual economics when an order first reaches Completed or Picked Up. A database trigger creates the snapshot transactionally, and the migration idempotently backfills terminal orders that predate the feature. Existing snapshots are immutable and remain in place if an order later leaves and re-enters a terminal state.

`delete_order_completely` restores exactly matching stocked lace, deletes order-owned labor, Bench Work, activity, and legacy lace-usage rows, unlinks shared SMS/gallery references, and deletes the order in one database transaction. Storage objects are intentionally retained because Storage cannot participate in the database transaction.

### `gloves_for_sale` and `glove_sale_photos`

The store tables hold listing content, price/specification/status/featured/sort fields and a one-to-many photo set with primary/hover roles. Their original DDL is not checked in.

### `service_pricing`, `service_pricing_revisions`, `shop_settings`, `service_pricing_job_types`

Pricing Management (`20260724120000_service_pricing.sql`). `service_pricing` is the live, published state the public Services page reads: stable `service_key`, editable name/category/short description, `bullet_details` jsonb (plain-text array), `pricing_type`, structured `base_price`/`premium_price`/`price_suffix`, optional `display_override`, `is_public`, `is_active`, `sort_order`, and lifecycle timestamps including `published_at`. `service_pricing_revisions` holds pending drafts and immutable published history — a full field snapshot in `data` jsonb, `status` (draft/published/archived), previous/new display strings, and an internal note; a partial unique index limits one open draft per service. `shop_settings` is a key/value store for `target_labor_rate`, `min_shop_charge`, and `rounding_increment`. `service_pricing_job_types` maps a public service to measured job buckets (glove type, primary service value, trapeze flag) for pricing intelligence. All four have RLS enabled with no policies. See `.docs/murphos/PRICING_MANAGEMENT.md`.

## Storage buckets used

- `gallery`: section-prefixed public gallery photos, including a hidden prefix used by admin hide/restore.
- `gloves-for-sale`: listing photos stored under listing slugs.
- `order-photos`: intake, inbound MMS, and outbound-message attachments.

Bucket creation, public access configuration, size limits, and Storage policies are not represented by checked-in migrations.

## Checked-in migration ledger

| Migration | Effect |
| --- | --- |
| `20260628000000_add_order_map_geocoding_columns.sql` | Adds map coordinates, normalized address/source/status/error/hash/time |
| `20260701000000_add_lace_inventory_alert_enabled.sql` | Adds reorder-alert flag and converts the legacy `-1` disable sentinel |
| `20260702000000_add_order_activity.sql` | Creates activity table and indexes |
| `20260703000000_add_order_map_geocode_quality.sql` | Adds geocode quality |
| `20260704000000_add_order_labor_sessions.sql` | Creates labor sessions and indexes |
| `20260705000000_add_labor_timer_pause_state.sql` | Adds running/paused/stopped state and paused-time accounting |
| `20260706000000_add_order_lace_pieces_used.sql` | Adds per-order total lace-piece costing override |
| `20260707000000_add_webauthn_credentials.sql` | Creates passkey credential storage |
| `20260708000000_add_admin_users.sql` | Creates users and idempotently seeds the owner account |
| `20260709000000_add_sms_messages.sql` | Creates message history and backfills last inbound messages |
| `20260710000000_add_push_subscriptions.sql` | Creates Web Push subscriptions |
| `20260711000000_add_gallery_photo_links.sql` | Creates gallery-to-order linkage |
| `20260714120000_gallery_link_descriptors.sql` | Adds descriptors and permits orderless curated links |
| `20260716090000_gallery_link_cover.sql` | Adds album-cover flag |
| `20260718150000_shop_expenses.sql` | Creates manual expense ledger |
| `20260719120000_tracking_tokens.sql` | Adds/backfills unique public tracking tokens |
| `20260721140000_enable_rls_all_tables.sql` | Enables RLS on all existing public tables |
| `20260724120000_service_pricing.sql` | Creates pricing tables, seeds seven services with approved published prices, business settings, and analytics mappings |
| `20260731120000_bench_focus.sql` | Adds Bench Focus sessions, labor linkage, constraints, RLS, and transactional lifecycle RPCs |
| `20260803170000_order_economics_snapshots_delete_cascade.sql` | Adds immutable completed-order economics snapshots/backfill and transactional complete-order deletion/orphan cleanup |

Migrations are additive and should be reviewed/applied in timestamp order. There is no checked-in Supabase config or automated migration verification in this repository.
