/* Dependency-free characterization tests for functions/api/orders.js.
   Run: node scripts/action-dispatch-selftest.mjs

   These tests call the production onRequest export with Fetch API Request
   objects and a fail-closed fetch mock. No external request is permitted. */

import assert from "node:assert/strict";
import fs from "node:fs";
import { webcrypto } from "node:crypto";
import { onRequest } from "../functions/api/orders.js";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const CORE_ENV = Object.freeze({
  SUPABASE_URL: "https://supabase.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  ADMIN_PIN: "123456",
  ADMIN_SESSION_SECRET: "characterization-secret"
});

const JSON_HEADERS = Object.freeze({
  contentType: "application/json; charset=utf-8",
  cacheControl: "no-store"
});

let testCount = 0;
let assertionCount = 0;
let fetchCalls = [];

function equal(actual, expected, message) {
  assertionCount += 1;
  assert.equal(actual, expected, message);
}

function deepEqual(actual, expected, message) {
  assertionCount += 1;
  assert.deepEqual(actual, expected, message);
}

function ok(value, message) {
  assertionCount += 1;
  assert.ok(value, message);
}

async function test(name, fn) {
  testCount += 1;
  try {
    await fn();
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`FAIL  ${name}`);
    throw error;
  }
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function noNetworkFetch(input) {
  throw new Error(`Unexpected external fetch: ${String(input)}`);
}

async function invoke({
  method = "POST",
  body,
  rawBody,
  env = CORE_ENV,
  fetchMock = noNetworkFetch
} = {}) {
  const previousFetch = globalThis.fetch;
  fetchCalls = [];
  globalThis.fetch = async (input, init = {}) => {
    fetchCalls.push({ url: String(input), init });
    return fetchMock(input, init, fetchCalls.length);
  };

  try {
    const init = { method };
    if (rawBody !== undefined) init.body = rawBody;
    else if (body !== undefined) init.body = JSON.stringify(body);
    if (init.body !== undefined) init.headers = { "Content-Type": "application/json" };

    const request = new Request("https://murphsmitts.com/api/orders", init);
    const response = await onRequest({ request, env });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = undefined;
    }
    return { response, text, json, fetchCalls: fetchCalls.slice() };
  } finally {
    globalThis.fetch = previousFetch;
  }
}

function assertJsonHeaders(response) {
  equal(response.headers.get("content-type"), JSON_HEADERS.contentType, "content type");
  equal(response.headers.get("cache-control"), JSON_HEADERS.cacheControl, "cache control");
}

function base64Url(bytes) {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function signedToken(payload, secret = CORE_ENV.ADMIN_SESSION_SECRET) {
  const payloadBase64 = base64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadBase64)
  );
  return `${payloadBase64}.${base64Url(new Uint8Array(signature))}`;
}

async function sessionTokens() {
  const future = Date.now() + 60_000;
  return {
    owner: await signedToken({ sub: "owner", role: "admin", exp: future }),
    admin: await signedToken({
      sub: "user-admin",
      email: "admin@example.com",
      role: "admin",
      exp: future
    }),
    demo: await signedToken({
      sub: "user-demo",
      email: "demo@example.com",
      role: "demo",
      exp: future
    }),
    expired: await signedToken({ sub: "owner", role: "admin", exp: Date.now() - 1_000 })
  };
}

function emptySupabaseFetch() {
  return jsonResponse([]);
}

async function assertDemoDenied(action, token, extra = {}) {
  const result = await invoke({ body: { action, _token: token, ...extra } });
  equal(result.response.status, 200, `${action} demo status`);
  deepEqual(result.json, {
    ok: false,
    error: "Demo mode: that action runs in your sandbox only.",
    demo: true
  }, `${action} demo body`);
  equal(result.fetchCalls.length, 0, `${action} denied before I/O`);
}

console.log("Transport and environment");

await test("GET health response", async () => {
  const result = await invoke({ method: "GET", env: {} });
  equal(result.response.status, 200);
  deepEqual(result.json, { ok: true, message: "admin-api is alive" });
  assertJsonHeaders(result.response);
  equal(result.fetchCalls.length, 0);
});

await test("unsupported method response", async () => {
  const result = await invoke({ method: "PUT", env: {} });
  equal(result.response.status, 405);
  deepEqual(result.json, { ok: false, error: "Method not allowed: PUT" });
  assertJsonHeaders(result.response);
  equal(result.fetchCalls.length, 0);
});

