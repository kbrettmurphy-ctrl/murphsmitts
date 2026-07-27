/* Public order tracking (3.2). GET /api/track?t=<token>
   Read-only, token-gated (64-hex, unguessable — the token is the auth).
   Returns ONLY customer-safe fields: first name, glove, status stage,
   dates, tracking number, and curated gallery photos linked to the order.
   Never address, contact info, price, or internal notes. */

const STAGE_MAP = {
  "Received": 1,
  "Estimate Sent": 2,
  "Pending Response": 2,
  "Customer Approved": 3,
  "In Transit to Me": 3,
  "In Progress": 4,
  "Waiting on Lace/Parts": 4,
  "On Hold": 4,
  "Ready to Go": 5,
  "Completed": 6,
  "Picked Up": 6
};

export async function onRequest(context) {
  const { request, env } = context;
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  const token = new URL(request.url).searchParams.get("t") || "";
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return new Response(JSON.stringify({ ok: false }), { status: 404, headers });
  }

  const resp = await supabaseFetch(
    env,
    `/rest/v1/orders?tracking_token=eq.${encodeURIComponent(token)}&select=order_number,customer_name,brand_model,glove_type,status,estimated_completion,date_completed,tracking_number,carrier,drop_off_method&limit=1`
  );
  const order = resp.ok && Array.isArray(resp.data) ? resp.data[0] : null;
  if (!order) {
    return new Response(JSON.stringify({ ok: false }), { status: 404, headers });
  }

  let photos = [];
  const links = await supabaseFetch(
    env,
    `/rest/v1/gallery_photo_links?order_number=eq.${encodeURIComponent(order.order_number)}&select=photo_url,is_cover`
  );
  if (links.ok && Array.isArray(links.data)) {
    photos = links.data
      .sort((a, b) => (b.is_cover === true) - (a.is_cover === true))
      .map(l => l.photo_url);
  }

  const status = String(order.status || "Received");
  let stage = STAGE_MAP[status] || 1;

  /* "On Hold" is a pause that can happen at any point in the workflow, so a
     fixed stage misleads — an order held right after the estimate must not look
     like it is "in the shop". Use the furthest stage the order actually reached,
     read from its status-change history. */
  if (status === "On Hold") {
    stage = await furthestReachedStage(env, order.order_number);
  }

  return new Response(JSON.stringify({
    ok: true,
    firstName: String(order.customer_name || "").trim().split(/\s+/)[0] || "there",
    orderNumber: order.order_number,
    brandModel: order.brand_model || "",
    gloveType: order.glove_type || "",
    status,
    stage,
    shipped: /shipped/i.test(String(order.drop_off_method || "")),
    estimatedCompletion: order.estimated_completion,
    dateCompleted: order.date_completed,
    trackingNumber: order.tracking_number || "",
    carrier: order.carrier || "",
    photos
  }), { status: 200, headers });
}

/* Furthest forward stage an order actually reached, from its status-change
   history (order_activity rows store event_detail as "Old Status -> New
   Status"). Pause states ("On Hold") are ignored. Falls back to stage 1 when
   there is no recorded progress. */
async function furthestReachedStage(env, orderNumber) {
  const resp = await supabaseFetch(
    env,
    `/rest/v1/order_activity?order_number=eq.${encodeURIComponent(orderNumber)}&event_type=eq.status_changed&select=event_detail`
  );
  const rows = resp.ok && Array.isArray(resp.data) ? resp.data : [];
  let max = 0;
  for (const row of rows) {
    for (const part of String(row.event_detail || "").split("->")) {
      const s = part.trim();
      if (!s || s === "On Hold") continue;
      const st = STAGE_MAP[s];
      if (st && st > max) max = st;
    }
  }
  return max || 1;
}

async function supabaseFetch(env, path, options = {}) {
  const resp = await fetch(`${env.SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  let data = null;
  try { data = await resp.json(); } catch {}
  return { ok: resp.ok, data };
}
