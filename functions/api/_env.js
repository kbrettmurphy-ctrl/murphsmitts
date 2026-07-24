/* Runtime environment detection for Cloudflare Pages Functions.
   Single source of truth for "is this a non-production (preview) deployment?".

   Precedence:
   1. MURPHOS_ENV — authoritative. Set MURPHOS_ENV=preview (or staging/dev) on
      the Cloudflare Pages *Preview* scope. Production leaves it unset or sets it
      to "production". This is the required, explicit signal.
   2. CF_PAGES_BRANCH — best-effort secondary. If present at runtime and not the
      production branch (PRODUCTION_BRANCH, default "main"), treat as preview.
      This can only escalate to preview, never downgrade to production.
   3. Default: production (fail-safe for notifications — production must keep
      sending; a truly unknown env is treated as production so nothing that
      should send is silently suppressed by accident).

   Safety property: notification suppression keys off isPreviewEnvironment(), so
   the ONLY way real customer comms are sent is when this resolves to
   "production". Preview must therefore be explicitly flagged (step: set
   MURPHOS_ENV=preview on the Preview scope). */

export function getEnvironmentName(env) {
  const raw = String((env && env.MURPHOS_ENV) || "").trim().toLowerCase();
  if (raw === "production" || raw === "prod") return "production";
  if (raw === "preview" || raw === "staging" || raw === "dev" || raw === "development") return "preview";
  if (raw) return "production"; // unrecognized explicit value → fail safe to production

  const branch = String((env && env.CF_PAGES_BRANCH) || "").trim();
  const prodBranch = String((env && env.PRODUCTION_BRANCH) || "main").trim();
  if (branch && branch !== prodBranch) return "preview";

  return "production";
}

export function isPreviewEnvironment(env) {
  return getEnvironmentName(env) !== "production";
}