await test("malformed JSON fails before binding validation", async () => {
  const result = await invoke({ rawBody: "{", env: {} });
  equal(result.response.status, 500);
  equal(result.json?.ok, false);
  equal(typeof result.json?.error, "string");
  ok(result.json.error.length > 0);
  deepEqual(Object.keys(result.json).sort(), ["error", "ok"]);
  assertJsonHeaders(result.response);
  equal(result.fetchCalls.length, 0);
});

await test("Supabase binding validation is first", async () => {
  const none = await invoke({ body: { action: "login" }, env: {} });
  equal(none.response.status, 500);
  deepEqual(none.json, {
    ok: false,
    error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable."
  });

  const urlOnly = await invoke({
    body: { action: "login" },
    env: { SUPABASE_URL: CORE_ENV.SUPABASE_URL }
  });
  equal(urlOnly.response.status, 500);
  deepEqual(urlOnly.json, none.json);
  assertJsonHeaders(urlOnly.response);
});

await test("ADMIN_PIN validation follows Supabase validation", async () => {
  const env = {
    SUPABASE_URL: CORE_ENV.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: CORE_ENV.SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_SESSION_SECRET: CORE_ENV.ADMIN_SESSION_SECRET
  };
  const result = await invoke({ body: { action: "login" }, env });
  equal(result.response.status, 500);
  deepEqual(result.json, {
    ok: false,
    error: "Missing ADMIN_PIN or ADMIN_SESSION_SECRET environment variable."
  });
  assertJsonHeaders(result.response);
});

await test("ADMIN_SESSION_SECRET uses the same second preflight", async () => {
  const env = {
    SUPABASE_URL: CORE_ENV.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: CORE_ENV.SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_PIN: CORE_ENV.ADMIN_PIN
  };
  const result = await invoke({ body: { action: "login" }, env });
  equal(result.response.status, 500);
  deepEqual(result.json, {
    ok: false,
    error: "Missing ADMIN_PIN or ADMIN_SESSION_SECRET environment variable."
  });
  assertJsonHeaders(result.response);
});

console.log("Unknown actions and session validation");

await test("unknown action", async () => {
  const result = await invoke({ body: { action: "doesNotExist" } });
  equal(result.response.status, 200);
  deepEqual(result.json, { ok: false, error: "Unknown action: doesNotExist" });
  assertJsonHeaders(result.response);
  equal(result.fetchCalls.length, 0);
});

await test("blank and whitespace actions", async () => {
  for (const action of [undefined, "", "   "]) {
    const body = action === undefined ? {} : { action };
    const result = await invoke({ body });
    equal(result.response.status, 200);
    deepEqual(result.json, { ok: false, error: "Unknown action: [none]" });
    equal(result.fetchCalls.length, 0);
  }
});

await test("missing session token", async () => {
  const result = await invoke({ body: { action: "listOrders" } });
  equal(result.response.status, 200);
  deepEqual(result.json, { ok: false, error: "Missing session token." });
  assertJsonHeaders(result.response);
  equal(result.fetchCalls.length, 0);
});

await test("malformed session token", async () => {
  const result = await invoke({ body: { action: "listOrders", _token: "not-a-token" } });
  equal(result.response.status, 200);
  deepEqual(result.json, { ok: false, error: "Invalid session token." });
  equal(result.fetchCalls.length, 0);
});

await test("invalid session signature", async () => {
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    sub: "owner",
    role: "admin",
    exp: Date.now() + 60_000
  })));
  const result = await invoke({
    body: { action: "listOrders", _token: `${payload}.invalid-signature` }
  });
  equal(result.response.status, 200);
  deepEqual(result.json, { ok: false, error: "Invalid session token." });
  equal(result.fetchCalls.length, 0);
});

await test("expired signed session token", async () => {
  const { expired } = await sessionTokens();
  const result = await invoke({ body: { action: "listOrders", _token: expired } });
  equal(result.response.status, 200);
  deepEqual(result.json, { ok: false, error: "Session expired." });
  equal(result.fetchCalls.length, 0);
});

await test("valid admin session reaches listOrders", async () => {
  const { admin } = await sessionTokens();
  const result = await invoke({
    body: { action: "listOrders", _token: admin },
    fetchMock: emptySupabaseFetch
  });
  equal(result.response.status, 200);
  deepEqual(result.json, { ok: true, orders: [] });
  equal(result.fetchCalls.length, 1);
  ok(result.fetchCalls[0].url.includes("/rest/v1/orders?select=*"));
});

await test("valid demo session is globally denied", async () => {
  const { demo } = await sessionTokens();
  await assertDemoDenied("listOrders", demo);
});

console.log("Demo allowlist and public/demo policy");

