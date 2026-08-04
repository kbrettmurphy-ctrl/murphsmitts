# Changelog

## 2026-08-04 — MurphOS v1.4.2: Reliable Intake

### Added
- Transaction-safe public intake order creation with serialized order-number allocation and atomic multi-glove inserts.
- Client-generated intake idempotency keys and request hashes so retries return the original orders instead of creating duplicates.
- Persisted, structured notification delivery outcomes and explicit partial-success responses after an order has been created.
- Twilio webhook signature validation before order lookup, status changes, alerts, or authenticated media downloads.
- Focused Reliable Intake self-tests for concurrency safeguards, retries, notification failures, signed requests, and authenticated media.

### Changed
- Public intake photo uploads no longer depend on Resend configuration after an order has already been created.
- Twilio media downloads send account credentials only to trusted HTTPS Twilio API hosts and enforce a 10 MB streaming limit.

### Notes
- Migration `20260804120000_reliable_intake.sql` must be owner-reviewed and applied before the application changes are deployed.
- This release is implemented on a feature branch but is not yet deployed or production-verified.

## 2026-08-04 — MurphOS v1.4.1: Record and Refinement

### Added
- Added a Hidden Photos gallery filter so hidden photos can be found and restored from the Gallery manager.

### Changed
- Reconciled the as-built architecture, database, workflow, feature inventory, technical-debt register, and release history through Durable Economics.
- Corrected measured-job documentation to the implemented one-minute labor floor and recorded special-order lace costing without stocked-color inventory impact.
- Added explicit mobile navigation control state and corrected maintenance-reminder documentation to match the device SMS composer.
- Persisted the Messages and Users admin views in the URL so refreshes and direct navigation restore the selected view.

### Fixed
- Pricing mutations now restore disabled controls and show a usable error when the shared request helper throws on network or server failures.

### Notes
- MurphOS v1.4.1 is deployed and production-verified through commit `03f7372`.
- All six self-test suites passed: 227 tests and 2,905 assertions. JavaScript syntax checks also passed.

## 2026-08-03 — MurphOS v1.4: Durable Economics

### Added
- Immutable economics snapshots for orders first reaching Completed or Picked Up, including idempotent backfill for existing terminal orders.
- Transaction-safe complete-order deletion with stocked-lace restoration, dependency-ordered cleanup, and intentional Storage retention.
- Structured special-order lace and custom add-on economics so actual material/revenue allocations remain honest without changing stocked-color inventory.

### Changed
- Order Detail, Money, Pricing intelligence, service allocations, and monthly history resolve terminal actuals from the locked snapshot.
- Quote suggestions read current published Pricing Management data while historical order prices remain unchanged.
- Manual-order delivery reports structured channel results instead of hiding partial notification outcomes.

### Fixed
- Custom Work labor and negotiated add-on allocations remain separated from the base service where structured data exists.

## 2026-08-03 — MurphOS v1.3: Bench Focus

### Added
- Bench Focus as the Clubhouse context for the glove physically on the bench, kept visually distinct from official labor timing.
- Start Bench Work workflows for running, paused, and absent labor sessions, including explicit same-order paused-timer decisions.
- Authoritative Bench-linked labor starts from the exact Bench start time or the current time.
- Unresolved Bench interval review with Assign, Discard, and Resolve Later paths.
- Cross-order protection and explicit resolution when another glove or labor timer is active.

### Changed
- Simplified the Clubhouse Bench presentation while preserving Today’s Bench labor controls.
- Centralized Bench and timer action menus in a viewport-clamped, body-level portal with anchored contextual positioning.
- Synchronized Bench Focus and labor state across dashboard, Order Detail, tabs, focus changes, and recovery refreshes.

### Fixed
- Prevented paused labor from being silently attached to unrelated Bench Work.
- Removed unusable labor-start controls while an unlinked paused session remains open.
- Corrected timer action dispatch, nested icon clicks, cross-order End Bench Work, and Safari popover hit testing.
- Eliminated bottom-pinned Bench menus and ensured unlocked controls are rerendered after failed or interrupted mutations.
- Reconciled interrupted/non-JSON resolution responses against authoritative Bench state to avoid leaving the UI stuck.

### Notes
- Bench elapsed time remains contextual and never counts as official labor unless explicitly assigned or captured by a linked labor session.
- Existing notification, workflow-status, finance, order-save, and public-site behavior is unchanged.

## 2026-07-31 — MurphOS v1.2: Action Registry

### Added
- Declarative registry entries for every `/api/orders` action, including authentication requirement, demo policy, handler, declared effects, and required environment bindings.
- Registry self-tests that fail on duplicate actions, missing metadata, invalid policies, and incomplete dispatch coverage.

### Changed
- Centralized action dispatch and authorization/demo enforcement instead of maintaining separate linear action branches.

### Notes
- The registry reduces dispatch drift; it does not split the large admin Function or remove duplicated client/server business rules.

## 2026-07-24 — Pricing Management

### Added
- MurphOS Pricing view: GUI-managed public service prices with draft/publish workflow, price history, rollback, editable business settings (target rate, minimum shop charge, rounding increment), pricing intelligence, and add/hide/deactivate services.
- Public read-only pricing endpoint `GET /api/public/service-pricing` and shared `functions/api/_pricing.js`.
- Migration `20260724120000_service_pricing.sql`: `service_pricing`, `service_pricing_revisions`, `shop_settings`, `service_pricing_job_types`; seeds seven services with approved published prices, settings, and analytics mappings.
- Per-service pricing intelligence card in the Money view.
- `.docs/murphos/PRICING_MANAGEMENT.md`; `scripts/pricing-selftest.mjs`.

### Changed
- Public Services page now renders published prices/names/bullets, with the approved prices retained as a static fallback.
- Approved public prices: Standard Full Service $90–$110, Full Relace $60–$80, Lace Repair now "Starting at $30".
- Order Detail Price Quoted and Send Estimate show the current published price as a display-only hint.

### Notes
- Additive migration; owner reviews and pushes it. Historical order prices are never changed.

## 2026-07-20 — Phase 1: Perimeter and Hygiene

- Added explicit Jekyll exclusions for internal source, migrations, documentation, local secrets, caches, and deployment files.
- Cleared order, address/geocode, notification metadata, and authenticated in-memory datasets on logout while preserving harmless UI preferences.
- Removed the unused `styles-16.css` and oversized embedded-raster SVG favicon; corrected public manifest icon paths.
- Optimized the public logo, oversized photography, certification/ownership badges, and lace swatches without cropping or changing content.
- Vendored the existing Leaflet 1.9.4 distribution and marker assets; map logic and external CARTO tiles are unchanged.
- Documented the plan-dependent manual Cloudflare login rate limit and the optional future/incident-response procedure for the legacy-named `ADMIN_PIN` recovery password. No external action is marked complete.

## 2026-07-19 — As-built documentation baseline

- Reconciled architecture, database, workflow, deployment, and feature documentation with current source and migrations.
- Reclassified empty sprint TBD files as historical planning indexes.
- Added a ranked technical-debt register without changing application behavior.

This file tracks completed MurphOS/admin portal changes.

## Format

Each completed sprint should get a new entry:

```md
## YYYY-MM-DD — Sprint Name

### Added
- 

### Changed
- 

### Fixed
- 

### Notes
- 
```
