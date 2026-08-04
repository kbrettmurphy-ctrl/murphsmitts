/* Dependency-free Phase 2 characterization for reliable public intake and
   authenticated Twilio media handling. No external request is permitted. */

import assert from "node:assert/strict";
import fs from "node:fs";
import { createHmac, webcrypto } from "node:crypto";
import { onRequest as handleIntake } from "../functions/api/intake.js";
import { onRequest as handleSmsReply } from "../functions/api/sms-reply.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const migration = fs.readFileSync(new URL("../supabase/migrations/20260804120000_reliable_intake.sql", import.meta.url), "utf8");
const contact = fs.readFileSync(new URL("../contact/index.html", import.meta.url), "utf8");

const INTAKE_ENV = Object.freeze({
  SUPABASE_URL: "https://supabase.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
  RESEND_API_KEY: "test-resend-key",
  TWILIO_ACCOUNT_SID: "AC123",
  TWILIO_AUTH_TOKEN: "test-auth-token",
  TWILIO_MESSAGING_SERVICE_SID: "MG123",
  MURPHOS_ENV: "preview"
});

const SMS_ENV = Object.freeze({
  SUPABASE_URL: "https://supabase.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
  TWILIO_ACCOUNT_SID: "AC123",
  TWILIO_AUTH_TOKEN: "test-auth-token"
});

const INTAKE_KEY = "2f6bd9f4-8079-4cf6-a451-d583b33d4247";
const BASE_PAYLOAD = Object.freeze({
  customerName: "Test Customer",
  emailAddress: "customer@example.com",
  phoneNumber: "9105550100",
  smsOptIn: false,
  dropOffMethod: "Local Drop-Off",
  turnaroundAcknowledged: "I understand",
  gloves: [{
    brandModel: "Rawlings HOH",
    gloveType: "Fielders Glove",
    webType: "I-Web",
    servicesRequested: "Relacing",
    primaryLaceColor: "Tan"
  }]
});

const BASE_ROW = Object.freeze({
  id: "10000000-0000-4000-8000-000000000001",
  timestamp_submitted: "2026-08-04T12:00:00.000Z",
  tracking_token: "a".repeat(64),
  customer_name: "Test Customer",
  phone_number: "9105550100",
  email_address: "customer@example.com",
  brand_model: "Rawlings HOH",
  glove_type: "Fielders Glove",
  web_type: "I-Web",
  services_requested: "Relacing",
  primary_lace_color: "Tan",
  drop_off_method: "Local Drop-Off",
  glove_photos: [],
  order_number: "0201",
  status: "Received",
  paid: "Unpaid",
  allow_ship_without_payment: false,
  sms_opt_in: false
});

let tests = 0;
let assertions = 0;
const ok = (value, message) => { assertions += 1; assert.ok(value, message); };
const equal = (actual, expected, message) => { assertions += 1; assert.equal(actual, expected, message); };
const deepEqual = (actual, expected, message) => { assertions += 1; assert.deepEqual(actual, expected, message); };

async function test(name, fn) {
  tests += 1;
  await fn();
  console.log(`  ok  ${name}`);
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

async function withFetchMock(fetchMock, fn) {
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const call = { url: String(input), init };
    calls.push(call);
    return await fetchMock(call, calls.length);
  };
  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = previous;
  }
}

async function invokeIntake({
  payload = BASE_PAYLOAD,
  key = INTAKE_KEY,
  env = INTAKE_ENV,
  fetchMock
} = {}) {
  return await withFetchMock(fetchMock, async calls => {
    const request = new Request("https://murphsmitts.com/api/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify({ ...payload, idempotencyKey: key })
    });
    const response = await handleIntake({ request, env });
    const data = await response.json();
    return { response, data, calls: calls.slice() };
  });
}

function expectedTwilioSignature(url, params, authToken = SMS_ENV.TWILIO_AUTH_TOKEN) {
  let value = url;
  for (const name of Object.keys(params).sort()) {
    const raw = Array.isArray(params[name]) ? params[name] : [params[name]];
    for (const item of Array.from(new Set(raw.map(String))).sort()) value += `${name}${item}`;
  }
  return createHmac("sha1", authToken).update(value, "utf8").digest("base64");
}

