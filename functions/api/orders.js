export async function onRequest(context) {
  const { request, env } = context;

  const jsonHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  if (request.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        message: "admin-api is alive"
      }),
      { status: 200, headers: jsonHeaders }
    );
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Method not allowed: ${request.method}`
      }),
      { status: 405, headers: jsonHeaders }
    );
  }

  try {
    const bodyText = await request.text();
    const body = bodyText ? JSON.parse(bodyText) : {};
    const action = String(body.action || "").trim();

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return json(
        {
          ok: false,
          error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable."
        },
        500,
        jsonHeaders
      );
    }

    if (!env.ADMIN_PIN || !env.ADMIN_SESSION_SECRET) {
      return json(
        {
          ok: false,
          error: "Missing ADMIN_PIN or ADMIN_SESSION_SECRET environment variable."
        },
        500,
        jsonHeaders
      );
    }

    if (action === "login") {
      const pin = String(body.pin || "").trim();

      if (!pin || pin !== String(env.ADMIN_PIN).trim()) {
        return json(
          {
            ok: false,
            error: "Invalid PIN."
          },
          200,
          jsonHeaders
        );
      }

      const token = await createSignedToken(
        {
          role: "admin",
          exp: Date.now() + 1000 * 60 * 60 * 24 * 14
        },
        env.ADMIN_SESSION_SECRET
      );

      return json(
        {
          ok: true,
          token
        },
        200,
        jsonHeaders
      );
    }

    if (action === "listOrders") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const supa = await supabaseFetch(
        env,
        `/rest/v1/orders?select=*&order=order_number.desc`
      );

      if (!supa.ok) {
        return json(
          {
            ok: false,
            error: "Failed to load orders from Supabase.",
            details: supa.error
          },
          200,
          jsonHeaders
        );
      }

      return json(
        {
          ok: true,
          orders: (supa.data || []).map(mapOrderFromDb)
        },
        200,
        jsonHeaders
      );
    }

    if (action === "updateOrder") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const orderNumber = String(body.orderNumber || "").trim();
      const updates = body.updates || {};

      if (!orderNumber) {
        return json(
          {
            ok: false,
            error: "Missing orderNumber."
          },
          200,
          jsonHeaders
        );
      }

      const dbUpdates = mapUpdatesToDb(updates);

      const patch = await supabaseFetch(
        env,
        `/rest/v1/orders?order_number=eq.${encodeURIComponent(orderNumber)}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation"
          },
          body: JSON.stringify(dbUpdates)
        }
      );

      if (!patch.ok) {
        return json(
          {
            ok: false,
            error: "Failed to update order in Supabase.",
            details: patch.error
          },
          200,
          jsonHeaders
        );
      }

      const updated = Array.isArray(patch.data) ? patch.data[0] : null;

      return json(
        {
          ok: true,
          order: updated ? mapOrderFromDb(updated) : null
        },
        200,
        jsonHeaders
      );
    }

    return json(
      {
        ok: false,
        error: `Unknown action: ${action || "[none]"}`
      },
      200,
      jsonHeaders
    );
  } catch (err) {
    return json(
      {
        ok: false,
        error: err && err.message ? err.message : String(err)
      },
      500,
      jsonHeaders
    );
  }
}

/* =========================
   RESPONSE HELPERS
========================= */
function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers
  });
}

/* =========================
   SUPABASE
========================= */
async function supabaseFetch(env, path, options = {}) {
  const url = `${env.SUPABASE_URL}${path}`;

  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const resp = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body
  });

  const text = await resp.text();

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!resp.ok) {
    return {
      ok: false,
      status: resp.status,
      error: data
    };
  }

  return {
    ok: true,
    status: resp.status,
    data
  };
}

/* =========================
   TOKEN HELPERS
========================= */
async function createSignedToken(payload, secret) {
  const payloadBase64 = toBase64Url(JSON.stringify(payload));
  const signature = await signString(payloadBase64, secret);
  return `${payloadBase64}.${signature}`;
}

async function validateTokenFromBody(body, secret) {
  const token = String(body._token || "").trim();

  if (!token) {
    return {
      ok: false,
      error: "Missing session token."
    };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return {
      ok: false,
      error: "Invalid session token."
    };
  }

  const [payloadBase64, signature] = parts;
  const expectedSignature = await signString(payloadBase64, secret);

  if (signature !== expectedSignature) {
    return {
      ok: false,
      error: "Invalid session token."
    };
  }

  let payload;
  try {
    payload = JSON.parse(fromBase64Url(payloadBase64));
  } catch {
    return {
      ok: false,
      error: "Invalid session token payload."
    };
  }

  if (!payload.exp || Date.now() > Number(payload.exp)) {
    return {
      ok: false,
      error: "Session expired."
    };
  }

  return { ok: true, payload };
}

