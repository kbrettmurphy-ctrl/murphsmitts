/* Public service pricing (Pricing Management). GET /api/public/service-pricing
   Read-only, no auth. Returns ONLY published + public services (is_active is
   NOT required — it governs internal quote availability, not website
   visibility), sorted by category then sort order. Never exposes drafts,
   internal notes, revision history, raw base/premium fields, or any secret.
   Server-side Supabase read with the service_role key — it never reaches the
   browser. */

import { mapPricingRowToPublic, publiclyVisible } from "../_pricing.js";

const CATEGORY_ORDER = { relacing: 0, additional: 1 };

export async function onRequestGet(context) {
  const { env } = context;

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    /* Cache at the edge + browser for 5 minutes; allow a stale copy while
       revalidating so a slow origin never blanks the Services page. */
    "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600"
  };

  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return json({ ok: false, error: "Pricing service unavailable." }, 503, {
        ...headers,
        "Cache-Control": "no-store"
      });
    }

    /* Public display requires a PUBLISHED, PUBLIC service. is_active is
       deliberately NOT filtered here — it governs internal quote availability,
       not website visibility. A service can be public but inactive (shown on
       the site, not offered for new quotes) or hidden but active (available
       internally, not on the site). */
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/service_pricing` +
        `?select=service_key,service_name,category,short_description,bullet_details,pricing_type,base_price,premium_price,price_suffix,display_override,sort_order,is_public,published_at` +
        `&is_public=eq.true&published_at=not.is.null` +
        `&order=category.asc,sort_order.asc`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : [];
    } catch {
      data = [];
    }

    if (!res.ok || !Array.isArray(data)) {
      return json({ ok: false, error: "Pricing could not be loaded." }, 502, {
        ...headers,
        "Cache-Control": "no-store"
      });
    }

    const services = data
      /* Defense in depth: re-apply the public-visibility rule in code so a
         hidden/unpublished row can never leak even if the query filter changes.
         is_public/published_at are read here but never mapped into the output. */
      .filter(publiclyVisible)
      .map(mapPricingRowToPublic)
      .sort((a, b) => {
        const ca = CATEGORY_ORDER[a.category] ?? 99;
        const cb = CATEGORY_ORDER[b.category] ?? 99;
        if (ca !== cb) return ca - cb;
        return a.sortOrder - b.sortOrder;
      });

    return json({ ok: true, services }, 200, headers);
  } catch (err) {
    return json(
      { ok: false, error: err && err.message ? err.message : String(err) },
      500,
      { ...headers, "Cache-Control": "no-store" }
    );
  }
}

function json(payload, status, headers) {
  return new Response(JSON.stringify(payload), { status, headers });
}
