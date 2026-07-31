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

function decodeTokenPayload(token) {
  const payload = String(token || "").split(".")[0];
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

async function passwordFields(password, iterations = 100000) {
  const salt = new Uint8Array(16);
  salt.fill(7);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return {
    password_hash: base64Url(new Uint8Array(bits)),
    password_salt: base64Url(salt),
    password_iterations: iterations
  };
}

function rawEcdsaToDer(rawInput) {
  const raw = new Uint8Array(rawInput);
  const encodeInt = (part) => {
    let value = part;
    while (value.length > 1 && value[0] === 0) value = value.slice(1);
    if (value[0] & 0x80) value = Uint8Array.from([0, ...value]);
    return Uint8Array.from([0x02, value.length, ...value]);
  };
  const r = encodeInt(raw.slice(0, 32));
  const s = encodeInt(raw.slice(32, 64));
  return Uint8Array.from([0x30, r.length + s.length, ...r, ...s]);
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

console.log("Registry-backed login and invite behavior");

await test("owner PIN login issues the owner admin session", async () => {
  const before = Date.now();
  const result = await invoke({
    body: { action: "login", email: "", password: CORE_ENV.ADMIN_PIN }
  });
  equal(result.response.status, 200);
  equal(result.json?.ok, true);
  equal(result.json?.role, "admin");
  equal(typeof result.json?.token, "string");
  const payload = decodeTokenPayload(result.json.token);
  equal(payload.sub, "owner");
  equal(payload.role, "admin");
  ok(payload.exp >= before + 14 * 24 * 60 * 60 * 1000);
  equal(result.fetchCalls.length, 0);
});

await test("password login accepts active user and touches login before response", async () => {
  const password = "correct horse battery";
  const fields = await passwordFields(password);
  const user = {
    id: "user-active",
    email: "active@example.com",
    role: "admin",
    active: true,
    ...fields
  };
  const result = await invoke({
    body: { action: "login", email: "ACTIVE@EXAMPLE.COM", password },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) {
        ok(String(input).includes("email=eq.active%40example.com"));
        equal(init.method, "GET");
        return jsonResponse([user]);
      }
      if (callNumber === 2) {
        ok(String(input).includes(`/rest/v1/admin_users?id=eq.${user.id}`));
        equal(init.method, "PATCH");
        ok(JSON.parse(init.body).last_login_at);
        return jsonResponse([]);
      }
      return noNetworkFetch(input);
    }
  });
  equal(result.response.status, 200);
  equal(result.json?.ok, true);
  equal(result.json?.role, "admin");
  const payload = decodeTokenPayload(result.json.token);
  deepEqual(
    { sub: payload.sub, email: payload.email, role: payload.role },
    { sub: user.id, email: user.email, role: user.role }
  );
  equal(result.fetchCalls.length, 2);
});

await test("password login rejects inactive user and incorrect password", async () => {
  const fields = await passwordFields("correct password");
  const baseUser = {
    id: "user-login",
    email: "login@example.com",
    role: "admin",
    ...fields
  };
  const inactive = await invoke({
    body: { action: "login", email: baseUser.email, password: "correct password" },
    fetchMock: () => jsonResponse([{ ...baseUser, active: false }])
  });
  deepEqual(inactive.json, { ok: false, error: "Invalid email or password." });
  equal(inactive.fetchCalls.length, 1);

  const wrong = await invoke({
    body: { action: "login", email: baseUser.email, password: "wrong password" },
    fetchMock: () => jsonResponse([{ ...baseUser, active: true }])
  });
  deepEqual(wrong.json, { ok: false, error: "Invalid email or password." });
  equal(wrong.fetchCalls.length, 1);
});

await test("password login preserves generic lookup-failure response", async () => {
  const result = await invoke({
    body: { action: "login", email: "user@example.com", password: "password1" },
    fetchMock: () => jsonResponse({ message: "database unavailable" }, 503)
  });
  equal(result.response.status, 200);
  deepEqual(result.json, { ok: false, error: "Could not sign in." });
  equal(result.fetchCalls.length, 1);
});