async function invokeSms({ params, signature, fetchMock, env = SMS_ENV }) {
  const url = "https://murphsmitts.com/api/sms-reply";
  const form = new URLSearchParams();
  for (const [name, raw] of Object.entries(params)) {
    for (const value of Array.isArray(raw) ? raw : [raw]) form.append(name, String(value));
  }
  return await withFetchMock(fetchMock, async calls => {
    const request = new Request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Twilio-Signature": signature ?? expectedTwilioSignature(url, params, env.TWILIO_AUTH_TOKEN)
      },
      body: form.toString()
    });
    const response = await handleSmsReply({ request, env });
    return { response, text: await response.text(), calls: calls.slice() };
  });
}

await test("migration serializes concurrent allocation and records idempotency", () => {
  ok(migration.includes("create table if not exists public.intake_submissions"));
  ok(migration.includes("create or replace function public.create_intake_orders"));
  ok(migration.includes("pg_advisory_xact_lock"));
  ok(migration.includes("murphos_intake_order_numbers"));
  ok(migration.includes("for update"));
  ok(migration.includes("v_next_number + v_index"));
  ok(migration.indexOf("insert into public.orders") < migration.indexOf("insert into public.intake_submissions"));
  ok(migration.includes("idempotency_key_reused"));
});

await test("public form preserves one retry key until success", () => {
  ok(contact.includes('let pendingIntakeKey = "";'));
  ok(contact.includes("pendingIntakeFingerprint !== fingerprint"));
  ok(contact.includes('"Idempotency-Key": idempotencyKey'));
  ok(contact.includes("payload.idempotencyKey = idempotencyKey"));
  ok(contact.includes('pendingIntakeKey = "";'));
  ok(contact.includes("data.partialSuccess && data.warning"));
});

await test("intake uses the RPC and never performs max-plus-one in the Function", async () => {
  const result = await invokeIntake({
    fetchMock: (call) => {
      if (call.url.endsWith("/rest/v1/rpc/create_intake_orders")) {
        const body = JSON.parse(call.init.body);
        equal(body.p_idempotency_key, INTAKE_KEY);
        equal(body.p_orders.length, 1);
        equal(body.p_orders[0].order_number, undefined);
        equal(body.p_request_hash.length, 64);
        return jsonResponse({ ok: true, replayed: false, orders: [BASE_ROW], notificationResult: null });
      }
      if (call.url.includes("/rest/v1/orders?order_number=eq.0201")) {
        return jsonResponse([{ ...BASE_ROW, last_status_emailed: "Received" }]);
      }
      if (call.url.includes("/rest/v1/intake_submissions?")) return new Response(null, { status: 204 });
      throw new Error(`Unexpected fetch: ${call.url}`);
    }
  });
  equal(result.data.ok, true);
  equal(result.data.partialSuccess, false);
  equal(result.data.order.orderNumber, "0201");
  equal(result.calls.some(call => call.url.includes("select=order_number")), false);
});

await test("a replay returns the original orders without resending notifications", async () => {
  const saved = { partialSuccess: false, warning: null, deliveries: [{ orderNumber: "0201" }], failures: [] };
  const result = await invokeIntake({
    fetchMock: (call) => {
      equal(call.url.endsWith("/rest/v1/rpc/create_intake_orders"), true);
      return jsonResponse({ ok: true, replayed: true, orders: [BASE_ROW], notificationResult: saved });
    }
  });
  equal(result.calls.length, 1);
  equal(result.data.ok, true);
  equal(result.data.replayed, true);
  deepEqual(result.data.failures, []);
});

await test("notification failures are explicit success, not a duplicate-inducing error", async () => {
  const productionEnv = {
    ...INTAKE_ENV,
    MURPHOS_ENV: "production",
    OWNER_NOTIFICATION_EMAIL: "owner@example.com"
  };
  const result = await invokeIntake({
    env: productionEnv,
    fetchMock: (call) => {
      if (call.url.endsWith("/rest/v1/rpc/create_intake_orders")) {
        return jsonResponse({ ok: true, replayed: false, orders: [BASE_ROW], notificationResult: null });
      }
      if (call.url === "https://api.resend.com/emails") return jsonResponse({ message: "provider unavailable" }, 503);
      if (call.url.includes("/rest/v1/intake_submissions?")) return new Response(null, { status: 204 });
      throw new Error(`Unexpected fetch: ${call.url}`);
    }
  });
  equal(result.data.ok, true);
  equal(result.data.partialSuccess, true);
  ok(result.data.warning.includes("do not submit it again"));
  deepEqual(result.data.failures.map(item => item.channel), ["customer_email", "owner_email"]);
});

