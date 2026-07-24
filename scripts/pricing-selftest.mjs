/* Focused self-test for the pure pricing logic (no framework in this repo).
   Run: node scripts/pricing-selftest.mjs
   Covers the shared display/rounding/public-mapping module plus the pricing
   intelligence math (target estimate, min shop charge, effective rate, and the
   "faster work is efficiency, not a price cut" interpretation). The admin
   client mirrors these formulas in admin.js. */

import {
  formatServiceDisplayPrice,
  roundToIncrement,
  mapPricingRowToPublic,
  PUBLIC_PRICING_FALLBACK,
  publiclyVisible,
  quoteAvailable,
  SERVICE_PRICING_CACHE_VERSION,
  normalizeServiceForCache,
  isValidServicesPayload
} from "../functions/api/_pricing.js";
import { getEnvironmentName, isPreviewEnvironment } from "../functions/api/_env.js";

let pass = 0;
let fail = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`  ok  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}\n      got:  ${JSON.stringify(got)}\n      want: ${JSON.stringify(want)}`); }
}

console.log("Display price formatting");
eq("fixed $50", formatServiceDisplayPrice({ pricing_type: "fixed", base_price: 50 }), "$50");
eq("tiered $90–$110", formatServiceDisplayPrice({ pricing_type: "tiered", base_price: 90, premium_price: 110 }), "$90–$110");
eq("range $60–$80", formatServiceDisplayPrice({ pricing_type: "range", base_price: 60, premium_price: 80 }), "$60–$80");
eq("starting_at $30", formatServiceDisplayPrice({ pricing_type: "starting_at", base_price: 30 }), "Starting at $30");
eq("per_item $30 each", formatServiceDisplayPrice({ pricing_type: "per_item", base_price: 30, price_suffix: "each" }), "$30 each");
eq("variable", formatServiceDisplayPrice({ pricing_type: "variable" }), "Prices vary");
eq("override wins", formatServiceDisplayPrice({ pricing_type: "fixed", base_price: 20, display_override: "By quote" }), "By quote");
eq("tiered missing premium falls back", formatServiceDisplayPrice({ pricing_type: "tiered", base_price: 90 }), "$90");
eq("decimal amount", formatServiceDisplayPrice({ pricing_type: "fixed", base_price: 12.5 }), "$12.50");

console.log("Rounding increment");
eq("round 97 → 95", roundToIncrement(97, 5), 95);
eq("round 98 → 100", roundToIncrement(98, 5), 100);
eq("round 30.2 → 30", roundToIncrement(30.2, 5), 30);
eq("never negative", roundToIncrement(-3, 5), 0);
eq("default increment 5", roundToIncrement(93), 95);

console.log("Public mapper drops internal fields");
const mapped = mapPricingRowToPublic({
  service_key: "clean_condition",
  service_name: "Clean & Condition",
  category: "additional",
  short_description: "internal note",
  bullet_details: ["a", "b"],
  pricing_type: "fixed",
  base_price: 50,
  sort_order: 30,
  // fields that MUST NOT leak:
  is_public: true,
  is_active: true,
  display_override: null
});
eq("no is_public leaked", "is_public" in mapped, false);
eq("no base_price leaked", "base_price" in mapped, false);
eq("price computed", mapped.price, "$50");
eq("bullets passed", mapped.bullets, ["a", "b"]);

console.log("Fallback covers all seven services with approved prices");
eq("fallback count", PUBLIC_PRICING_FALLBACK.length, 7);
eq("fallback standard", PUBLIC_PRICING_FALLBACK[0].price, "$90–$110");
eq("fallback lace repair", PUBLIC_PRICING_FALLBACK.find((s) => s.serviceKey === "lace_repair").price, "Starting at $30");

/* ---- Pricing intelligence math (mirror of admin.js computeServicePricingIntel) ---- */
console.log("Target-price estimate + minimum shop charge");
function targetEstimate(medianMinutes, avgMaterials, targetRate, minCharge, rounding) {
  const raw = (medianMinutes / 60) * targetRate + avgMaterials;
  const floored = Math.max(raw, minCharge);
  return { raw, rounded: roundToIncrement(floored, rounding), minChargeApplied: floored > raw + 1e-6 };
}
// Example A: median 100 min, materials $15.20, target $45/hr → raw ≈ $90.20 → $90 rounded.
const exA = targetEstimate(100, 15.2, 45, 30, 5);
eq("Example A raw ≈ 90.2", Math.round(exA.raw * 100) / 100, 90.2);
eq("Example A rounded $90", exA.rounded, 90);
eq("Example A min charge not applied", exA.minChargeApplied, false);
// Small job floored by the $30 minimum shop charge.
const small = targetEstimate(15, 4, 45, 30, 5);
eq("small job floored to min", small.rounded, 30);
eq("small job min applied", small.minChargeApplied, true);