await test("demo-allowed login bypasses global denial", async () => {
  const { demo } = await sessionTokens();
  const result = await invoke({ body: { action: "login", _token: demo } });
  deepEqual(result.json, { ok: false, error: "Enter your email and password." });
  equal(result.fetchCalls.length, 0);
});

await test("demo-allowed getInvite bypasses global denial", async () => {
  const { demo } = await sessionTokens();
  const result = await invoke({ body: { action: "getInvite", _token: demo } });
  deepEqual(result.json, { ok: false, error: "This invite is invalid or already used." });
  equal(result.fetchCalls.length, 0);
});

await test("demo-allowed acceptInvite bypasses global denial", async () => {
  const { demo } = await sessionTokens();
  const result = await invoke({ body: { action: "acceptInvite", _token: demo } });
  deepEqual(result.json, { ok: false, error: "Password must be at least 8 characters." });
  equal(result.fetchCalls.length, 0);
});

await test("demo-allowed webauthnLoginOptions bypasses global denial", async () => {
  const { demo } = await sessionTokens();
  const result = await invoke({
    body: { action: "webauthnLoginOptions", _token: demo },
    fetchMock: emptySupabaseFetch
  });
  equal(result.response.status, 200);
  equal(result.json?.ok, true);
  equal(result.json?.hasCredentials, false);
  equal(result.json?.options?.rpId, "murphsmitts.com");
  deepEqual(result.json?.options?.allowCredentials, []);
  equal(typeof result.json?.challengeToken, "string");
  equal(result.fetchCalls.length, 1);
});

await test("demo-allowed webauthnLoginVerify bypasses global denial", async () => {
  const { demo } = await sessionTokens();
  const result = await invoke({
    body: { action: "webauthnLoginVerify", _token: demo }
  });
  deepEqual(result.json, { ok: false, error: "Invalid passkey challenge." });
  equal(result.fetchCalls.length, 0);
});

await test("getPushPublicKey allows anonymous but denies demo token", async () => {
  const anonymous = await invoke({ body: { action: "getPushPublicKey" } });
  equal(anonymous.response.status, 200);
  deepEqual(anonymous.json, { ok: true, publicKey: "" });
  equal(anonymous.fetchCalls.length, 0);

  const { demo } = await sessionTokens();
  await assertDemoDenied("getPushPublicKey", demo);
});

await test("searchPublicGloves allows anonymous but denies demo token", async () => {
  const anonymous = await invoke({ body: { action: "searchPublicGloves", q: "a" } });
  equal(anonymous.response.status, 200);
  deepEqual(anonymous.json, { ok: true, gloves: [] });
  equal(anonymous.fetchCalls.length, 0);

  const { demo } = await sessionTokens();
  await assertDemoDenied("searchPublicGloves", demo, { q: "a" });
});

console.log("Conditional gallery authentication");

async function visibleGallery(body) {
  return invoke({ body, fetchMock: emptySupabaseFetch });
}

function assertEmptyVisibleGallery(result, { includeHidden = false } = {}) {
  const emptySections = {
    "fielding-gloves": [],
    "catchers-mitts": [],
    "first-base-mitts": [],
    "custom-color-relaces": [],
    vintage: []
  };
  equal(result.response.status, 200);
  equal(result.json?.ok, true);
  deepEqual(result.json?.gallery, emptySections);
  deepEqual(result.json?.photoLinks, {});
  deepEqual(result.json?.photoCovers, {});
  deepEqual(result.json?.photoGloveMeta, {});
  deepEqual(result.json?.hiddenGallery, includeHidden ? emptySections : {});
  assertJsonHeaders(result.response);
}

await test("listGalleryPhotos without includeHidden is public", async () => {
  const result = await visibleGallery({ action: "listGalleryPhotos" });
  assertEmptyVisibleGallery(result);
  equal(result.fetchCalls.length, 6);
});

await test("listGalleryPhotos includeHidden false is public", async () => {
  const result = await visibleGallery({ action: "listGalleryPhotos", includeHidden: false });
  assertEmptyVisibleGallery(result);
  equal(result.fetchCalls.length, 6);
});

await test("listGalleryPhotos hidden without token fails before I/O", async () => {
  const result = await invoke({
    body: { action: "listGalleryPhotos", includeHidden: true }
  });
  equal(result.response.status, 200);
  deepEqual(result.json, { ok: false, error: "Missing session token." });
  equal(result.fetchCalls.length, 0);
});

