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

All seven self-test suites pass: 237 tests and 2,949 assertions.

- Action Registry
- Admin navigation
- Bench Focus
- Durable economics
- Reliable Intake
- Order photos
- Pricing

JavaScript syntax checks passed.

## Current development checkpoint

Phase 2, MurphOS v1.4.2 **Reliable Intake**, is implemented on the
`codex/reliable-intake` feature branch but is not deployed or production-verified.

Implemented scope:

- transaction-safe public intake order-number allocation and atomic multi-glove
  creation;
- idempotent intake retries plus explicit notification partial-success handling;
- Twilio signature validation before webhook side effects;
- focused tests for concurrency safeguards, retries, authenticated media, and notification
  failures.

Next checkpoint:

1. Owner reviews and applies `supabase/migrations/20260804120000_reliable_intake.sql`.
2. Deploy the feature branch preview with preview notification suppression configured.
3. Manually verify intake retry behavior, multi-glove allocation, partial-success
   messaging, valid/invalid Twilio signatures, and inbound MMS media.
4. Merge and production-verify only after those checks pass.
