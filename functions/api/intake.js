import { sendWebPushToAll } from "./_webpush.js";

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

    /* Post-submit photo upload from the service request form. Requires the
       order's uuid — returned only to the submitting client — so an order
       number alone can't push photos onto someone else's order. */
    if (body && body.action === "uploadOrderPhoto") {
      return await handleOrderPhotoUpload(env, body, jsonHeaders);
    }

    const shared = buildSharedIncoming(body);
    const gloves = buildGloveIncomingList(body);

    if (!shared.customer_name) {
      return json({ ok: false, error: "Missing required field: customer name." }, 200, jsonHeaders);
    }

    if (!shared.email_address) {
      return json({ ok: false, error: "Missing required field: email address." }, 200, jsonHeaders);
    }

    if (!shared.phone_number) {
      return json({ ok: false, error: "Missing required field: phone number." }, 200, jsonHeaders);
    }

    if (!shared.drop_off_method) {
      return json({ ok: false, error: "Missing required field: drop-off method." }, 200, jsonHeaders);
    }

    if (looksLikeShipMethod(shared.drop_off_method)) {
      if (!shared.street_address || !shared.city || !shared.state || !shared.zip_code) {
        return json({ ok: false, error: "Shipping requests need street, city, state, and zip." }, 200, jsonHeaders);
      }
    }

    if (!shared.turnaround_acknowledged) {
      return json(
        {
          ok: false,
          error: "You must acknowledge that turnaround times vary based on workload."
        },
        200,
        jsonHeaders
      );
    }

    for (let i = 0; i < gloves.length; i += 1) {
      const glove = gloves[i];
      const label = gloves.length > 1 ? `Glove ${i + 1}: ` : "";

      if (!glove.glove_type) {
        return json({ ok: false, error: `${label}Missing required field: glove type.` }, 200, jsonHeaders);
      }

      if (glove.glove_type === "Fielders Glove" && !glove.web_type) {
        return json({ ok: false, error: `${label}Web type is required for fielders gloves.` }, 200, jsonHeaders);
      }

      if (!glove.services_requested) {
        return json({ ok: false, error: `${label}Missing required field: services requested.` }, 200, jsonHeaders);
      }

      if (!glove.primary_lace_color) {
        return json({ ok: false, error: `${label}Missing required field: primary lace color.` }, 200, jsonHeaders);
      }
    }

    const nextOrderResp = await supabaseFetch(
      env,
      `/rest/v1/orders?select=order_number`
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

    const firstOrderNumber = getNextOrderNumber(nextOrderResp.data);
    const firstOrderInt = parseInt(firstOrderNumber, 10);
    const submittedAt = new Date().toISOString();
    const newOrders = gloves.map((glove, index) => buildOrderRow(
      shared,
      glove,
      String(firstOrderInt + index).padStart(4, "0"),
      submittedAt
    ));

    const insert = await supabaseFetch(
      env,
      `/rest/v1/orders`,
      {
        method: "POST",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify(newOrders)
      }
    );

    if (!insert.ok || !Array.isArray(insert.data) || insert.data.length !== newOrders.length) {
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

    const insertedRows = insert.data;

    for (const inserted of insertedRows) {
      const customerEmailResult = await sendStatusEmail(env, inserted, "Received");

      if (!customerEmailResult.ok) {
        return json(
          {
            ok: false,
            error: "Order was created, but the Received email failed to send.",
            details: customerEmailResult.error
          },
          200,
          jsonHeaders
        );
      }

      const customerTextResult = await sendReceivedText(env, inserted);

      if (!customerTextResult.ok) {
        return json(
          {
            ok: false,
            error: "Order was created and email sent, but the Received text failed to send.",
            details: customerTextResult.error
          },
          200,
          jsonHeaders
        );
      }

      const ownerEmailResult = await sendOwnerNewOrderEmail(env, inserted);

      if (!ownerEmailResult.ok) {
        return json(
          {
            ok: false,
            error: "Order was created and customer email sent, but owner notification failed.",
            details: ownerEmailResult.error
          },
          200,
          jsonHeaders
        );
      }

      await sendWebPushToAll(env, {
        title: "New order",
        body: `#${inserted.order_number} — ${inserted.customer_name || "Customer"} (${inserted.glove_type || "glove"})`,
        url: "/admin/"
      });
      await sendPushoverNotification(env, {
        orderNumber: inserted.order_number,
        name: inserted.customer_name,
        gloveType: inserted.glove_type,
        services: inserted.services_requested
      });
    }

    const stampedRows = [];
    for (const inserted of insertedRows) {
      const stamp = await supabaseFetch(
        env,
        `/rest/v1/orders?order_number=eq.${encodeURIComponent(inserted.order_number)}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation"
          },
          body: JSON.stringify({
            last_status_emailed: "Received",
            last_status_texted: inserted.sms_opt_in === true ? "Received" : null
          })
        }
      );

      stampedRows.push(stamp.ok && Array.isArray(stamp.data) && stamp.data[0] ? stamp.data[0] : inserted);
    }

    const orders = stampedRows.map(mapOrderFromDb);

    return json(
      {
        ok: true,
        order: orders[0],
        orders
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

function buildSharedIncoming(body) {
  return {
    customer_name: cleanText(body.customerName),
    email_address: cleanText(body.emailAddress),
    phone_number: cleanText(body.phoneNumber),
    sms_opt_in: body.smsOptIn === true,
    drop_off_method: cleanText(body.dropOffMethod),
    street_address: cleanText(body.streetAddress),
    city: cleanText(body.city),
    state: cleanText(body.state),
    zip_code: cleanText(body.zipCode),
    social_tag: cleanText(body.socialTag),
    turnaround_acknowledged: cleanText(body.turnaroundAcknowledged),
    referral_source: cleanText(body.referralSource)
  };
}

function buildGloveIncomingList(body) {
  const rawGloves = Array.isArray(body.gloves) && body.gloves.length
    ? body.gloves
    : [body];

  return rawGloves.map(glove => ({
    brand_model: cleanText(glove.brandModel),
    glove_type: cleanText(glove.gloveType),
    web_type: cleanText(glove.webType),
    services_requested: cleanText(glove.servicesRequested),
    primary_lace_color: cleanText(glove.primaryLaceColor),
    secondary_lace_color: cleanText(glove.secondaryLaceColor),
    custom_color_request: cleanText(glove.customColorRequest),
    glove_notes: cleanText(glove.gloveNotes),
    customer_notes: cleanText(glove.gloveNotes)
  }));
}

function buildOrderRow(shared, glove, orderNumber, submittedAt) {
  return {
    timestamp_submitted: submittedAt,
    customer_name: shared.customer_name,
    phone_number: shared.phone_number,
    email_address: shared.email_address,

    brand_model: glove.brand_model,
    glove_type: glove.glove_type,
    web_type: glove.web_type,
    services_requested: glove.services_requested,

    primary_lace_color: glove.primary_lace_color,
    secondary_lace_color: glove.secondary_lace_color,
    custom_color_request: glove.custom_color_request,

    drop_off_method: shared.drop_off_method,
    street_address: looksLikeShipMethod(shared.drop_off_method) ? shared.street_address : null,
    city: looksLikeShipMethod(shared.drop_off_method) ? shared.city : null,
    state: looksLikeShipMethod(shared.drop_off_method) ? shared.state : null,
    zip_code: looksLikeShipMethod(shared.drop_off_method) ? shared.zip_code : null,

    glove_notes: glove.glove_notes,
    customer_notes: glove.customer_notes,
    social_tag: shared.social_tag,
    turnaround_acknowledged: shared.turnaround_acknowledged,
    referral_source: shared.referral_source,
    glove_photos: [],

    order_number: orderNumber,
    status: "Received",
    date_received: null,
    estimated_completion: null,
    price_quoted: null,
    paid: "Unpaid",
    allow_ship_without_payment: false,
    tracking_number: null,
    carrier: null,
    date_completed: null,
    internal_notes: null,
    last_status_emailed: null,
    sms_opt_in: shared.sms_opt_in,
    last_status_texted: null
  };
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

function getNextOrderNumber(rows) {
  let maxNum = 79;

  if (Array.isArray(rows)) {
    for (const row of rows) {
      const raw = String(row.order_number || "").trim();
      const n = parseInt(raw, 10);
      if (!Number.isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }

  return String(maxNum + 1).padStart(4, "0");
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

${msg}`;

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

async function sendPushoverNotification(env, { orderNumber, name, gloveType, services }) {
  try {
    const res = await fetch("https://api.pushover.net/1/messages.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        token: env.PUSHOVER_APP_TOKEN,
        user: env.PUSHOVER_USER_KEY,
        title: `New Order #${orderNumber}`,
        message: `${name} submitted a ${gloveType}\nServices: ${services}`,
        url: "https://murphsmitts.com/admin",
        url_title: "Orders"
      })
    });

    if (!res.ok) {
      console.error("Pushover failed:", await res.text());
    }
  } catch (err) {
    console.error("Pushover error:", err);
  }
}

async function sendOwnerNewOrderEmail(env, row) {
  const ownerEmail = env.OWNER_NOTIFICATION_EMAIL || env.RESEND_REPLY_TO;
  if (!ownerEmail) {
    return { ok: true, skipped: true, reason: "No owner notification email configured." };
  }

  const order = mapOrderFromDb(row);
  const subject = `New Murph's Mitts order submitted: #${order.orderNumber}`;

  const smsUpdates = row.sms_opt_in === true ? "Yes" : "No";

  const brandModelLine = order.brandModel
    ? `Brand / Model: ${order.brandModel}\n`
    : "";

  const webTypeLine = order.webType
    ? `Web Type: ${order.webType}\n`
    : "";

  const accentLaceLine = order.secondaryLaceColor
    ? `Accent Lace: ${order.secondaryLaceColor}\n`
    : "";

  const colorNotesLine = order.customColorRequest
    ? `Color Notes: ${order.customColorRequest}\n`
    : "";

  const notesLine = order.gloveNotes
    ? `\nAdditional Notes\n${order.gloveNotes}\n`
    : "";

  const referralLine = order.referralSource
    ? `\nReferral Source: ${order.referralSource}`
    : "";

  const plainBody =
`A new service request was submitted.

Order #: ${order.orderNumber}

Customer Info
Name: ${order.customerName || ""}
Email: ${order.emailAddress || ""}
Phone: ${order.phoneNumber || ""}
Text Updates: ${smsUpdates}

Glove Info
${brandModelLine}Glove Type: ${order.gloveType || ""}
${webTypeLine}Services: ${order.servicesRequested || ""}
Primary Lace: ${order.primaryLaceColor || ""}
${accentLaceLine}${colorNotesLine}
Delivery Info
Drop-Off Method: ${order.dropOffMethod || ""}
${notesLine}${referralLine}`.trim();

  const htmlBody = `
  <div style="font-family: Arial, sans-serif; max-width: 640px; line-height: 1.35; text-align:left;">
    <p style="margin:0 0 14px;"><strong>A new service request was submitted.</strong></p>

    <p style="margin:0 0 14px;"><strong>Order #:</strong> ${escapeHtml(order.orderNumber || "")}</p>

    <h3 style="margin:18px 0 8px;">Customer Info</h3>
    <p style="margin:0;">
      <strong>Name:</strong> ${escapeHtml(order.customerName || "")}<br>
      <strong>Email:</strong> ${escapeHtml(order.emailAddress || "")}<br>
      <strong>Phone:</strong> ${escapeHtml(order.phoneNumber || "")}<br>
      <strong>Text Updates:</strong> ${escapeHtml(smsUpdates)}
    </p>

    <h3 style="margin:18px 0 8px;">Glove Info</h3>
    <p style="margin:0;">
      ${order.brandModel ? `<strong>Brand / Model:</strong> ${escapeHtml(order.brandModel)}<br>` : ""}
      <strong>Glove Type:</strong> ${escapeHtml(order.gloveType || "")}<br>
      ${order.webType ? `<strong>Web Type:</strong> ${escapeHtml(order.webType)}<br>` : ""}
      <strong>Services:</strong> ${escapeHtml(order.servicesRequested || "")}<br>
      <strong>Primary Lace:</strong> ${escapeHtml(order.primaryLaceColor || "")}<br>
      ${order.secondaryLaceColor ? `<strong>Accent Lace:</strong> ${escapeHtml(order.secondaryLaceColor)}<br>` : ""}
      ${order.customColorRequest ? `<strong>Color Notes:</strong> ${escapeHtml(order.customColorRequest)}<br>` : ""}
    </p>

    <h3 style="margin:18px 0 8px;">Delivery Info</h3>
    <p style="margin:0;">
      <strong>Drop-Off Method:</strong> ${escapeHtml(order.dropOffMethod || "")}
    </p>

    ${order.gloveNotes ? `
      <h3 style="margin:18px 0 8px;">Additional Notes</h3>
      <p style="margin:0;">${escapeHtml(order.gloveNotes)}</p>
    ` : ""}

    ${order.referralSource ? `
      <h3 style="margin:18px 0 8px;">Referral Source</h3>
      <p style="margin:0;">${escapeHtml(order.referralSource)}</p>
    ` : ""}
  </div>`;

  return await sendBrandedEmail(env, {
    to: ownerEmail,
    subject,
    plainBody,
    htmlBody
  });
}

function statusMessageSmart(order, statusDisplay) {
  const s = normalizeStatus(statusDisplay);

  if (s === "received") {
    return `Your glove request has been received.

I will get back to you if I have any questions. Otherwise, you will be receiving an order summary and quote for services at the email address you provided.

In the meantime, if you have photos of your glove, it would be very helpful if you could reply to this email and attach them so I can better determine what your glove may need.

`;
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

  if (s === "waiting on lace/parts") {
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

async function sendReceivedText(env, row) {
  if (row.sms_opt_in !== true) {
    return { ok: true, skipped: true, reason: "Customer did not opt in to SMS." };
  }

  const to = toE164US(row.phone_number);
  if (!to) {
    return { ok: true, skipped: true, reason: "Invalid or missing phone number." };
  }

  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_MESSAGING_SERVICE_SID) {
    return { ok: false, error: "Missing Twilio environment variables." };
  }

  const orderNum = String(row.order_number || "").trim() || "(unknown)";

  const body =
    `Murph's Mitts: I received your glove service request (#${orderNum}). ` +
    `I'll review the details and send an estimate by email. ` +
    `If you'd like, you can reply to this text with photos of your glove to help me evaluate it.`;

  return await sendTwilioText(env, to, body);
}

async function sendTwilioText(env, to, body) {
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID;

  const form = new URLSearchParams();
  form.set("To", to);
  form.set("MessagingServiceSid", messagingServiceSid);
  form.set("Body", body);

  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    }
  );

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
    return { ok: false, error: data || `Twilio HTTP ${resp.status}` };
  }

  return { ok: true, data };
}

