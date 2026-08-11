import { subscribeNewsletter } from "./_newsletter.js";

export async function onRequest(context) {
  const { request, env } = context;
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

  if (request.method !== "POST") {
    return response({ ok: false, error: `Method not allowed: ${request.method}` }, 405, headers);
  }

  try {
    const body = await request.json();
    if (String(body.website || "").trim()) return response({ ok: true }, 200, headers);

    const startedAt = Number(body.startedAt || 0);
    if (!startedAt || Date.now() - startedAt < 1500) {
      return response({ ok: false, error: "Please wait a moment and try again." }, 200, headers);
    }

    const result = await subscribeNewsletter(env, {
      email: body.email,
      firstName: body.firstName,
      source: body.source,
      requestKey: body.requestKey
    });
    return response(result, 200, headers);
  } catch (error) {
    console.error("Newsletter signup failed", error);
    return response({ ok: false, error: "Newsletter signup is temporarily unavailable." }, 500, headers);
  }
}

function response(payload, status, headers) {
  return new Response(JSON.stringify(payload), { status, headers });
}
