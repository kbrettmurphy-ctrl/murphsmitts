# MurphOS Technical-Debt Register

Reconciled against the 2026-08-04 repository state. This is a register, not authorization to change behavior. Each item includes its current classification.

## Critical

- **Open — Inbound SMS webhook authenticity is not verified.** `/api/sms-reply` trusts posted Twilio-shaped form fields without validating `X-Twilio-Signature`, allowing forged messages/status changes and arbitrary external media-fetch attempts.
- **Open — The database is not reproducible from Git.** Core table DDL, constraints/foreign keys, RLS, Storage buckets, and policies predate the migration ledger and are absent.

## High

- **Open — Order number allocation races.** Intake reads all order numbers, selects max+1, then inserts; concurrent submissions can choose the same number unless an external unique constraint catches it, and no retry is implemented.
- **Partially mitigated — Side effects are non-transactional.** Bench lifecycle and complete-order deletion now use transaction-safe RPCs. Intake/update notifications, inventory adjustments, activity writes, and delivery stamps can still partially succeed across separate calls.
- **Open — Admin attack surface is concentrated.** The large browser script and admin action Function combine many unrelated privileges and business rules, increasing regression and audit risk. The Action Registry makes dispatch auditable but does not reduce file size or privilege concentration.
- **Partially mitigated — Automated tests exist, but CI does not.** Targeted self-tests cover the Action Registry, Bench Focus, pricing, durable economics, and order-photo behavior. Authentication, notification delivery, timer arithmetic breadth, inventory deltas, public-field allowlists, and migrations still lack complete regression coverage, and no workflow runs the current tests automatically.

## Medium

- **Open — Business rules are duplicated.** Status groupings, labor phases, customer messages, and economics concepts exist in client and Function code and can drift.
- **Open — Legacy labor starts remain application-serialized.** Bench-linked labor uses database transactions and row locks, while unrelated legacy timer starts retain their established REST read-then-write conflict checks.
- **Open — Passkeys are owner-global.** WebAuthn credentials are not associated with admin user records; any accepted passkey produces an owner/admin session.
- **Open — Sessions are long-lived browser tokens.** Signed tokens last 14 days, live in `localStorage`, and have no server-side revocation list or per-session audit trail. Perimeter Hygiene clears persisted order/address caches and in-memory authenticated datasets on logout, but it does not revoke the signed token server-side.
- **Open — Inbound message association is heuristic.** Only the 100 newest orders are scanned and matching uses the last 10 phone digits, so older/shared-number conversations can attach incorrectly.
- **Open — Public reads share the admin action Function.** Gallery listing/search and the push public key live alongside privileged actions, and the Function globally depends on admin configuration.
- **Partially mitigated — Client-side economics is not a ledger.** Terminal actuals are immutable database snapshots, fixing historical mutability. Nonterminal estimates, cost constants, latest-purchase inputs, eligibility rules, and manual expenses remain operational analytics rather than auditable accounting.
- **Open — External runtime services remain.** Perimeter Hygiene vendors the exact Leaflet 1.9.4 library and marker assets, resolving that CDN dependency. Google Fonts and CARTO map tiles still load from third parties; tile availability and privacy policy remain outside the deployment artifact.
- **Open — An unsafe alternate Wrangler path remains.** The active Cloudflare Pages Git deployment produces Jekyll output, but `wrangler.jsonc` still declares the repository root as a Workers Static Assets directory. An operator running `wrangler deploy` could publish internal repository files to a separate Workers deployment. Deployment documentation prohibits that command; changing the configuration to `_site` should be reviewed separately after confirming whether the Workers deployment path has any legitimate operator use.

## Fixed or superseded

- **Fixed — Linear action dispatch and scattered authorization policy.** MurphOS v1.2 routes registered actions through centralized authentication/demo enforcement and validates registry completeness with self-tests.
- **Fixed — Mutable completed-order economics.** MurphOS v1.4 locks terminal snapshots in the database and backfills earlier terminal orders once.
- **Fixed — Incomplete complete-order deletion.** MurphOS v1.4 deletes database-owned records transactionally and restores stocked lace; retaining Storage objects is intentional policy.

## Low

- **Open — Generated/local artifacts exist in the working tree.** Ignored `_site`, Wrangler/Jekyll caches, and Supabase temp state can confuse reviews even though they are not tracked.
- **Open — `.gitignore` repeats the Supabase temp rule.** Harmless, but avoidable maintenance noise.
- **Open — Historical design/execution documents can look current.** Large audit/execution files remain useful context but need their historical status understood; the as-built docs are authoritative for behavior.
- **Open — API error conventions are inconsistent.** Many application failures return HTTP 200 with `{ok:false}`, while configuration/method failures use HTTP errors, complicating monitoring and clients.
