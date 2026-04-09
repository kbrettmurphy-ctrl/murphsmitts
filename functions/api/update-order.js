export async function onRequest(context) {
  const { request, env } = context;

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

  const body = await request.json();
  const { order_number, updates, deleteOrder } = body;

  if (!order_number) {
    return new Response(JSON.stringify({
      ok: false,
      error: "Missing order_number"
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (deleteOrder) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?order_number=eq.${encodeURIComponent(order_number)}`,
      {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: "return=representation"
        }
      }
    );

    let data = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      return new Response(JSON.stringify({
        ok: false,
        error: data || `Delete failed (${res.status})`
      }), {
        status: res.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      deleted: true,
      order_number
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  const dbUpdates = mapUpdatesToDb(updates || {});

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?order_number=eq.${encodeURIComponent(order_number)}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(dbUpdates)
    }
  );

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    return new Response(JSON.stringify({
      ok: false,
      error: data || `Update failed (${res.status})`
    }), {
      status: res.status,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    order: Array.isArray(data) ? mapOrderFromDb(data[0]) : mapOrderFromDb(data)
  }), {
    headers: { "Content-Type": "application/json" }
  });
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

function toBoolean(value) {
  if (value === true) return true;
  const v = String(value || "").trim().toLowerCase();
  return v === "true" || v === "yes" || v === "1" || v === "checked";
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
  if ("referralSource" in updates) out.referral_source = cleanText(updates.referralSource);

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