# Changelog

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
