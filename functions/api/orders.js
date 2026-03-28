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

    if (action === "getOrder") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const orderNumber = String(body.orderNumber || "").trim();
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

      const existing = await fetchOrderByNumber(env, orderNumber);
      if (!existing.ok) {
        return json(
          {
            ok: false,
            error: "Order not found."
          },
          200,
          jsonHeaders
        );
      }

      return json(
        {
          ok: true,
          order: mapOrderFromDb(existing.data)
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

      const existing = await fetchOrderByNumber(env, orderNumber);
      if (!existing.ok || !existing.data) {
        return json(
          {
            ok: false,
            error: `Order not found: ${orderNumber}`
          },
          200,
          jsonHeaders
        );
      }

      const oldRow = existing.data;
      const oldStatus = normalizeStatus(oldRow.status);
      const lastStatusEmailed = normalizeStatus(oldRow.last_status_emailed);

      const dbUpdates = mapUpdatesToDb(updates);
      const mergedPreview = { ...oldRow, ...dbUpdates };

      const newStatus = normalizeStatus(mergedPreview.status);
      const statusChanged = !!newStatus && newStatus !== oldStatus;
      const shouldEmailForStatus = statusChanged && newStatus !== "picked up" && newStatus !== lastStatusEmailed;

      // Keep the old GAS shipping rule:
      // cannot mark shipped orders completed if unpaid and no override.
      if (
        newStatus === "completed" &&
        looksLikeShipMethod(mergedPreview.drop_off_method) &&
        normalizePaidValue(mergedPreview.paid) !== "paid" &&
        !toBoolean(mergedPreview.allow_ship_without_payment)
      ) {
        return json(
          {
            ok: false,
            error: "Cannot mark a shipped order completed unless it is paid or override is checked."
          },
          200,
          jsonHeaders
        );
      }

      // GAS behavior: stamp Date Completed when becoming Completed if blank.
      if (newStatus === "completed" && !mergedPreview.date_completed) {
        dbUpdates.date_completed = todayIsoDate();
        mergedPreview.date_completed = dbUpdates.date_completed;
      }

      // If status changed to Picked Up, mark last emailed without sending.
      if (statusChanged && newStatus === "picked up") {
        dbUpdates.last_status_emailed = "Picked Up";
        mergedPreview.last_status_emailed = "Picked Up";
      }

      // If a real status email needs to go out, force email config to exist BEFORE patching.
      if (shouldEmailForStatus) {
        if (!env.RESEND_API_KEY) {
          return json(
            {
              ok: false,
              error: "Missing RESEND_API_KEY environment variable."
            },
            500,
            jsonHeaders
          );
        }
      }

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

      let updated = Array.isArray(patch.data) ? patch.data[0] : null;
      if (!updated) {
        return json(
          {
            ok: false,
            error: "Update succeeded but no row was returned."
          },
          200,
          jsonHeaders
        );
      }

      // Send status email after successful update, then stamp Last Status Emailed.
      if (shouldEmailForStatus) {
        const emailResult = await sendStatusEmail(env, updated, normalizeDisplayStatus(updated.status));

        if (!emailResult.ok) {
          return json(
            {
              ok: false,
              error: "Order updated, but status email failed to send.",
              details: emailResult.error
            },
            200,
            jsonHeaders
          );
        }

        const stamp = await supabaseFetch(
          env,
          `/rest/v1/orders?order_number=eq.${encodeURIComponent(orderNumber)}`,
          {
            method: "PATCH",
            headers: {
              Prefer: "return=representation"
            },
            body: JSON.stringify({
              last_status_emailed: normalizeDisplayStatus(updated.status)
            })
          }
        );

        if (stamp.ok && Array.isArray(stamp.data) && stamp.data[0]) {
          updated = stamp.data[0];
        }
      }

      return json(
        {
          ok: true,
          order: mapOrderFromDb(updated)
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

async function fetchOrderByNumber(env, orderNumber) {
  const resp = await supabaseFetch(
    env,
    `/rest/v1/orders?select=*&order_number=eq.${encodeURIComponent(orderNumber)}&limit=1`
  );

  if (!resp.ok) return resp;

  return {
    ok: true,
    data: Array.isArray(resp.data) ? (resp.data[0] || null) : null
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
    lacePrimary: row.primary_lace_color,
    secondaryLaceColor: row.secondary_lace_color,
    laceAccent: row.secondary_lace_color,
    customColorRequest: row.custom_color_request,
    customLaceNotes: row.custom_color_request,

    dropOffMethod: row.drop_off_method,
    dropoffMethod: row.drop_off_method,
    deliveryMethod: row.drop_off_method,
    shippingMethod: row.drop_off_method,
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

  if ("allowShipWithoutPayment" in updates) out.allow_ship_without_payment = toBoolean(updates.allowShipWithoutPayment);

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

/* =========================
   EMAIL LOGIC
========================= */
const BRAND_NAME = "Murph's Mitt Maintenance";
const THANKS_LINE = "Thanks again for choosing Murph's Mitts!";
const REVIEW_URL = "https://g.page/r/CRL9ZI21aIheEBM/review";

async function sendStatusEmail(env, row, statusDisplay) {
  const order = mapOrderFromDb(row);
  const email = String(order.emailAddress || "").trim();
  if (!email) {
    return { ok: true, skipped: true, reason: "No email address on order." };
  }

  const status = normalizeStatus(statusDisplay);
  if (!status) {
    return { ok: true, skipped: true, reason: "Blank status." };
  }

  if (status === "picked up") {
    return { ok: true, skipped: true, reason: "Picked Up is internal-only." };
  }

  const orderNum = String(order.orderNumber || "").trim() || "(unknown)";
  const firstName = getFirstName(order.customerName);
  const subject = `Murph's Mitt Maintenance – Update for Order #${orderNum}: ${statusDisplay}`;
  const msg = statusMessageSmart(order, statusDisplay);

  const isCompleted = status === "completed";

  const beforeThanks =
`Hey${firstName ? " " + firstName : ""},

Quick update on your glove service.

Order #: ${orderNum}
New Status: ${statusDisplay}

${msg}`.trimEnd();

  const afterThanks =
`${THANKS_LINE}

-Brett`;

  const plainBody = isCompleted
    ? `${beforeThanks}\n\n${reviewText()}\n\n${afterThanks}`
    : `${beforeThanks}\n\n${afterThanks}`;

  const htmlBody = isCompleted
    ? wrapEmailHtmlSplit(beforeThanks, afterThanks, true)
    : wrapEmailHtmlSplit(beforeThanks, afterThanks, false);

  return await sendBrandedEmail(env, {
    to: email,
    subject,
    plainBody,
    htmlBody
  });
}

function statusMessageSmart(order, statusDisplay) {
  const s = normalizeStatus(statusDisplay);

  if (s === "received") {
    return "Your glove is checked in and queued up.";
  }

  if (s === "estimate sent") {
    const services = cleanDisplay(order.servicesRequested);
    const lace1 = cleanDisplay(order.primaryLaceColor || order.lacePrimary);
    const lace2 = cleanDisplay(order.secondaryLaceColor || order.laceAccent);
    const laceNotes = cleanDisplay(order.customLaceNotes || order.customColorRequest);
    const formattedPrice = formatCurrency(order.priceQuoted);

    return `Here is your estimate and request summary:

Services Requested:
${services || "Not specified"}

Lace Colors:
Primary: ${lace1 || "Not specified"}
Accent: ${lace2 || "None"}
${laceNotes ? "Color Notes: " + laceNotes : ""}

Estimated Total:
${formattedPrice || "Pending"}

Reply YES to approve and coordinate drop-off/shipping so that I can begin the work.
Reply NO to cancel this request.

If I don't hear back within 48 hours, the order will be placed on hold.`;
  }

  if (s === "in progress") {
    const formattedDate = formatLongDate(order.estimatedCompletion);

    return `Work has begun on your glove!${formattedDate ? "\n\nEstimated completion: " + formattedDate : ""}

I'll keep you updated if anything changes.`;
  }

  if (s === "waiting on parts") {
    return "Your glove is temporarily on hold while I wait on materials needed to complete the work.\n\nAs soon as the parts arrive, I'll be able to start the work and send another update.";
  }

  if (s === "ready to go") {
    const ship = looksLikeShipMethod(order.dropOffMethod);
    const paid = normalizePaidValue(order.paid);

    if (ship) {
      if (paid === "paid") {
        return `Your glove is done and ready to be shipped!

I'll be reaching out shortly to confirm shipping details and get this sent out to you.`;
      }

      return `Your glove is done and ready to be shipped!

I'll be reaching out shortly to confirm shipping details and finalize payment before I send it out.`;
    }

    if (paid === "paid") {
      return `Your glove is done and ready for pickup!

I'll call/text shortly to coordinate a pickup time.`;
    }

    return `Your glove is done and ready for pickup!

I'll call/text shortly to coordinate pickup. If you haven't paid yet, we'll get that squared away at pickup.`;
  }

  if (s === "completed") {
    const ship = looksLikeShipMethod(order.dropOffMethod);
    const paid = normalizePaidValue(order.paid);

    if (ship) {
      const carrier = cleanDisplay(order.carrier);
      const tracking = cleanDisplay(order.trackingNumber || order.tracking);
      const link = buildTrackingLink(carrier, tracking);

      const trackingLine = tracking
        ? `\nCarrier: ${carrier || "Not specified"}\nTracking Number: ${tracking}${link ? "\nTracking Link: " + link : ""}`
        : "";

      if (paid !== "paid") {
        return `All finished up. Your glove is on the way!${trackingLine}

Quick note: this one went out under the “ship before payment” exception.
If you've already handled payment, you're all set.
If not, please take care of it when you can.`;
      }

      return `All finished up. Your glove is on the way!${trackingLine}

I really appreciate the support. Hope it feels great when it hits your mailbox.`;
    }

    if (paid !== "paid") {
      return `Your glove is all finished up.

I just need to get payment taken care of before we fully close this one out.
Whenever you're ready, shoot me a message and we'll settle up.

Appreciate you trusting me with it.`;
    }

    return `Your glove is officially finished and good to go!

I really appreciate you trusting me with your glove and hope it treats you well on the field.

If you ever need another glove cleaned up, relaced, or tuned up, you know where to find me!`;
  }

  return "Status has been updated.";
}

async function sendBrandedEmail(env, { to, subject, plainBody, htmlBody }) {
  const from = env.RESEND_FROM || "Murph's Mitt Maintenance <orders@murphsmitts.com>";
  const replyTo = env.RESEND_REPLY_TO || undefined;

  const payload = {
    from,
    to: [to],
    bcc: ["murphsmitts@gmail.com"],
    subject,
    text: plainBody,
    html: htmlBody
  };

  if (replyTo) payload.reply_to = replyTo;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
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
      error: data || `HTTP ${resp.status}`
    };
  }

  return {
    ok: true,
    data
  };
}

function reviewText() {
  return `If I earned it, would you mind leaving me a review?
${REVIEW_URL}
It helps my small business show up in Google search results.`;
}

function reviewHtml() {
  return `
  <div style="margin:12px 0;">
    If I earned it, would you mind
    <a href="${escapeHtml(REVIEW_URL)}" target="_blank" style="text-decoration:underline;">leaving me a review</a>?
    <br>
    It helps my small business show up in Google search results.
  </div>`;
}

function wrapEmailHtmlSplit(beforeThanks, afterThanks, includeReview) {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 640px; line-height: 1.45; text-align:left;">
    <div style="white-space:pre-wrap; margin:0;">${escapeHtml(beforeThanks)}</div>
    ${includeReview ? reviewHtml() : ""}
    <div style="white-space:pre-wrap; margin:0;">${escapeHtml(afterThanks)}</div>
  </div>`;
}

/* =========================
   SMALL HELPERS
========================= */
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

function toBoolean(value) {
  if (value === true) return true;
  const v = String(value || "").trim().toLowerCase();
  return v === "true" || v === "yes" || v === "1" || v === "checked";
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDisplayStatus(value) {
  return String(value || "").trim();
}

function normalizePaidValue(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "paid" || v === "yes" || v === "true") return "paid";
  return "unpaid";
}

function looksLikeShipMethod(value) {
  return String(value || "").trim().toLowerCase().includes("ship");
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isNaN(n) ? String(value) : `$${n.toFixed(2)}`;
}

function formatLongDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function todayIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getFirstName(fullName) {
  const s = String(fullName || "").trim();
  return s ? s.split(/\s+/)[0] : "";
}

function cleanDisplay(value) {
  return String(value || "").trim();
}

function buildTrackingLink(carrierRaw, trackingNumberRaw) {
  const carrier = String(carrierRaw || "").trim().toLowerCase();
  const tracking = String(trackingNumberRaw || "").trim();
  if (!tracking) return "";

  const enc = encodeURIComponent(tracking);
  if (carrier.includes("usps")) return "https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=" + enc;
  if (carrier.includes("ups")) return "https://www.ups.com/track?loc=en_US&tracknum=" + enc;
  if (carrier.includes("fedex") || carrier.includes("fed ex")) return "https://www.fedex.com/fedextrack/?trknbr=" + enc;
  return "";
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
