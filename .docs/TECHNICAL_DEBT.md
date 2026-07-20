# MurphOS Technical-Debt Register

Ranked from the 2026-07-19 repository baseline. This is a register, not authorization to change behavior.

## Critical

- **Inbound SMS webhook authenticity is not verified.** `/api/sms-reply` trusts posted Twilio-shaped form fields without validating `X-Twilio-Signature`, allowing forged messages/status changes and arbitrary external media-fetch attempts.
- **The database is not reproducible from Git.** Core table DDL, constraints/foreign keys, RLS, Storage buckets, and policies predate the migration ledger and are absent.

## High

- **Order number allocation races.** Intake reads all order numbers, selects max+1, then inserts; concurrent submissions can choose the same number unless an external unique constraint catches it, and no retry is implemented.
- **Side effects are non-transactional.** Order update, inventory adjustment, activity logging, email/SMS sends, and delivery stamps occur as separate calls; partial success can leave data and reported outcome inconsistent.
- **Admin attack surface is concentrated.** A roughly 6,300-line action dispatcher and 13,700-line browser script combine many unrelated privileges and business rules, increasing regression and audit risk.
- **No automated tests or CI.** Validation is syntax/build based; authentication, status delivery, timer arithmetic, inventory deltas, public-field allowlists, and migrations lack regression coverage.

## Medium

- **Business rules are duplicated.** Status groupings, labor phases, customer messages, and economics concepts exist in client and Function code and can drift.
- **Passkeys are owner-global.** WebAuthn credentials are not associated with admin user records; any accepted passkey produces an owner/admin session.
- **Sessions are long-lived browser tokens.** Signed tokens last 14 days, live in `localStorage`, and have no server-side revocation list or per-session audit trail.
- **Inbound message association is heuristic.** Only the 100 newest orders are scanned and matching uses the last 10 phone digits, so older/shared-number conversations can attach incorrectly.
- **Public reads share the admin action Function.** Gallery listing/search and the push public key live alongside privileged actions, and the Function globally depends on admin configuration.
- **Client-side economics is not a ledger.** Constants, latest-purchase unit costs, eligibility rules, and manual expenses produce operational estimates rather than auditable accounting results.
- **External CDN runtime dependencies are unpinned operational risks.** Admin map CSS/JS and fonts load at runtime from third parties; availability and policy are outside the deployment artifact.

## Low

- **Generated/local artifacts exist in the working tree.** Ignored `_site`, Wrangler/Jekyll caches, and Supabase temp state can confuse reviews even though they are not tracked.
- **`.gitignore` repeats the Supabase temp rule.** Harmless, but avoidable maintenance noise.
- **Historical design/execution documents can look current.** Large audit/execution files remain useful context but need their historical status understood; the as-built docs are authoritative for behavior.
- **API error conventions are inconsistent.** Many application failures return HTTP 200 with `{ok:false}`, while configuration/method failures use HTTP errors, complicating monitoring and clients.