async function signString(input, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(input));
  return arrayBufferToBase64Url(sig);
}

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/* =========================
   ORDER MAPPING
========================= */
function mapOrderFromDb(row) {
  return {
    id: row.id,

    timestampSubmitted: row.timestamp_submitted,
    customerName: row.customer_name,
    phoneNumber: row.phone_number,
    emailAddress: row.email_address,

    brandModel: row.brand_model,
    gloveType: row.glove_type,
    webType: row.web_type,
    servicesRequested: row.services_requested,

    primaryLaceColor: row.primary_lace_color,
    secondaryLaceColor: row.secondary_lace_color,
    customColorRequest: row.custom_color_request,

    dropOffMethod: row.drop_off_method,
    streetAddress: row.street_address,
    address: row.street_address,
    city: row.city,
    state: row.state,
    zipCode: row.zip_code,
    zip: row.zip_code,

    gloveNotes: row.glove_notes,
    customerNotes: row.customer_notes || row.glove_notes,
    socialTag: row.social_tag,
    turnaroundAcknowledged: row.turnaround_acknowledged,
    referralSource: row.referral_source,
    glovePhotos: row.glove_photos,

    orderNumber: row.order_number,
    status: row.status,
    dateReceived: row.date_received,
    estimatedCompletion: row.estimated_completion,
    priceQuoted: row.price_quoted,
    paid: row.paid,
    allowShipWithoutPayment: row.allow_ship_without_payment,
    trackingNumber: row.tracking_number,
    tracking: row.tracking_number,
    carrier: row.carrier,
    dateCompleted: row.date_completed,
    internalNotes: row.internal_notes,
    lastStatusEmailed: row.last_status_emailed,

    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapUpdatesToDb(updates) {
  const out = {};

  if ("status" in updates) out.status = cleanText(updates.status);
  if ("customerName" in updates) out.customer_name = cleanText(updates.customerName);
  if ("phoneNumber" in updates) out.phone_number = cleanText(updates.phoneNumber);
  if ("emailAddress" in updates) out.email_address = cleanText(updates.emailAddress);

  if ("brandModel" in updates) out.brand_model = cleanText(updates.brandModel);
  if ("gloveType" in updates) out.glove_type = cleanText(updates.gloveType);
  if ("webType" in updates) out.web_type = cleanText(updates.webType);
  if ("servicesRequested" in updates) out.services_requested = cleanText(updates.servicesRequested);

  if ("primaryLaceColor" in updates) out.primary_lace_color = cleanText(updates.primaryLaceColor);
  if ("lacePrimary" in updates && !("primaryLaceColor" in updates)) out.primary_lace_color = cleanText(updates.lacePrimary);

  if ("secondaryLaceColor" in updates) out.secondary_lace_color = cleanText(updates.secondaryLaceColor);
  if ("laceAccent" in updates && !("secondaryLaceColor" in updates)) out.secondary_lace_color = cleanText(updates.laceAccent);

  if ("customColorRequest" in updates) out.custom_color_request = cleanText(updates.customColorRequest);
  if ("customLaceNotes" in updates) out.custom_color_request = cleanText(updates.customLaceNotes);

  if ("dropOffMethod" in updates) out.drop_off_method = cleanText(updates.dropOffMethod);

  if ("streetAddress" in updates) out.street_address = cleanText(updates.streetAddress);
  if ("address" in updates && !("streetAddress" in updates)) out.street_address = cleanText(updates.address);

  if ("city" in updates) out.city = cleanText(updates.city);
  if ("state" in updates) out.state = cleanText(updates.state);

  if ("zipCode" in updates) out.zip_code = cleanText(updates.zipCode);
  if ("zip" in updates && !("zipCode" in updates)) out.zip_code = cleanText(updates.zip);

  if ("gloveNotes" in updates) out.glove_notes = cleanText(updates.gloveNotes);
  if ("customerNotes" in updates) out.customer_notes = cleanText(updates.customerNotes);

  if ("priceQuoted" in updates) out.price_quoted = cleanNumeric(updates.priceQuoted);
  if ("paid" in updates) out.paid = cleanText(updates.paid);

  if ("allowShipWithoutPayment" in updates) out.allow_ship_without_payment = Boolean(updates.allowShipWithoutPayment);

  if ("trackingNumber" in updates) out.tracking_number = cleanText(updates.trackingNumber);
  if ("tracking" in updates && !("trackingNumber" in updates)) out.tracking_number = cleanText(updates.tracking);

  if ("carrier" in updates) out.carrier = cleanText(updates.carrier);

  if ("dateReceived" in updates) out.date_received = cleanDate(updates.dateReceived);
  if ("estimatedCompletion" in updates) out.estimated_completion = cleanDate(updates.estimatedCompletion);
  if ("dateCompleted" in updates) out.date_completed = cleanDate(updates.dateCompleted);

  if ("internalNotes" in updates) out.internal_notes = cleanText(updates.internalNotes);
  if ("lastStatusEmailed" in updates) out.last_status_emailed = cleanText(updates.lastStatusEmailed);

  return out;
}

function cleanText(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function cleanNumeric(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isNaN(n) ? null : n;
}

function cleanDate(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}
