# Changelog

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
