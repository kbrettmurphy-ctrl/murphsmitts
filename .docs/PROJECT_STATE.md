# MurphOS Project State

Last updated: 2026-08-04

Read this document before planning or editing. It records the changing release
status and next-work checkpoint; the as-built documentation and source remain
authoritative for current behavior.

## Current release

MurphOS v1.4.1 is deployed and production-verified. Production `main` is at
commit `03f7372`.

- `07dc455` completed v1.4.1 Record and Refinement.
- `03f7372` added URL persistence for the Messages and Users views plus a Hidden
  Photos gallery filter with Restore access.

## Verification checkpoint

All six self-test suites passed: 227 tests and 2,905 assertions.

- Action Registry
- Admin navigation
- Bench Focus
- Durable economics
- Order photos
- Pricing

JavaScript syntax checks passed.

## Next planned work

Phase 2 is MurphOS v1.4.2, **Reliable Intake**. It is planned but has not started.
Do not begin Phase 2 without explicit direction.

Planned scope:

- transaction-safe order-number allocation;
- idempotent intake submission or explicit partial-success handling;
- Twilio signature validation;
- focused tests for concurrency, retries, authenticated media, and notification
  failures.