console.log("Effective rate rises when the same-price job is done faster");
function effectiveRate(price, materials, minutes) {
  return (price - materials) / (minutes / 60);
}
const slow = effectiveRate(90, 15, 100);   // 1h40 → $45/hr
const fast = effectiveRate(90, 15, 80);     // 1h20 → higher
eq("slow ≈ $45/hr", Math.round(slow), 45);
eq("faster increases effective rate", fast > slow, true);

console.log("Faster work does not trigger a price-cut recommendation");
// Interpretation mirror: effective >= target while median time dropped → efficiency, not a cut.
function interpret(effRate, targetRate, trend, n) {
  if (n < 3) return "Learning";
  if (effRate >= targetRate && trend === "improved") return "Efficiency Improved";
  if (effRate < targetRate * 0.7) return "Review Recommended";
  if (effRate < targetRate) return "Below Target at Current Median Time";
  if (effRate >= targetRate * 1.2) return "Strong Margin";
  return "Price Covers Target";
}
eq("Example A → Price Covers Target", interpret(45, 45, "stable", 4), "Price Covers Target");
eq("Example B → Efficiency Improved", interpret(51, 45, "improved", 6), "Efficiency Improved");
eq("never says lower the price", interpret(51, 45, "improved", 6) !== "Under Target", true);

/* ---- Correction 1: is_public and is_active are independent ---- */
console.log("Public vs active independence");
const pubActive     = { is_public: true,  is_active: true,  published_at: "2026-07-24T00:00:00Z" };
const pubInactive   = { is_public: true,  is_active: false, published_at: "2026-07-24T00:00:00Z" };
const hiddenActive  = { is_public: false, is_active: true,  published_at: "2026-07-24T00:00:00Z" };
const hiddenInactive= { is_public: false, is_active: false, published_at: "2026-07-24T00:00:00Z" };
const unpublished   = { is_public: true,  is_active: true,  published_at: null };
// 1. Public + active: on the website AND available for new quotes.
eq("public+active on website", publiclyVisible(pubActive), true);
eq("public+active for quotes", quoteAvailable(pubActive), true);
// 2. Public + inactive: on the website but NOT for new quotes.
eq("public+inactive on website", publiclyVisible(pubInactive), true);
eq("public+inactive NOT for quotes", quoteAvailable(pubInactive), false);
// 3. Hidden + active: NOT on the website but available internally.
eq("hidden+active NOT on website", publiclyVisible(hiddenActive), false);
eq("hidden+active available internally", quoteAvailable(hiddenActive), true);
// 4. Hidden + inactive: not public, not for quotes (remains historical in DB).
eq("hidden+inactive NOT on website", publiclyVisible(hiddenInactive), false);
eq("hidden+inactive NOT for quotes", quoteAvailable(hiddenInactive), false);
// Unpublished never shows publicly regardless of flags.
eq("unpublished NOT on website", publiclyVisible(unpublished), false);

/* ---- Correction 2: public pricing last-known-good cache ----
   Mirrors the localStorage flow in assets/js/main.js against the shared schema
   helpers, using an in-memory storage shim. */
console.log("Public pricing last-known-good cache");
const store = new Map();
const CACHE_KEY = "mm.servicePricing.v1";
function saveSnapshot(services) {
  store.set(CACHE_KEY, JSON.stringify({
    version: SERVICE_PRICING_CACHE_VERSION,
    savedAt: new Date().toISOString(),
    services: services.map(normalizeServiceForCache)
  }));
}
function readSnapshot() {
  try {
    const raw = store.has(CACHE_KEY) ? store.get(CACHE_KEY) : null;
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || obj.version !== SERVICE_PRICING_CACHE_VERSION || !isValidServicesPayload(obj.services)) return null;
    return obj;
  } catch { return null; }
}
// Simulates initPublicServicePricing's fallback order. apiResult is
// { ok, services } or an Error.
function loadFlow(apiResult) {
  if (!(apiResult instanceof Error) && apiResult.ok && isValidServicesPayload(apiResult.services)) {
    saveSnapshot(apiResult.services);
    return { rendered: "api", services: apiResult.services };
  }
  const snap = readSnapshot();
  if (snap) return { rendered: "snapshot", services: snap.services };
  return { rendered: "static" };
}

