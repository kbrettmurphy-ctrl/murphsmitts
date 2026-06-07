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
    
    if (!from || !message) {
      return twiml("Thanks. I received your message.");
    }

    const digits = from.replace(/\D/g, "");
    const last10 = digits.slice(-10);

    const found = await supabaseFetch(
      env,
      `/rest/v1/orders?select=*&order=order_number.desc&limit=100`
    );

    if (!found.ok || !Array.isArray(found.data)) {
      await notifyOwner(env, `Incoming text lookup failed from ${from}`, message);
      return twiml("Thanks for the message. Brett will follow up with you.");
    }

    const order = found.data.find(row => {
      const rowDigits = String(row.phone_number || "").replace(/\D/g, "");
      return rowDigits.slice(-10) === last10;
    });

    if (!order) {
      await notifyOwner(env, `Incoming text from unknown number ${from}`, message);
      return twiml("Thanks for the message. Brett will follow up with you.");
    }

    const orderNumber = order.order_number;
    const mediaUrls = await saveIncomingMedia(env, form, orderNumber);
    
    const existingPhotos = Array.isArray(order.glove_photos) ? order.glove_photos : [];

    const updates = {
      last_customer_text: message || (mediaUrls.length ? "[Photo received]" : ""),
      last_customer_text_at: new Date().toISOString(),
      glove_photos: [...existingPhotos, ...mediaUrls]
    };

    let reply = mediaUrls.length
      ? "Thanks, I received the photo(s). Brett will review them and follow up if needed."
      : "Thanks for the message. Brett will follow up with you.";

    if (normalized === "yes" || normalized === "y") {
      if (normalizeStatus(order.status) === "estimate sent") {
        updates.status = "Customer Approved";
        updates.customer_approved_at = new Date().toISOString();

        reply = "Thanks, your estimate is approved. Brett will follow up to coordinate drop-off or shipping.";
      } else {
        reply = "Thanks, I received your approval. Brett will follow up if anything else is needed.";
      }
    }

    if (normalized === "no" || normalized === "n") {
      if (normalizeStatus(order.status) === "estimate sent") {
        updates.status = "On Hold";
        reply = "No problem. Your request has been placed on hold. Brett will follow up if needed.";
      } else {
        reply = "Thanks, I received your message. Brett will follow up if needed.";
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
      return twiml("Thanks for the message. Brett will follow up with you.");
    }

    await notifyOwner(
      env,
      `Text from Order #${orderNumber}`,
      `${order.customer_name || "Customer"}: ${message}`
    );

    return twiml(reply);
  } catch (err) {
    return twiml("Thanks for the message. Brett will follow up with you.");
  }
}

function twiml(message) {
  const safe = escapeXml(message || "");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`, {
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

async function notifyOwner(env, title, message) {
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