await test("invalid Twilio signatures fail before database or media access", async () => {
  const result = await invokeSms({
    params: { From: "+19105550100", Body: "YES", NumMedia: "0" },
    signature: "not-a-valid-signature",
    fetchMock: call => { throw new Error(`Unexpected fetch: ${call.url}`); }
  });
  equal(result.response.status, 403);
  equal(result.calls.length, 0);
  ok(result.text.includes("Invalid signature."));
});

await test("valid signed messages may reach the database", async () => {
  const result = await invokeSms({
    params: { From: "+19105550100", Body: "Hello", NumMedia: "0" },
    fetchMock: (call) => {
      if (call.url.includes("/rest/v1/orders?select=*")) return jsonResponse([]);
      if (call.url.endsWith("/rest/v1/sms_messages")) return new Response("", { status: 201 });
      throw new Error(`Unexpected fetch: ${call.url}`);
    }
  });
  equal(result.response.status, 200);
  equal(result.calls.length, 2);
});

await test("signed Twilio media downloads use Basic auth and trusted hosts", async () => {
  const mediaUrl = "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/SM1/Media/ME1";
  const result = await invokeSms({
    params: {
      From: "+19105550100",
      Body: "",
      NumMedia: "1",
      MediaUrl0: mediaUrl,
      MediaContentType0: "image/jpeg"
    },
    fetchMock: (call) => {
      if (call.url.includes("/rest/v1/orders?select=*")) return jsonResponse([]);
      if (call.url === mediaUrl) {
        equal(call.init.headers.Authorization, `Basic ${Buffer.from("AC123:test-auth-token").toString("base64")}`);
        return new Response(Uint8Array.from([1, 2, 3]), { status: 200 });
      }
      if (call.url.includes("/storage/v1/object/order-photos/")) return new Response("", { status: 200 });
      if (call.url.endsWith("/rest/v1/sms_messages")) return new Response("", { status: 201 });
      throw new Error(`Unexpected fetch: ${call.url}`);
    }
  });
  equal(result.response.status, 200);
  equal(result.calls.some(call => call.url === mediaUrl), true);
});

await test("oversized Twilio media is not buffered or uploaded", async () => {
  const mediaUrl = "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/SM1/Media/ME2";
  const result = await invokeSms({
    params: {
      From: "+19105550100",
      Body: "large photo",
      NumMedia: "1",
      MediaUrl0: mediaUrl,
      MediaContentType0: "image/jpeg"
    },
    fetchMock: (call) => {
      if (call.url.includes("/rest/v1/orders?select=*")) return jsonResponse([]);
      if (call.url === mediaUrl) {
        return new Response(Uint8Array.from([1]), {
          status: 200,
          headers: { "Content-Length": String(10 * 1024 * 1024 + 1) }
        });
      }
      if (call.url.endsWith("/rest/v1/sms_messages")) return new Response("", { status: 201 });
      throw new Error(`Unexpected fetch: ${call.url}`);
    }
  });
  equal(result.response.status, 200);
  equal(result.calls.some(call => call.url === mediaUrl), true);
  equal(result.calls.some(call => call.url.includes("/storage/v1/object/order-photos/")), false);
});

await test("signed untrusted media URLs never receive Twilio credentials", async () => {
  const untrusted = "https://attacker.invalid/media.jpg";
  const result = await invokeSms({
    params: {
      From: "+19105550100",
      Body: "photo",
      NumMedia: "1",
      MediaUrl0: untrusted,
      MediaContentType0: "image/jpeg"
    },
    fetchMock: (call) => {
      if (call.url.includes("/rest/v1/orders?select=*")) return jsonResponse([]);
      if (call.url.endsWith("/rest/v1/sms_messages")) return new Response("", { status: 201 });
      throw new Error(`Unexpected fetch: ${call.url}`);
    }
  });
  equal(result.response.status, 200);
  equal(result.calls.some(call => call.url === untrusted), false);
});

console.log(`\nReliable intake self-test: ${tests} tests, ${assertions} assertions passed.`);