const svcV1 = [{ serviceKey: "standard_full_service", name: "Standard Full Service", category: "relacing", shortDescription: "x", bullets: ["a"], pricingType: "tiered", price: "$90–$110", sortOrder: 10 }];
const svcV2 = [{ serviceKey: "standard_full_service", name: "Standard Full Service", category: "relacing", shortDescription: "x", bullets: ["a"], pricingType: "tiered", price: "$95–$115", sortOrder: 10 }];

// 1. Successful API response renders and stores last-known-good pricing.
store.clear();
let r = loadFlow({ ok: true, services: svcV1 });
eq("API success renders", r.rendered, "api");
eq("API success stored snapshot", !!readSnapshot(), true);

// 2. API failure uses last-known-good pricing when available.
r = loadFlow(new Error("network down"));
eq("API failure uses snapshot", r.rendered, "snapshot");
eq("snapshot price served", r.services[0].price, "$90–$110");

// 3. Invalid cached data is ignored.
store.set(CACHE_KEY, "{ not valid json");
eq("garbage cache ignored", readSnapshot(), null);
store.set(CACHE_KEY, JSON.stringify({ version: 999, services: svcV1 }));
eq("stale schema ignored", readSnapshot(), null);
store.set(CACHE_KEY, JSON.stringify({ version: SERVICE_PRICING_CACHE_VERSION, services: [] }));
eq("empty cached payload ignored", readSnapshot(), null);
r = loadFlow(new Error("still down"));
eq("invalid cache → static", r.rendered, "static");

// 4. Static HTML remains when both API and cache are unavailable.
store.clear();
r = loadFlow(new Error("down"));
eq("no api + no cache → static", r.rendered, "static");
eq("empty API payload does not render/blank", isValidServicesPayload([]), false);

// 5. Future successful data replaces an older cached snapshot.
store.clear();
loadFlow({ ok: true, services: svcV1 });
loadFlow({ ok: true, services: svcV2 });
eq("newer snapshot replaces older", readSnapshot().services[0].price, "$95–$115");

// 6. Only published public fields are stored (no secrets / internal fields).
const withSecrets = [{
  serviceKey: "clean_condition", name: "Clean & Condition", category: "additional",
  shortDescription: "note", bullets: ["b"], pricingType: "fixed", price: "$50", sortOrder: 30,
  basePrice: 50, premiumPrice: null, is_active: true, note: "internal reason", serviceRoleKey: "SECRET"
}];
store.clear();
loadFlow({ ok: true, services: withSecrets });
const storedKeys = Object.keys(readSnapshot().services[0]).sort();
eq("cache keys are public-only", storedKeys, ["bullets", "category", "name", "price", "pricingType", "serviceKey", "shortDescription", "sortOrder"]);
eq("no base_price cached", "basePrice" in readSnapshot().services[0], false);
eq("no secret cached", "serviceRoleKey" in readSnapshot().services[0], false);
eq("no internal note cached", "note" in readSnapshot().services[0], false);

/* ---- Preview environment detection (notification-suppression safety) ---- */
console.log("Environment detection");
// Default (no signal) is fail-safe production so nothing that should send is
// accidentally suppressed.
eq("empty env → production", getEnvironmentName({}), "production");
eq("empty env not preview", isPreviewEnvironment({}), false);
// Explicit MURPHOS_ENV is authoritative.
eq("MURPHOS_ENV=preview → preview", isPreviewEnvironment({ MURPHOS_ENV: "preview" }), true);
eq("MURPHOS_ENV=staging → preview", isPreviewEnvironment({ MURPHOS_ENV: "staging" }), true);
eq("MURPHOS_ENV=production → production", isPreviewEnvironment({ MURPHOS_ENV: "production" }), false);
eq("MURPHOS_ENV=prod → production", getEnvironmentName({ MURPHOS_ENV: "prod" }), "production");
eq("unrecognized MURPHOS_ENV fails safe to production", isPreviewEnvironment({ MURPHOS_ENV: "banana" }), false);
// Branch metadata escalates to preview only for non-production branches.
eq("branch feature → preview", isPreviewEnvironment({ CF_PAGES_BRANCH: "murphos-pricing-management" }), true);
eq("branch main → production", isPreviewEnvironment({ CF_PAGES_BRANCH: "main" }), false);
eq("explicit production wins over feature branch", isPreviewEnvironment({ MURPHOS_ENV: "production", CF_PAGES_BRANCH: "feature-x" }), false);
eq("custom PRODUCTION_BRANCH respected", isPreviewEnvironment({ CF_PAGES_BRANCH: "release", PRODUCTION_BRANCH: "release" }), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
