export async function onRequest(context) {
  const { request, env } = context;

  const jsonHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Method not allowed: ${request.method}`
      }),
      {
        status: 405,
        headers: jsonHeaders
      }
    );
  }

  try {
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

    const body = await request.json();

    // Accept both clean frontend keys and ugly legacy/google-ish labels if needed.
    const incoming = normalizeIncomingPayload(body);

    if (!incoming.customer_name) {
      return json(
        {
          ok: false,
          error: "Missing required field: customer name."
        },
        200,
        jsonHeaders
      );
    }

    if (!incoming.email_address) {
      return json(
        {
          ok: false,
          error: "Missing required field: email address."
        },
        200,
        jsonHeaders
      );
    }

    // Get next order number
    const nextOrderResp = await supabaseFetch(
      env,
      `/rest/v1/orders?select=order_number&order=order_number.desc&limit=1`
    );

    if (!nextOrderResp.ok) {
      return json(
        {
          ok: false,
          error: "Failed to determine next order number.",
          details: nextOrderResp.error
        },
        200,
        jsonHeaders
      );
    }

    const nextOrderNumber = getNextOrderNumber(nextOrderResp.data);

    const newOrder = {
      timestamp_submitted: incoming.timestamp_submitted || new Date().toISOString(),
      customer_name: incoming.customer_name,
      phone_number: incoming.phone_number,
      email_address: incoming.email_address,

      brand_model: incoming.brand_model,
      glove_type: incoming.glove_type,
      web_type: incoming.web_type,
      services_requested: incoming.services_requested,

      primary_lace_color: incoming.primary_lace_color,
      secondary_lace_color: incoming.secondary_lace_color,
      custom_color_request: incoming.custom_color_request,

      drop_off_method: incoming.drop_off_method,
      street_address: incoming.street_address,
      city: incoming.city,
      state: incoming.state,
      zip_code: incoming.zip_code,

      glove_notes: incoming.glove_notes,
      customer_notes: incoming.customer_notes || incoming.glove_notes,
      social_tag: incoming.social_tag,
      turnaround_acknowledged: incoming.turnaround_acknowledged,
      referral_source: incoming.referral_source,
      glove_photos: incoming.glove_photos,

      order_number: nextOrderNumber,
      status: "Received",
      date_received: todayIsoDate(),
      estimated_completion: null,
      price_quoted: null,
      paid: "Unpaid",
      allow_ship_without_payment: false,
      tracking_number: null,
      carrier: null,
      date_completed: null,
      internal_notes: null,
      last_status_emailed: null
    };

    const insert = await supabaseFetch(
      env,
      `/rest/v1/orders`,
      {
        method: "POST",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify(newOrder)
      }
    );

    if (!insert.ok || !Array.isArray(insert.data) || !insert.data[0]) {
      return json(
        {
          ok: false,
          error: "Failed to insert new order into Supabase.",
          details: insert.error
        },
        200,
        jsonHeaders
      );
    }

    let inserted = insert.data[0];

    // Send the same style/status logic email system used elsewhere
    const emailResult = await sendStatusEmail(env, inserted, "Received");

    if (!emailResult.ok) {
      return json(
        {
          ok: false,
          error: "Order was created, but the Received email failed to send.",
          details: emailResult.error
        },
        200,
        jsonHeaders
      );
    }

    // Stamp last_status_emailed after successful send
    const stamp = await supabaseFetch(
      env,
      `/rest/v1/orders?order_number=eq.${encodeURIComponent(inserted.order_number)}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          last_status_emailed: "Received"
        })
      }
    );

    if (stamp.ok && Array.isArray(stamp.data) && stamp.data[0]) {
      inserted = stamp.data[0];
    }

    return json(
      {
        ok: true,
        order: mapOrderFromDb(inserted)
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
   INTAKE FIELD MAPPING
========================= */
function normalizeIncomingPayload(body) {
  return {
    timestamp_submitted: pick(body, [
      "timestampSubmitted",
      "timestamp_submitted",
      "Timestamp"
    ]) || new Date().toISOString(),

    customer_name: pick(body, [
      "customerName",
      "customer_name",
      "Customer Name"
    ]),

    phone_number: pick(body, [
      "phoneNumber",
      "phone_number",
      "Phone Number"
    ]),

    email_address: pick(body, [
      "emailAddress",
      "email_address",
      "Email Address"
    ]),

    brand_model: pick(body, [
      "brandModel",
      "brand_model",
      "Brand / Model (if known)",
      "Brand / Model"
    ]),

    glove_type: pick(body, [
      "gloveType",
      "glove_type",
      "Glove Type"
    ]),

    web_type: pick(body, [
      "webType",
      "web_type",
      "Web Type (Fielders Gloves Only)",
      "Web Type"
    ]),

    services_requested: pick(body, [
      "servicesRequested",
      "services_requested",
      "Services Requested"
    ]),

    primary_lace_color: pick(body, [
      "primaryLaceColor",
      "primary_lace_color",
      "Primary Lace Color"
    ]),

    secondary_lace_color: pick(body, [
      "secondaryLaceColor",
      "secondary_lace_color",
      "Secondary / Accent Lace Color",
      "Secondary Lace Color",
      "Accent Lace Color"
    ]),

    custom_color_request: pick(body, [
      "customColorRequest",
      "custom_color_request",
      "customLaceNotes",
      "Custom Color Request"
    ]),

    drop_off_method: pick(body, [
      "dropOffMethod",
      "drop_off_method",
      "Drop-Off Method"
    ]),

    street_address: pick(body, [
      "streetAddress",
      "street_address",
      "Street Address"
    ]),

    city: pick(body, [
      "city",
      "City"
    ]),

    state: pick(body, [
      "state",
      "State"
    ]),

    zip_code: pick(body, [
      "zipCode",
      "zip_code",
      "Zip Code"
    ]),

    glove_notes: pick(body, [
      "gloveNotes",
      "glove_notes",
      "Anything I should know about this glove?"
    ]),

    customer_notes: pick(body, [
      "customerNotes",
      "customer_notes"
    ]),

    social_tag: pick(body, [
      "socialTag",
      "social_tag",
      "If I post a video of your glove and you’d like to be tagged, enter your platform + username"
    ]),

    turnaround_acknowledged: pick(body, [
      "turnaroundAcknowledged",
      "turnaround_acknowledged",
      "I understand that turnaround times vary based on workload"
    ]),

    referral_source: pick(body, [
      "referralSource",
      "referral_source",
      "How did you hear about me?"
    ]),

    glove_photos: pick(body, [
      "glovePhotos",
      "glove_photos",
      "Photos of your glove"
    ])
  };
}

function pick(obj, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = cleanText(obj[key]);
      if (value !== null) return value;
    }
  }
  return null;
}

function getNextOrderNumber(rows) {
  let nextOrder = 80;

  if (Array.isArray(rows) && rows.length) {
    const raw = String(rows[0].order_number || "").trim();
    const lastNum = parseInt(raw, 10);
    if (!Number.isNaN(lastNum)) {
      nextOrder = lastNum + 1;
    }
  }

  return String(nextOrder).padStart(4, "0");
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

/* =========================
   EMAIL LOGIC
========================= */
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

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
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