await test("listGalleryPhotos hidden with invalid token fails before I/O", async () => {
  const result = await invoke({
    body: { action: "listGalleryPhotos", includeHidden: true, _token: "bad" }
  });
  equal(result.response.status, 200);
  deepEqual(result.json, { ok: false, error: "Invalid session token." });
  equal(result.fetchCalls.length, 0);
});

await test("listGalleryPhotos hidden with valid session succeeds", async () => {
  const { admin } = await sessionTokens();
  const result = await visibleGallery({
    action: "listGalleryPhotos",
    includeHidden: true,
    _token: admin
  });
  assertEmptyVisibleGallery(result, { includeHidden: true });
  equal(result.fetchCalls.length, 11);
});

await test("listGalleryPhotos valid demo token is denied for public and hidden modes", async () => {
  const { demo } = await sessionTokens();
  await assertDemoDenied("listGalleryPhotos", demo);
  await assertDemoDenied("listGalleryPhotos", demo, { includeHidden: false });
  await assertDemoDenied("listGalleryPhotos", demo, { includeHidden: true });
});

console.log("Owner and admin resolution semantics");

await test("owner escape-hatch token is admin without user resolution", async () => {
  const { owner } = await sessionTokens();
  const result = await invoke({
    body: { action: "listUsers", _token: owner },
    fetchMock: emptySupabaseFetch
  });
  equal(result.response.status, 200);
  deepEqual(result.json, { ok: true, users: [] });
  equal(result.fetchCalls.length, 1);
  ok(result.fetchCalls[0].url.includes("/rest/v1/admin_users?select=*&order=created_at.asc"));
});

await test("ordinary admin session resolves active current admin", async () => {
  const { admin } = await sessionTokens();
  const result = await invoke({
    body: { action: "listUsers", _token: admin },
    fetchMock(input) {
      const url = String(input);
      if (url.includes("email=eq.admin%40example.com")) {
        return jsonResponse([{
          id: "user-admin",
          email: "admin@example.com",
          display_name: "Admin",
          role: "admin",
          active: true
        }]);
      }
      if (url.includes("/rest/v1/admin_users?select=*&order=created_at.asc")) {
        return jsonResponse([]);
      }
      return noNetworkFetch(input);
    }
  });
  equal(result.response.status, 200);
  deepEqual(result.json, { ok: true, users: [] });
  equal(result.fetchCalls.length, 2);
});

await test("ordinary admin token is rejected when account is inactive", async () => {
  const { admin } = await sessionTokens();
  const result = await invoke({
    body: { action: "listUsers", _token: admin },
    fetchMock: () => jsonResponse([{
      id: "user-admin",
      email: "admin@example.com",
      role: "admin",
      active: false
    }])
  });
  equal(result.response.status, 200);
  deepEqual(result.json, { ok: false, error: "Admins only." });
  equal(result.fetchCalls.length, 1);
});

await test("current database role overrides ordinary token role", async () => {
  const { admin } = await sessionTokens();
  const result = await invoke({
    body: { action: "listUsers", _token: admin },
    fetchMock: () => jsonResponse([{
      id: "user-admin",
      email: "admin@example.com",
      role: "demo",
      active: true
    }])
  });
  equal(result.response.status, 200);
  deepEqual(result.json, { ok: false, error: "Admins only." });
  equal(result.fetchCalls.length, 1);
});

console.log("Action source inventory");

await test("all 76 dispatcher actions match the plan exactly in source order", async () => {
  const source = fs.readFileSync(new URL("../functions/api/orders.js", import.meta.url), "utf8");
  const plan = fs.readFileSync(new URL("../.docs/V1_2_ACTION_REGISTRY_PLAN.md", import.meta.url), "utf8");
  const dispatcher = source.split("/* =========================\n   RESPONSE HELPERS")[0];

  const dispatchActions = [];
  for (const block of dispatcher.matchAll(/if\s*\(([^)]*\baction ===[^)]*)\)\s*\{/g)) {
    for (const match of block[1].matchAll(/action === "([^"]+)"/g)) {
      dispatchActions.push(match[1]);
    }
  }
  const plannedActions = [...plan.matchAll(/^\| \d+ \| `([^`]+)` →/gm)].map(match => match[1]);
  const counts = new Map();
  for (const action of dispatchActions) counts.set(action, (counts.get(action) || 0) + 1);

  equal(dispatchActions.length, 76);
  equal(new Set(dispatchActions).size, 76);
  equal(plannedActions.length, 76);
  deepEqual(dispatchActions, plannedActions);
  deepEqual([...counts.entries()].filter(([, count]) => count !== 1), []);
});

console.log(`\n${testCount} tests, ${assertionCount} assertions passed`);
