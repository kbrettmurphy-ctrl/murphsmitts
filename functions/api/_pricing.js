/* Shared pricing helpers for the public pricing endpoint and the admin API.
   Pure functions only — no secrets, no network. Both server-side callers and
   the admin client mirror this display logic, so keep it deterministic. */

/* Format a numeric amount as a whole dollar when possible, else two decimals. */
export function formatPriceAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/* Public price display string generated from the structured fields. A manual
   display_override always wins. Uses an en dash for ranges/tiers to match the
   approved copy (e.g. "$90–$110"). */
export function formatServiceDisplayPrice(row) {
  if (!row) return "";
  const override = String(row.display_override || "").trim();
  if (override) return override;

  const type = String(row.pricing_type || "fixed");
  const base = row.base_price;
  const premium = row.premium_price;
  const suffix = String(row.price_suffix || "").trim();
  const hasBase = base !== null && base !== undefined && base !== "" && Number.isFinite(Number(base));
  const hasPremium = premium !== null && premium !== undefined && premium !== "" && Number.isFinite(Number(premium));
  const money = (n) => `$${formatPriceAmount(n)}`;

  switch (type) {
    case "variable":
      return "Prices vary";
    case "starting_at":
      return hasBase ? `Starting at ${money(base)}` : "Prices vary";
    case "per_item":
      return hasBase ? `${money(base)}${suffix ? ` ${suffix}` : " each"}` : "Prices vary";
    case "range":
    case "tiered":
      if (hasBase && hasPremium) return `${money(base)}–${money(premium)}`;
      return hasBase ? money(base) : "Prices vary";
    case "fixed":
    default:
      return hasBase ? money(base) : "Prices vary";
  }
}

/* Round a raw amount to the nearest increment (default $5), never below 0. */
export function roundToIncrement(amount, increment = 5) {
  const value = Number(amount);
  const step = Number(increment);
  if (!Number.isFinite(value)) return null;
  if (!Number.isFinite(step) || step <= 0) return Math.round(value);
  return Math.max(0, Math.round(value / step) * step);
}

/* Map a service_pricing row to the customer-safe public shape. Drops internal
   notes, raw draft state, timestamps, and everything else not needed on the
   marketing site. */
export function mapPricingRowToPublic(row) {
  return {
    serviceKey: row.service_key,
    name: row.service_name,
    category: row.category || "additional",
    shortDescription: row.short_description || "",
    bullets: Array.isArray(row.bullet_details) ? row.bullet_details.map((b) => String(b)) : [],
    pricingType: row.pricing_type || "fixed",
    price: formatServiceDisplayPrice(row),
    sortOrder: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0
  };
}

/* Visibility rules — the single source of truth for the two independent flags.
   is_public governs the public WEBSITE; is_active governs internal QUOTE
   availability. They never gate each other.
   - publiclyVisible(): the public endpoint's PostgREST filter mirrors this and
     defensively re-applies it after fetch.
   - quoteAvailable(): MurphOS's new-quote / new-order suggestions apply this
     (admin.js getPublishedPriceForOrder uses the camelCase equivalent).
   Rows are DB-shaped (snake_case). */
export function publiclyVisible(row) {
  return !!row && row.is_public === true && row.published_at != null;
}

export function quoteAvailable(row) {
  return !!row && row.is_active === true && row.published_at != null;
}

/* Last-known-good client cache schema for the public pricing loader. The loader
   in assets/js/main.js mirrors these (it is a classic <script>, not a module),
   matching the existing intentional client/server mirroring pattern. Bumping
   SERVICE_PRICING_CACHE_VERSION invalidates any older stored snapshot. */
export const SERVICE_PRICING_CACHE_VERSION = 1;

/* Reduce a public service to exactly the fields that may be cached — no
   internal notes, no raw price columns, no draft state, no secrets. */
export function normalizeServiceForCache(svc) {
  return {
    serviceKey: String(svc && svc.serviceKey || ""),
    name: String(svc && svc.name || ""),
    category: svc && svc.category === "relacing" ? "relacing" : "additional",
    shortDescription: String(svc && svc.shortDescription || ""),
    bullets: svc && Array.isArray(svc.bullets) ? svc.bullets.map((b) => String(b)) : [],
    pricingType: String(svc && svc.pricingType || "fixed"),
    price: String(svc && svc.price || ""),
    sortOrder: svc && Number.isFinite(Number(svc.sortOrder)) ? Number(svc.sortOrder) : 0
  };
}

export function isValidPublicService(svc) {
  return !!svc
    && typeof svc.serviceKey === "string" && svc.serviceKey !== ""
    && typeof svc.name === "string" && svc.name !== ""
    && typeof svc.price === "string" && svc.price !== ""
    && Array.isArray(svc.bullets);
}

/* A payload is renderable only if it is a non-empty array of well-formed
   services. Requiring non-empty keeps an empty/blank API result (or malformed
   cache) from wiping the page. */
export function isValidServicesPayload(arr) {
  return Array.isArray(arr) && arr.length > 0 && arr.every(isValidPublicService);
}

/* Approved fallback prices — mirrors the migration seed. Kept here so the
   public endpoint can degrade gracefully and the static Services page fallback
   can be verified against one source of truth. Order matches display order. */
export const PUBLIC_PRICING_FALLBACK = [
  { serviceKey: "standard_full_service", name: "Standard Full Service", category: "relacing", price: "$90–$110" },
  { serviceKey: "full_relace", name: "Full Relace", category: "relacing", price: "$60–$80" },
  { serviceKey: "clean_condition", name: "Clean & Condition", category: "additional", price: "$50" },
  { serviceKey: "lace_repair", name: "Lace Repair", category: "additional", price: "Starting at $30" },
  { serviceKey: "palm_padding", name: "Palm Padding", category: "additional", price: "$20" },
  { serviceKey: "loop_replacement", name: "Thumb / Pinky Loop Replacement", category: "additional", price: "$30 each" },
  { serviceKey: "web_replacement", name: "Web Replacement", category: "additional", price: "Prices vary" }
];
