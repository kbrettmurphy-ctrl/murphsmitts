import { sendWebPushToAll } from "./_webpush.js";
import { isPreviewEnvironment } from "./_env.js";

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return twiml("Method not allowed.");
  }

  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return twiml("Configuration error.");
    }

    const form = await request.formData();

    const from = cleanText(form.get("From"));
    const body = cleanText(form.get("Body"));
    const message = String(body || "").trim();
    const normalized = message.toLowerCase();
    
    const mediaCount = Number(form.get("NumMedia") || 0);

    if (!from || (!message && mediaCount === 0)) {
      return twiml("");
    }

    const digits = from.replace(/\D/g, "");
    const last10 = digits.slice(-10);

    const found = await supabaseFetch(
      env,
      `/rest/v1/orders?select=*&order=order_number.desc&limit=100`
    );

    if (!found.ok || !Array.isArray(found.data)) {
      await notifyOwner(env, `Incoming text lookup failed from ${from}`, message);
      return twiml("");
    }

    const order = found.data.find(row => {
      const rowDigits = String(row.phone_number || "").replace(/\D/g, "");
      return rowDigits.slice(-10) === last10;
    });

    if (!order) {
      const unknownMedia = await saveIncomingMedia(env, form, "sms-unknown");
      await storeInboundMessage(env, { from, body: message, orderNumber: null, customerName: null, mediaUrls: unknownMedia });
      await sendWebPushToAll(env, { title: "New text", body: `${from}: ${message}`.slice(0, 140), url: "/admin/?view=messages" });
      await notifyOwner(env, `Incoming text from unknown number ${from}`, message);
      return twiml("");
    }

    const orderNumber = order.order_number;
    const mediaUrls = await saveIncomingMedia(env, form, orderNumber);
    
    const existingPhotos = parsePhotoList(order.glove_photos);

    const updates = {
      last_customer_text: message || (mediaUrls.length ? "[Photo received]" : ""),
      last_customer_text_at: new Date().toISOString()
    };

    if (mediaUrls.length) {
      updates.glove_photos = [...existingPhotos, ...mediaUrls];
    }

    /* No auto-reply by default — Brett answers from the Messages inbox.
       Only the YES/NO estimate flows below send a confirmation. */
    let reply = "";

    if (normalized === "yes" || normalized === "y") {
      if (normalizeStatus(order.status) === "estimate sent") {
        updates.status = "Customer Approved";
        updates.customer_approved_at = new Date().toISOString();

        reply = "Awesome — you're approved! I'll be in touch to sort out drop-off or shipping. Thanks so much!";
      } else {
        reply = "Thanks — got your approval! I'll follow up if I need anything else.";
      }
    }

    if (normalized === "no" || normalized === "n") {
      if (normalizeStatus(order.status) === "estimate sent") {
        updates.status = "On Hold";
        reply = "No problem at all — I've set it aside for now. Just reach out whenever you're ready and I'll pick it right back up.";
      } else {
        reply = "Thanks — got your message! I'll follow up if anything's needed.";
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
        body: JSON.stringify(updates)
      }
    );

    if (!patch.ok) {
      await notifyOwner(env, `Incoming text failed to save for Order #${orderNumber}`, message);
      return twiml("");
    }

    await storeInboundMessage(env, {
      from,
      body: message,
      orderNumber,
      customerName: order.customer_name || null,
      mediaUrls
    });

    await sendWebPushToAll(env, {
      title: `Text from ${order.customer_name || "customer"}`,
      body: (message || "[Photo received]").slice(0, 140),
      url: "/admin/?view=messages"
    });

    await notifyOwner(
      env,
      `Text from Order #${orderNumber}`,
      `${order.customer_name || "Customer"}: ${message}`
    );

    if (reply) {
      await storeOutboundMessage(env, {
        to: from,
        body: reply,
        orderNumber,
        customerName: order.customer_name || null
      });
    }

    return twiml(reply);
  } catch (err) {
    return twiml("");
  }
}

function twiml(message) {
  const safe = escapeXml(message || "");
  const inner = safe ? `<Message>${safe}</Message>` : "";
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, {
    status: 200,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

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
    return { ok: false, status: resp.status, error: data };
  }

  return { ok: true, status: resp.status, data };
}

async function storeInboundMessage(env, { from, body, orderNumber, customerName, mediaUrls }) {
  try {
    await supabaseFetch(env, `/rest/v1/sms_messages`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        direction: "in",
        phone_number: from,
        customer_name: customerName || null,
        order_number: orderNumber || null,
        body: body || "",
        media_urls: mediaUrls && mediaUrls.length ? mediaUrls : null,
        read: false
      })
    });
  } catch {
    /* The reply flow must never fail because logging the message failed. */
  }
}

async function storeOutboundMessage(env, { to, body, orderNumber, customerName }) {
  try {
    await supabaseFetch(env, `/rest/v1/sms_messages`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        direction: "out",
        phone_number: to,
        customer_name: customerName || null,
        order_number: orderNumber || null,
        body: body || "",
        read: true
      })
    });
  } catch {
    /* The reply flow must never fail because logging the auto-reply failed. */
  }
}

async function notifyOwner(env, title, message) {
  if (isPreviewEnvironment(env)) {
    console.log(`[preview] Suppressed Pushover alert: ${title}`);
    return;
  }
  if (!env.PUSHOVER_APP_TOKEN || !env.PUSHOVER_USER_KEY) return;

  try {
    await fetch("https://api.pushover.net/1/messages.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        token: env.PUSHOVER_APP_TOKEN,
        user: env.PUSHOVER_USER_KEY,
        title,
        message
      })
    });
  } catch {}
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function saveIncomingMedia(env, form, orderNumber) {
  const count = Number(form.get("NumMedia") || 0);
  if (!count) return [];

  const savedUrls = [];

  for (let i = 0; i < count; i++) {
    const mediaUrl = String(form.get(`MediaUrl${i}`) || "").trim();
    const contentType = String(form.get(`MediaContentType${i}`) || "image/jpeg").trim();

    if (!mediaUrl || !contentType.startsWith("image/")) continue;

    const ext = contentType.includes("png") ? "png" : "jpg";
    const filename = `${orderNumber}/${Date.now()}-${i}.${ext}`;

    const fileResp = await fetch(mediaUrl, {
      headers: {
        Authorization: "Basic " + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)
      }
    });

    if (!fileResp.ok) continue;

    const bytes = await fileResp.arrayBuffer();

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

    if (!uploadResp.ok) continue;

    savedUrls.push(
      `${env.SUPABASE_URL}/storage/v1/object/public/order-photos/${filename}`
    );
  }

  return savedUrls;
}

function parsePhotoList(value) {
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
