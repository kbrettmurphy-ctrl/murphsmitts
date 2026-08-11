/* Dependency-free characterization for past-customer newsletter invitations.
   Every Supabase and Resend request is mocked; no external request is permitted. */

import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { onRequest as handleInvite } from "../functions/api/newsletter-invite.js";

const migration = fs.readFileSync(new URL("../supabase/migrations/20260811173527_newsletter_invites.sql", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../newsletter/confirm/index.html", import.meta.url), "utf8");
const browserJs = fs.readFileSync(new URL("../assets/js/main.js", import.meta.url), "utf8");

const TOKEN = "a".repeat(64);
const HASH = createHash("sha256").update(TOKEN).digest("hex");
const ENV = Object.freeze({
  SUPABASE_URL: "https://supabase.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
  RESEND_API_KEY: "test-resend-key",
  RESEND_NEWSLETTER_SEGMENT_ID: "segment-123",
  RESEND_NEWSLETTER_TOPIC_ID: "topic-123",
  MURPHOS_ENV: "production"
});

let tests = 0;
let assertions = 0;
const ok = (value, message) => { assertions += 1; assert.ok(value, message); };
const equal = (actual, expected, message) => { assertions += 1; assert.equal(actual, expected, message); };

async function test(name, fn) {
  tests += 1;
  await fn();
  console.log(`  ok  ${name}`);
}

async function invoke({ method = "GET", token = TOKEN, invite = {}, fetchMock } = {}) {
  const previous = globalThis.fetch;
  const calls = [];
  const row = {
    email: "casey@example.com",
    first_name: "Casey",
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    confirmed_at: null,
    revoked_at: null,
    ...invite
  };

  globalThis.fetch = async (input, init = {}) => {
    const call = { url: String(input), init };
    calls.push(call);
    if (fetchMock) return fetchMock(call, row);
    if (call.url.includes("newsletter_invites?token_hash=eq.")) {
      if ((init.method || "GET") === "PATCH") return new Response(null, { status: 204 });
      return Response.json([row]);
    }
    throw new Error(`Unexpected fetch: ${call.url}`);
  };

  try {
    const request = new Request(
      method === "GET"
        ? `https://murphsmitts.com/api/newsletter-invite?token=${token}`
        : "https://murphsmitts.com/api/newsletter-invite",
      {
        method,
        headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body: method === "POST" ? JSON.stringify({ token }) : undefined
      }
    );
    const response = await handleInvite({ request, env: ENV });
    return { response, data: await response.json(), calls };
  } finally {
    globalThis.fetch = previous;
  }
}

await test("migration keeps invitation data server-only and accepts invitation consent", () => {
  ok(migration.includes("create table if not exists public.newsletter_invites"));
  ok(migration.includes("alter table public.newsletter_invites enable row level security"));
  ok(migration.includes("revoke all on table public.newsletter_invites from anon, authenticated"));
  ok(migration.includes("'customer_invitation'"));
});

await test("page requires an explicit confirmation click", () => {
  ok(page.includes("data-invite-confirm"));
  ok(browserJs.includes('button?.addEventListener("click"'));
  ok(browserJs.includes('method: "POST"'));
  equal((browserJs.match(/\/api\/newsletter-invite/g) || []).length, 2);
});

await test("opening a valid link only returns masked display data", async () => {
  const result = await invoke();
  equal(result.data.ok, true);
  equal(result.data.state, "ready");
  equal(result.data.firstName, "Casey");
  equal(result.data.maskedEmail, "c****@example.com");
  equal(JSON.stringify(result.data).includes("casey@example.com"), false);
  equal(result.calls.length, 1);
  ok(result.calls[0].url.includes(HASH));
  equal(result.calls[0].url.includes(TOKEN), false);
});

await test("expired invitations fail before consent or Resend calls", async () => {
  const result = await invoke({ invite: { expires_at: new Date(Date.now() - 1000).toISOString() } });
  equal(result.data.ok, false);
  equal(result.calls.length, 1);
});

await test("confirmation records invitation consent, opts into Resend, and marks the invite", async () => {
  const result = await invoke({
    method: "POST",
    fetchMock: (call, row) => {
      const method = call.init.method || "GET";
      if (call.url.includes("newsletter_invites?token_hash=eq.") && method === "GET") return Response.json([row]);
      if (call.url.includes("newsletter_consents?on_conflict=request_key")) return new Response(null, { status: 201 });
      if (call.url === "https://api.resend.com/contacts") return Response.json({ id: "contact-1" });
      if (call.url.includes("newsletter_consents?request_key=eq.")) return new Response(null, { status: 204 });
      if (call.url.includes("newsletter_invites?token_hash=eq.") && method === "PATCH") return new Response(null, { status: 204 });
      throw new Error(`Unexpected fetch: ${call.url}`);
    }
  });

  equal(result.data.ok, true);
  equal(result.data.state, "confirmed");
  const consentCall = result.calls.find(call => call.url.includes("newsletter_consents?on_conflict=request_key"));
  const consent = JSON.parse(consentCall.init.body);
  equal(consent.source, "customer_invitation");
  equal(consent.request_key, `invite:${HASH}`);
  const resendCall = result.calls.find(call => call.url === "https://api.resend.com/contacts");
  const contact = JSON.parse(resendCall.init.body);
  equal(contact.topics[0].subscription, "opt_in");
  equal(contact.segments[0].id, "segment-123");
  ok(result.calls.some(call => call.url.includes("confirmed_at=is.null") && call.init.method === "PATCH"));
});

await test("an already-confirmed invitation is idempotent", async () => {
  const result = await invoke({ method: "POST", invite: { confirmed_at: new Date().toISOString() } });
  equal(result.data.ok, true);
  equal(result.data.state, "confirmed");
  equal(result.calls.length, 1);
});

await test("malformed tokens are rejected without database calls", async () => {
  const result = await invoke({ token: "not-a-token" });
  equal(result.data.ok, false);
  equal(result.calls.length, 0);
});

console.log(`newsletter invitation self-test: ${tests} tests, ${assertions} assertions`);
