# Project Rules

## Purpose

These rules guide future code changes for the Murph’s Mitt Maintenance repository. They preserve current behavior and require explicit explanation for critical system changes.

## Design rules

- Preserve current order lifecycle behavior unless a change is explicitly requested.
- Do not rename or remove status labels used by the admin UI and status helpers without updating both code and docs.
- Keep customer-facing order messages consistent with the existing status logic in `functions/api/intake.js` and `functions/api/orders.js`.
- Maintain the distinction between shipped and local drop-off orders. Shipping fields, tracking, and payment logic are intentionally different from local pickup.

## Database safety rules

- Do not change the Supabase schema without a migration plan and explicit approval.
- Preserve the existing `orders.glove_photos` storage format and parsing behavior.
- Preserve the `paid`, `allow_ship_without_payment`, `tracking_number`, `carrier`, and `drop_off_method` fields and their current business meaning.
- Avoid altering `last_status_emailed` or `last_status_texted` semantics without checking notification duplication behavior.

## Notification rules

- Do not change email or SMS notification triggers without justification and a code review.
- Changes to customer email content, SMS copy, or status-triggered notifications must be documented and reviewed before deployment.
- Preserve the current SMS reply handling for `YES`/`NO` responses on `Estimate Sent` orders.
- Keep the `sms_opt_in` opt-in behavior intact: SMS should only be sent when the customer has opted in.

## Deployment rules

- Preserve the Cloudflare Functions deployment model and Wrangler configuration.
- Keep `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PIN`, `ADMIN_SESSION_SECRET`, `RESEND_API_KEY`, and Twilio env vars as required runtime configuration.
- Do not expose service-role keys or secrets in public code or production logs.
- Maintain the current public storage bucket usage for `gallery`, `gloves-for-sale`, and `order-photos` unless explicitly changing storage policy or access mode.

## Coding style rules

- Follow existing repo patterns: use `cleanText()`, `normalizeStatus()`, and `normalizePaidValue()` consistently.
- Use `supabaseFetch()` for Supabase REST calls and preserve its centralized error handling.
- Keep server-side business logic in Cloudflare Functions and avoid moving order lifecycle rules into frontend code.
- When adding new fields, update both the admin UI and the order mapping functions in `functions/api/orders.js`.

## Change control

- Require explanation before making changes to:
  - database schema
  - SMS behavior
  - email behavior
  - payment logic
  - Supabase access or storage configuration
- Document any behavior change in `.docs/WORKFLOW.md` and update `.docs/PROJECT_RULES.md` if the rule set changes.
