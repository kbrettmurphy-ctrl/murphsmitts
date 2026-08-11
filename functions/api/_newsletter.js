import { isPreviewEnvironment } from "./_env.js";

const SOURCES = new Set(["homepage", "footer", "service_request"]);

export async function subscribeNewsletter(env, input = {}) {
  const email = normalizeEmail(input.email);
  const firstName = cleanText(input.firstName).slice(0, 80);
  const source = SOURCES.has(input.source) ? input.source : "footer";
  const requestKey = cleanText(input.requestKey).slice(0, 180);

  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address." };
  if (!requestKey) return { ok: false, error: "Refresh the page and try again." };

  if (isPreviewEnvironment(env)) {
    console.log(`[preview] Suppressed newsletter signup for ${email} from ${source}`);
    return { ok: true, suppressed: true };
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "Newsletter signup is temporarily unavailable." };
  }

  const consent = await supabaseFetch(env, "/rest/v1/newsletter_consents?on_conflict=request_key", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ email, first_name: firstName || null, source, request_key: requestKey })
  });
  if (!consent.ok) return { ok: false, error: "Newsletter signup is temporarily unavailable." };

  const synced = await syncResendContact(env, { email, firstName });
  await supabaseFetch(
    env,
    `/rest/v1/newsletter_consents?request_key=eq.${encodeURIComponent(requestKey)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        resend_sync_status: synced.ok ? "synced" : "failed",
        resend_sync_error: synced.ok ? null : cleanText(synced.error).slice(0, 1000),
        resend_synced_at: synced.ok ? new Date().toISOString() : null
      })
    }
  );

  if (!synced.ok) return { ok: false, error: "Your signup could not be completed. Please try again." };
  return { ok: true };
}

async function syncResendContact(env, contact) {
  if (!env.RESEND_API_KEY || !env.RESEND_NEWSLETTER_SEGMENT_ID || !env.RESEND_NEWSLETTER_TOPIC_ID) {
    return { ok: false, error: "Missing newsletter Resend configuration." };
  }

  const contactBody = {
    email: contact.email,
    unsubscribed: false,
    segments: [{ id: env.RESEND_NEWSLETTER_SEGMENT_ID }],
    topics: [{ id: env.RESEND_NEWSLETTER_TOPIC_ID, subscription: "opt_in" }]
  };
  if (contact.firstName) contactBody.first_name = contact.firstName;

  const created = await resendFetch(env, "/contacts", { method: "POST", body: contactBody });
  if (created.ok) return created;

  const contactPath = `/contacts/${encodeURIComponent(contact.email)}`;
  const existing = await resendFetch(env, contactPath);
  if (!existing.ok) return created;

  const updated = await resendFetch(env, contactPath, {
    method: "PATCH",
    body: {
      unsubscribed: false,
      ...(contact.firstName ? { first_name: contact.firstName } : {})
    }
  });
  if (!updated.ok) return updated;

  const topics = await resendFetch(env, `${contactPath}/topics`, {
    method: "PATCH",
    body: { topics: [{ id: env.RESEND_NEWSLETTER_TOPIC_ID, subscription: "opt_in" }] }
  });
  if (!topics.ok) return topics;

  const segment = await resendFetch(
    env,
    `${contactPath}/segments/${encodeURIComponent(env.RESEND_NEWSLETTER_SEGMENT_ID)}`,
    { method: "POST" }
  );
  return segment.ok || segment.status === 409 ? { ok: true, status: segment.status } : segment;
}

async function resendFetch(env, path, options = {}) {
  const resp = await fetch(`https://api.resend.com${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await resp.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: resp.ok, status: resp.status, data, error: resp.ok ? null : (data?.message || data || `HTTP ${resp.status}`) };
}

async function supabaseFetch(env, path, options = {}) {
  const resp = await fetch(`${env.SUPABASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body
  });
  const text = await resp.text();
  return { ok: resp.ok, status: resp.status, error: resp.ok ? null : (text || `HTTP ${resp.status}`) };
}

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function isValidEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
