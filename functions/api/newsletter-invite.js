import { subscribeNewsletter } from "./_newsletter.js";

const TOKEN_PATTERN = /^[0-9a-f]{64}$/i;
const RESPONSE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer"
};

export async function onRequest({ request, env }) {
  if (request.method !== "GET" && request.method !== "POST") {
    return json({ ok: false, error: `Method not allowed: ${request.method}` }, 405);
  }

  try {
    const token = request.method === "GET"
      ? new URL(request.url).searchParams.get("token")
      : (await request.json()).token;

    if (!TOKEN_PATTERN.test(String(token || ""))) return invalidInvite();
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return unavailable();

    const tokenHash = await sha256(String(token).toLowerCase());
    const inviteResult = await supabaseJson(
      env,
      `/rest/v1/newsletter_invites?token_hash=eq.${tokenHash}&select=email,first_name,expires_at,confirmed_at,revoked_at&limit=1`
    );
    if (!inviteResult.ok) return unavailable();

    const invite = Array.isArray(inviteResult.data) ? inviteResult.data[0] : null;
    if (!invite || invite.revoked_at || new Date(invite.expires_at).getTime() <= Date.now()) {
      return invalidInvite();
    }

    const safeInvite = {
      firstName: cleanText(invite.first_name),
      maskedEmail: maskEmail(invite.email)
    };

    if (invite.confirmed_at) {
      return json({ ok: true, state: "confirmed", ...safeInvite }, 200);
    }

    if (request.method === "GET") {
      return json({ ok: true, state: "ready", ...safeInvite }, 200);
    }

    const subscribed = await subscribeNewsletter(env, {
      email: invite.email,
      firstName: invite.first_name,
      source: "customer_invitation",
      requestKey: `invite:${tokenHash}`
    });
    if (!subscribed.ok) return json(subscribed, 200);
    if (subscribed.suppressed) return json(subscribed, 200);

    const confirmed = await supabaseJson(
      env,
      `/rest/v1/newsletter_invites?token_hash=eq.${tokenHash}&confirmed_at=is.null`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ confirmed_at: new Date().toISOString() })
      }
    );
    if (!confirmed.ok) return unavailable();

    return json({ ok: true, state: "confirmed", ...safeInvite }, 200);
  } catch (error) {
    console.error("Newsletter invitation confirmation failed", error);
    return unavailable();
  }
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function supabaseJson(env, path, options = {}) {
  const response = await fetch(`${env.SUPABASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    body: options.body
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: response.ok, status: response.status, data };
}

function maskEmail(value) {
  const email = cleanText(value).toLowerCase();
  const at = email.indexOf("@");
  if (at < 1) return "your email address";
  return `${email[0]}${"*".repeat(Math.min(Math.max(at - 1, 3), 7))}${email.slice(at)}`;
}

function cleanText(value) {
  return String(value || "").trim();
}

function invalidInvite() {
  return json({ ok: false, error: "This invitation link is invalid or has expired." }, 200);
}

function unavailable() {
  return json({ ok: false, error: "Newsletter signup is temporarily unavailable." }, 500);
}

function json(payload, status) {
  return new Response(JSON.stringify(payload), { status, headers: RESPONSE_HEADERS });
}
