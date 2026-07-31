/* Dependency-free characterization tests for functions/api/orders.js.
   Run: node scripts/action-dispatch-selftest.mjs

   These tests call the production onRequest export with Fetch API Request
   objects and a fail-closed fetch mock. No external request is permitted. */

import assert from "node:assert/strict";
import fs from "node:fs";
import { webcrypto } from "node:crypto";
import {
  authorizeAction,
  dispatchRegisteredAction,
  onRequest,
  resolveActionAuthPolicy
} from "../functions/api/orders.js";

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

async function withFetchMock(fetchMock, fn) {
  const previousFetch = globalThis.fetch;
  fetchCalls = [];
  globalThis.fetch = async (input, init = {}) => {
    fetchCalls.push({ url: String(input), init });
    return fetchMock(input, init, fetchCalls.length);
  };
  try {
    return await fn();
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
    user: await signedToken({
      sub: "user-standard",
      email: "user@example.com",
      role: "staff",
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

await test("registry action still requires the global CORE preflight", async () => {
  const missingSupabase = await invoke({
    body: { action: "getPushPublicKey" },
    env: {
      ADMIN_PIN: CORE_ENV.ADMIN_PIN,
      ADMIN_SESSION_SECRET: CORE_ENV.ADMIN_SESSION_SECRET
    }
  });
  equal(missingSupabase.response.status, 500);
  deepEqual(missingSupabase.json, {
    ok: false,
    error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable."
  });

  const missingAdminSecret = await invoke({
    body: { action: "getPushPublicKey" },
    env: {
      SUPABASE_URL: CORE_ENV.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: CORE_ENV.SUPABASE_SERVICE_ROLE_KEY,
      ADMIN_PIN: CORE_ENV.ADMIN_PIN
    }
  });
  equal(missingAdminSecret.response.status, 500);
  deepEqual(missingAdminSecret.json, {
    ok: false,
    error: "Missing ADMIN_PIN or ADMIN_SESSION_SECRET environment variable."
  });
  equal(missingSupabase.fetchCalls.length + missingAdminSecret.fetchCalls.length, 0);
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

console.log("Central registry authorization policies");

await test("static public policy resolves and performs no token validation", async () => {
  const ctx = { env: CORE_ENV, body: {} };
  equal(resolveActionAuthPolicy("public", ctx), "public");
  const result = await authorizeAction("public", ctx);
  deepEqual(result, {
    ok: true,
    auth: {
      policy: "public",
      payload: null,
      role: null,
      user: null,
      owner: false
    }
  });
});

await test("static session policy preserves token validation failures", async () => {
  const { expired } = await sessionTokens();
  const futurePayload = base64Url(new TextEncoder().encode(JSON.stringify({
    sub: "owner",
    role: "admin",
    exp: Date.now() + 60_000
  })));
  const cases = [
    [{}, { ok: false, error: "Missing session token." }],
    [{ _token: "not-a-token" }, { ok: false, error: "Invalid session token." }],
    [{ _token: `${futurePayload}.invalid` }, { ok: false, error: "Invalid session token." }],
    [{ _token: expired }, { ok: false, error: "Session expired." }]
  ];
  for (const [body, expected] of cases) {
    deepEqual(await authorizeAction("session", { env: CORE_ENV, body }), expected);
  }
});

await test("static session policy returns admin, user, and demo payloads", async () => {
  const { admin, user, demo } = await sessionTokens();
  for (const [token, role] of [[admin, "admin"], [user, "staff"], [demo, "demo"]]) {
    const result = await authorizeAction("session", {
      env: CORE_ENV,
      body: { _token: token }
    });
    equal(result.ok, true);
    equal(result.auth.policy, "session");
    equal(result.auth.role, role);
    equal(result.auth.payload.role, role);
    equal(result.auth.user, null);
    equal(result.auth.owner, false);
  }
});

await test("active-user policy preserves owner escape-hatch semantics", async () => {
  const { owner } = await sessionTokens();
  const result = await authorizeAction("active-user", {
    env: CORE_ENV,
    body: { _token: owner }
  });
  equal(result.ok, true);
  deepEqual(result.auth, {
    policy: "active-user",
    payload: result.auth.payload,
    role: "admin",
    user: null,
    owner: true
  });
  equal(result.auth.payload.sub, "owner");
});

await test("active-user policy reloads active user and accepts changed role", async () => {
  const { user } = await sessionTokens();
  const row = {
    id: "user-standard",
    email: "user@example.com",
    role: "demo",
    active: true
  };
  const result = await withFetchMock(
    () => jsonResponse([row]),
    () => authorizeAction("active-user", {
      env: CORE_ENV,
      body: { _token: user }
    })
  );
  equal(result.ok, true);
  equal(result.auth.policy, "active-user");
  equal(result.auth.role, "demo");
  deepEqual(result.auth.user, row);
  equal(result.auth.owner, false);
  equal(fetchCalls.length, 1);
});

await test("active-user policy rejects missing and inactive users", async () => {
  const { user } = await sessionTokens();
  const missing = await withFetchMock(
    () => jsonResponse([]),
    () => authorizeAction("active-user", {
      env: CORE_ENV,
      body: { _token: user }
    })
  );
  deepEqual(missing, { ok: false, error: "Session is no longer active." });

  const inactive = await withFetchMock(
    () => jsonResponse([{
      id: "user-standard",
      email: "user@example.com",
      role: "staff",
      active: false
    }]),
    () => authorizeAction("active-user", {
      env: CORE_ENV,
      body: { _token: user }
    })
  );
  deepEqual(inactive, { ok: false, error: "Session is no longer active." });
});

await test("admin policy accepts owner without user resolution", async () => {
  const { owner } = await sessionTokens();
  const result = await authorizeAction("admin", {
    env: CORE_ENV,
    body: { _token: owner }
  });
  equal(result.ok, true);
  equal(result.auth.policy, "admin");
  equal(result.auth.role, "admin");
  equal(result.auth.owner, true);
  equal(result.auth.user, null);
});

await test("admin policy accepts an active current admin", async () => {
  const { admin } = await sessionTokens();
  const result = await withFetchMock(
    () => jsonResponse([{
      id: "user-admin",
      email: "admin@example.com",
      role: "admin",
      active: true
    }]),
    () => authorizeAction("admin", {
      env: CORE_ENV,
      body: { _token: admin }
    })
  );
  equal(result.ok, true);
  equal(result.auth.role, "admin");
  equal(result.auth.owner, false);
  equal(fetchCalls.length, 1);
});

await test("admin policy rejects active non-admin, inactive, and missing users", async () => {
  const { admin, demo } = await sessionTokens();
  const cases = [
    [demo, [{ id: "user-demo", email: "demo@example.com", role: "demo", active: true }]],
    [admin, [{ id: "user-admin", email: "admin@example.com", role: "admin", active: false }]],
    [admin, []]
  ];
  for (const [token, rows] of cases) {
    const result = await withFetchMock(
      () => jsonResponse(rows),
      () => authorizeAction("admin", {
        env: CORE_ENV,
        body: { _token: token }
      })
    );
    deepEqual(result, { ok: false, error: "Admins only." });
  }
});

await test("conditional resolver uses strict boolean branches", async () => {
  const resolver = ({ body }) =>
    body.includeHidden === true ? "session" : "public";
  equal(resolveActionAuthPolicy(resolver, { body: {} }), "public");
  equal(resolveActionAuthPolicy(resolver, { body: { includeHidden: false } }), "public");
  equal(resolveActionAuthPolicy(resolver, { body: { includeHidden: "true" } }), "public");
  equal(resolveActionAuthPolicy(resolver, { body: { includeHidden: true } }), "session");
});

await test("registry invocation authorizes once and passes auth context", async () => {
  const { owner } = await sessionTokens();
  let resolverCalls = 0;
  let handlerCalls = 0;
  let receivedAuth = null;
  const entry = {
    auth(ctx) {
      resolverCalls += 1;
      equal(ctx.body._token, owner);
      return "session";
    },
    async handler(ctx) {
      handlerCalls += 1;
      receivedAuth = ctx.auth;
      return jsonResponse({ ok: true, handled: true });
    }
  };
  const response = await dispatchRegisteredAction(entry, {
    env: CORE_ENV,
    body: { _token: owner },
    jsonHeaders: {
      "Content-Type": JSON_HEADERS.contentType,
      "Cache-Control": JSON_HEADERS.cacheControl
    }
  });
  equal(response.status, 200);
  deepEqual(await response.json(), { ok: true, handled: true });
  equal(resolverCalls, 1);
  equal(handlerCalls, 1);
  equal(receivedAuth.policy, "session");
  equal(receivedAuth.payload.sub, "owner");
  equal(receivedAuth.owner, true);
});

await test("registry invocation does not call handler after authorization failure", async () => {
  let handlerCalls = 0;
  const response = await dispatchRegisteredAction({
    auth: "session",
    async handler() {
      handlerCalls += 1;
      return jsonResponse({ ok: true });
    }
  }, {
    env: CORE_ENV,
    body: {},
    jsonHeaders: {
      "Content-Type": JSON_HEADERS.contentType,
      "Cache-Control": JSON_HEADERS.cacheControl
    }
  });
  equal(response.status, 200);
  deepEqual(await response.json(), { ok: false, error: "Missing session token." });
  assertJsonHeaders(response);
  equal(handlerCalls, 0);
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
  assertJsonHeaders(anonymous.response);
  equal(anonymous.fetchCalls.length, 0);

  const { demo } = await sessionTokens();
  await assertDemoDenied("getPushPublicKey", demo);
});

await test("getPushPublicKey returns a configured VAPID public key", async () => {
  const result = await invoke({
    body: { action: "getPushPublicKey" },
    env: { ...CORE_ENV, VAPID_PUBLIC_KEY: "test-vapid-public-key" }
  });
  equal(result.response.status, 200);
  deepEqual(result.json, { ok: true, publicKey: "test-vapid-public-key" });
  assertJsonHeaders(result.response);
  equal(result.fetchCalls.length, 0);
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

console.log("Action registry and legacy source inventory");

await test("one registry action plus 75 legacy actions match the plan", async () => {
  const source = fs.readFileSync(new URL("../functions/api/orders.js", import.meta.url), "utf8");
  const plan = fs.readFileSync(new URL("../.docs/V1_2_ACTION_REGISTRY_PLAN.md", import.meta.url), "utf8");
  const dispatcher = source.split("/* =========================\n   RESPONSE HELPERS")[0];
  const registryMatch = source.match(/const ACTIONS = \{([\s\S]*?)\n\};/);
  ok(registryMatch, "ACTIONS registry is present");
  const registryActions = [...registryMatch[1].matchAll(/^  ([A-Za-z][A-Za-z0-9]*): \{/gm)]
    .map(match => match[1]);

  const legacyActions = [];
  for (const block of dispatcher.matchAll(/if\s*\(([^)]*\baction ===[^)]*)\)\s*\{/g)) {
    for (const match of block[1].matchAll(/action === "([^"]+)"/g)) {
      legacyActions.push(match[1]);
    }
  }
  const plannedActions = [...plan.matchAll(/^\| \d+ \| `([^`]+)` →/gm)].map(match => match[1]);
  const plannedLegacyActions = plannedActions.filter(action => action !== "getPushPublicKey");
  const legacyCounts = new Map();
  for (const action of legacyActions) {
    legacyCounts.set(action, (legacyCounts.get(action) || 0) + 1);
  }

  deepEqual(registryActions, ["getPushPublicKey"]);
  equal(registryActions.length, 1);
  equal(legacyActions.includes("getPushPublicKey"), false);
  equal(legacyActions.length, 75);
  equal(new Set(legacyActions).size, 75);
  equal(plannedActions.length, 76);
  deepEqual(legacyActions, plannedLegacyActions);
  deepEqual([...legacyCounts.entries()].filter(([, count]) => count !== 1), []);
  deepEqual([...registryActions, ...legacyActions].sort(), plannedActions.slice().sort());
});

console.log(`\n${testCount} tests, ${assertionCount} assertions passed`);