function toE164US(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  return "";
}

/* =========================
   HELPERS
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

/* =========================================================================
   Customer photo upload (service request form) — mirrors the Twilio SMS
   media flow: same order-photos bucket, same glove_photos list on the order.
   ========================================================================= */

const ORDER_PHOTO_LIMIT = 12;
const ORDER_PHOTO_MAX_BASE64 = 8_500_000; // ~6MB decoded
const ORDER_PHOTO_WINDOW_MS = 24 * 60 * 60 * 1000;

async function handleOrderPhotoUpload(env, body, jsonHeaders) {
  const orderId = String(body.orderId || "").trim().toLowerCase();
  const contentType = String(body.contentType || "image/jpeg").trim().toLowerCase();
  const data = typeof body.data === "string" ? body.data : "";

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(orderId)) {
    return json({ ok: false, error: "Invalid order reference." }, 200, jsonHeaders);
  }
  if (!contentType.startsWith("image/")) {
    return json({ ok: false, error: "Only image uploads are allowed." }, 200, jsonHeaders);
  }
  if (!data || data.length > ORDER_PHOTO_MAX_BASE64) {
    return json({ ok: false, error: "Photo is missing or too large." }, 200, jsonHeaders);
  }

  const found = await supabaseFetch(
    env,
    `/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,order_number,glove_photos,timestamp_submitted&limit=1`
  );
  const order = found.ok && Array.isArray(found.data) ? found.data[0] : null;
  if (!order) {
    return json({ ok: false, error: "Order not found." }, 200, jsonHeaders);
  }

  const submitted = Date.parse(order.timestamp_submitted || "");
  if (!Number.isFinite(submitted) || (Date.now() - submitted) > ORDER_PHOTO_WINDOW_MS) {
    return json({ ok: false, error: "Photo uploads for this order have closed. You can text photos instead." }, 200, jsonHeaders);
  }

  const existing = parseOrderPhotoList(order.glove_photos);
  if (existing.length >= ORDER_PHOTO_LIMIT) {
    return json({ ok: false, error: "Photo limit reached for this order." }, 200, jsonHeaders);
  }

  let bytes;
  try {
    const binary = atob(data);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  } catch {
    return json({ ok: false, error: "Photo data could not be read." }, 200, jsonHeaders);
  }

  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const filename = `${order.order_number}/form-${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`;

  const uploadResp = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/order-photos/${filename}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": contentType,
        "x-upsert": "true"
      },
      body: bytes
    }
  );
  if (!uploadResp.ok) {
    return json({ ok: false, error: "Photo upload failed." }, 200, jsonHeaders);
  }

  const url = `${env.SUPABASE_URL}/storage/v1/object/public/order-photos/${filename}`;
  const patch = await supabaseFetch(
    env,
    `/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ glove_photos: [...existing, url] })
    }
  );
  if (!patch.ok) {
    return json({ ok: false, error: "Photo stored but could not be attached to the order." }, 200, jsonHeaders);
  }

  return json({ ok: true, url }, 200, jsonHeaders);
}

function parseOrderPhotoList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
