/* Dependency-free characterization for public newsletter signup. No external
   request is permitted; every provider request is mocked. */

import assert from "node:assert/strict";
import fs from "node:fs";
import { onRequest as handleNewsletter } from "../functions/api/newsletter.js";

const migration = fs.readFileSync(new URL("../supabase/migrations/20260811151446_newsletter_consents.sql", import.meta.url), "utf8");
const homepage = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const footer = fs.readFileSync(new URL("../_includes/footer.html", import.meta.url), "utf8");
const contact = fs.readFileSync(new URL("../contact/index.html", import.meta.url), "utf8");

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

async function invoke({ env = ENV, body = {}, fetchMock }) {
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const call = { url: String(input), init };
    calls.push(call);
    return fetchMock ? fetchMock(call) : new Response(null, { status: 204 });
  };
  try {
    const request = new Request("https://murphsmitts.com/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "Fan@Example.com",
        firstName: "Casey",
        source: "homepage",
        requestKey: "newsletter-test-1",
        startedAt: Date.now() - 3000,
        ...body
      })
    });
    const response = await handleNewsletter({ request, env });
    return { response, data: await response.json(), calls };
  } finally {
    globalThis.fetch = previous;
  }
}

await test("all three explicit opt-in surfaces are present", () => {
  ok(homepage.includes('data-newsletter-source="homepage"'));
  ok(footer.includes('data-newsletter-source="footer"'));
  ok(contact.includes('name="newsletterOptIn" type="checkbox"'));
  ok(contact.includes("newsletterOptIn: !!form.newsletterOptIn?.checked"));
});

await test("consent storage is server-only and records sync state", () => {
  ok(migration.includes("alter table public.newsletter_consents enable row level security"));
  ok(migration.includes("revoke all on table public.newsletter_consents from anon, authenticated"));
  ok(migration.includes("request_key text not null unique"));
  ok(migration.includes("resend_sync_status"));
});

await test("production signup records consent and creates an opted-in Resend contact", async () => {
  const result = await invoke({
    fetchMock: (call) => {
      if (call.url.includes("newsletter_consents?on_conflict=request_key")) return new Response(null, { status: 201 });
      if (call.url === "https://api.resend.com/contacts") return new Response(JSON.stringify({ id: "contact-1" }), { status: 200 });
      if (call.url.includes("newsletter_consents?request_key=eq.")) return new Response(null, { status: 204 });
      throw new Error(`Unexpected fetch: ${call.url}`);
    }
  });
  equal(result.data.ok, true);
  const create = result.calls.find(call => call.url === "https://api.resend.com/contacts");
  const body = JSON.parse(create.init.body);
  equal(body.email, "fan@example.com");
  equal(body.topics[0].subscription, "opt_in");
  equal(body.segments[0].id, "segment-123");
});

await test("preview signup is successful but makes no provider calls", async () => {
  const result = await invoke({ env: { ...ENV, MURPHOS_ENV: "preview" } });
  equal(result.data.ok, true);
  equal(result.data.suppressed, true);
  equal(result.calls.length, 0);
});

await test("honeypot submission is quietly accepted without provider calls", async () => {
  const result = await invoke({ body: { website: "bot.example" } });
  equal(result.data.ok, true);
  equal(result.calls.length, 0);
});

console.log(`newsletter self-test: ${tests} tests, ${assertions} assertions`);