await test("getInvite returns only current public invite fields", async () => {
  const user = {
    id: "invite-user",
    email: "invite@example.com",
    display_name: "Invited User",
    role: "demo",
    invite_token: "valid-invite",
    invite_expires_at: new Date(Date.now() + 60_000).toISOString(),
    password_hash: "must-not-leak"
  };
  const result = await invoke({
    body: { action: "getInvite", token: "valid-invite" },
    fetchMock: () => jsonResponse([user])
  });
  equal(result.response.status, 200);
  deepEqual(result.json, {
    ok: true,
    email: user.email,
    displayName: user.display_name,
    role: user.role
  });
  equal(result.fetchCalls.length, 1);
});

await test("getInvite rejects missing, used, and expired invites", async () => {
  const missing = await invoke({
    body: { action: "getInvite" }
  });
  deepEqual(missing.json, { ok: false, error: "This invite is invalid or already used." });
  equal(missing.fetchCalls.length, 0);

  const used = await invoke({
    body: { action: "getInvite", token: "used" },
    fetchMock: () => jsonResponse([])
  });
  deepEqual(used.json, { ok: false, error: "This invite is invalid or already used." });

  const expired = await invoke({
    body: { action: "getInvite", token: "expired" },
    fetchMock: () => jsonResponse([{
      email: "expired@example.com",
      role: "demo",
      invite_token: "expired",
      invite_expires_at: new Date(Date.now() - 60_000).toISOString()
    }])
  });
  deepEqual(expired.json, { ok: false, error: "This invite has expired." });
});

await test("acceptInvite preserves short-password rejection", async () => {
  const result = await invoke({
    body: { action: "acceptInvite", token: "invite", password: "short" }
  });
  deepEqual(result.json, { ok: false, error: "Password must be at least 8 characters." });
  equal(result.fetchCalls.length, 0);
});

await test("acceptInvite writes password fields before issuing session", async () => {
  const user = {
    id: "accepted-user",
    email: "accepted@example.com",
    display_name: "Accepted User",
    role: "demo",
    invite_token: "accept-me",
    invite_expires_at: new Date(Date.now() + 60_000).toISOString()
  };
  let patchBody;
  const result = await invoke({
    body: { action: "acceptInvite", token: "accept-me", password: "new password" },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) return jsonResponse([user]);
      if (callNumber === 2) {
        equal(init.method, "PATCH");
        patchBody = JSON.parse(init.body);
        return jsonResponse([]);
      }
      return noNetworkFetch(input);
    }
  });
  equal(result.response.status, 200);
  equal(result.json?.ok, true);
  equal(result.json?.role, "demo");
  equal(result.fetchCalls.length, 2);
  equal(typeof patchBody.password_hash, "string");
  equal(typeof patchBody.password_salt, "string");
  equal(patchBody.password_iterations, 100000);
  equal(patchBody.invite_token, null);
  equal(patchBody.invite_expires_at, null);
  equal(patchBody.active, true);
  ok(patchBody.last_login_at);
  const payload = decodeTokenPayload(result.json.token);
  deepEqual(
    { sub: payload.sub, email: payload.email, role: payload.role },
    { sub: user.id, email: user.email, role: user.role }
  );
});

await test("acceptInvite remains successful when best-effort push fails", async () => {
  const user = {
    id: "push-failure-user",
    email: "push-failure@example.com",
    display_name: "Push Failure",
    role: "admin",
    invite_token: "push-failure",
    invite_expires_at: new Date(Date.now() + 60_000).toISOString()
  };
  const result = await invoke({
    body: { action: "acceptInvite", token: "push-failure", password: "new password" },
    env: {
      ...CORE_ENV,
      VAPID_PUBLIC_KEY: "configured",
      VAPID_PRIVATE_KEY: "configured"
    },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) return jsonResponse([user]);
      if (callNumber === 2) {
        equal(init.method, "PATCH");
        return jsonResponse([]);
      }
      if (callNumber === 3) throw new Error("mock push storage failure");
      return noNetworkFetch(input);
    }
  });
  equal(result.response.status, 200);
  equal(result.json?.ok, true);
  equal(result.json?.role, "admin");
  equal(decodeTokenPayload(result.json.token).sub, user.id);
  equal(result.fetchCalls.length, 3);
});

console.log("Registry-backed WebAuthn login behavior");

await test("webauthnLoginOptions maps zero and existing credentials", async () => {
  const empty = await invoke({
    body: { action: "webauthnLoginOptions" },
    fetchMock: emptySupabaseFetch
  });
  equal(empty.response.status, 200);
  equal(empty.json?.ok, true);
  equal(empty.json?.hasCredentials, false);
  deepEqual(empty.json?.options?.allowCredentials, []);
  equal(empty.json?.options?.rpId, "murphsmitts.com");
  equal(empty.json?.options?.timeout, 60000);
  equal(empty.json?.options?.userVerification, "preferred");
  equal(typeof empty.json?.options?.challenge, "string");
  equal(typeof empty.json?.challengeToken, "string");

  const existing = await invoke({
    body: { action: "webauthnLoginOptions" },
    env: {
      ...CORE_ENV,
      WEBAUTHN_RP_ID: "admin.example.com",
      WEBAUTHN_ORIGIN: "https://admin.example.com"
    },
    fetchMock: () => jsonResponse([
      { credential_id: "credential-a" },
      { credential_id: "credential-b" }
    ])
  });
  equal(existing.json?.hasCredentials, true);
  equal(existing.json?.options?.rpId, "admin.example.com");
  deepEqual(existing.json?.options?.allowCredentials, [
    { id: "credential-a", type: "public-key" },
    { id: "credential-b", type: "public-key" }
  ]);
});

await test("webauthnLoginVerify preserves invalid challenge response", async () => {
  const result = await invoke({
    body: { action: "webauthnLoginVerify", challengeToken: "invalid" }
  });
  equal(result.response.status, 200);
  deepEqual(result.json, { ok: false, error: "Invalid passkey challenge." });
  equal(result.fetchCalls.length, 0);
});

await test("webauthnLoginVerify verifies ES256, updates count, and issues owner session", async () => {
  const options = await invoke({
    body: { action: "webauthnLoginOptions" },
    fetchMock: emptySupabaseFetch
  });
  const challenge = options.json.options.challenge;
  const challengeToken = options.json.challengeToken;
  const credentialId = "credential-success";

  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const publicKey = JSON.stringify({ alg: -7, x: publicJwk.x, y: publicJwk.y });

  const rpHash = new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode("murphsmitts.com")
  ));
  const authenticatorData = new Uint8Array(37);
  authenticatorData.set(rpHash, 0);
  authenticatorData[32] = 0x01;
  new DataView(authenticatorData.buffer).setUint32(33, 7);

  const clientDataBytes = new TextEncoder().encode(JSON.stringify({
    type: "webauthn.get",
    challenge,
    origin: "https://murphsmitts.com"
  }));
  const clientHash = new Uint8Array(await crypto.subtle.digest("SHA-256", clientDataBytes));
  const signedData = new Uint8Array(authenticatorData.length + clientHash.length);
  signedData.set(authenticatorData, 0);
  signedData.set(clientHash, authenticatorData.length);
  const rawSignature = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keyPair.privateKey,
    signedData
  ));
  const signature = rawSignature.length === 64 ? rawEcdsaToDer(rawSignature) : rawSignature;

  const credentialBody = {
    id: credentialId,
    response: {
      clientDataJSON: base64Url(clientDataBytes),
      authenticatorData: base64Url(authenticatorData),
      signature: base64Url(signature)
    }
  };
  let countPatch;
  const success = await invoke({
    body: {
      action: "webauthnLoginVerify",
      challengeToken,
      credential: credentialBody
    },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) {
        ok(String(input).includes(`credential_id=eq.${credentialId}`));
        return jsonResponse([{
          credential_id: credentialId,
          public_key: publicKey,
          sign_count: 3
        }]);
      }
      if (callNumber === 2) {
        ok(String(input).includes(`credential_id=eq.${credentialId}`));
        equal(init.method, "PATCH");
        countPatch = JSON.parse(init.body);
        return jsonResponse([]);
      }
      return noNetworkFetch(input);
    }
  });
  equal(success.response.status, 200);
  equal(success.json?.ok, true);
  equal(success.json?.role, "admin");
  equal(success.fetchCalls.length, 2);
  equal(countPatch.sign_count, 7);
  ok(countPatch.last_used_at);
  const payload = decodeTokenPayload(success.json.token);
  equal(payload.sub, "owner");
  equal(payload.role, "admin");

  const badSignature = signature.slice();
  badSignature[badSignature.length - 1] ^= 0xff;
  const failed = await invoke({
    body: {
      action: "webauthnLoginVerify",
      challengeToken,
      credential: {
        ...credentialBody,
        response: {
          ...credentialBody.response,
          signature: base64Url(badSignature)
        }
      }
    },
    fetchMock: () => jsonResponse([{
      credential_id: credentialId,
      public_key: publicKey,
      sign_count: 3
    }])
  });
  equal(failed.response.status, 200);
  deepEqual(failed.json, { ok: false, error: "Passkey signature was invalid." });
  equal(failed.fetchCalls.length, 1);
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

await test("six registry actions plus 70 legacy actions match the plan", async () => {
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
  const expectedRegistryActions = [
    "login",
    "getInvite",
    "acceptInvite",
    "getPushPublicKey",
    "webauthnLoginOptions",
    "webauthnLoginVerify"
  ];
  const expectedDemoPolicies = new Map([
    ["login", "allow"],
    ["getInvite", "allow"],
    ["acceptInvite", "allow"],
    ["getPushPublicKey", "deny"],
    ["webauthnLoginOptions", "allow"],
    ["webauthnLoginVerify", "allow"]
  ]);
  const registryActionSet = new Set(expectedRegistryActions);
  const plannedLegacyActions = plannedActions.filter(action => !registryActionSet.has(action));
  const legacyCounts = new Map();
  for (const action of legacyActions) {
    legacyCounts.set(action, (legacyCounts.get(action) || 0) + 1);
  }

  deepEqual(registryActions, expectedRegistryActions);
  equal(registryActions.length, 6);
  equal(
    (dispatcher.match(/return dispatchRegisteredAction\(registeredAction,/g) || []).length,
    1,
    "registry dispatch has one central authorization path"
  );
  const registryDispatchHelper = source.match(
    /export async function dispatchRegisteredAction\([\s\S]*?\n\}/
  );
  ok(registryDispatchHelper, "registry dispatch helper is present");
  equal(
    (registryDispatchHelper[0].match(/\bauthorizeAction\(/g) || []).length,
    1,
    "registry dispatch authorizes exactly once before handler invocation"
  );
  for (const action of expectedRegistryActions) {
    equal(legacyActions.includes(action), false);
    ok(
      new RegExp(
        `^  ${action}: \\{\\n    auth: "public",\\n    demo: "${expectedDemoPolicies.get(action)}",`,
        "m"
      ).test(registryMatch[1]),
      `${action} retains its public authorization and demo policy`
    );
  }
  equal(legacyActions.length, 70);
  equal(new Set(legacyActions).size, 70);
  equal(plannedActions.length, 76);
  deepEqual(legacyActions, plannedLegacyActions);
  deepEqual([...legacyCounts.entries()].filter(([, count]) => count !== 1), []);
  deepEqual([...registryActions, ...legacyActions].sort(), plannedActions.slice().sort());
});

console.log(`\n${testCount} tests, ${assertionCount} assertions passed`);
