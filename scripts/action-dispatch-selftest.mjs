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

function concatBytes(...parts) {
  return Uint8Array.from(parts.flatMap(part => [...part]));
}

function cborByteString(bytes) {
  if (bytes.length < 24) return Uint8Array.from([0x40 + bytes.length, ...bytes]);
  if (bytes.length < 256) return Uint8Array.from([0x58, bytes.length, ...bytes]);
  return Uint8Array.from([0x59, bytes.length >> 8, bytes.length & 0xff, ...bytes]);
}

async function registrationAttestation(rpId, credentialId) {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const jwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const x = Uint8Array.from(Buffer.from(jwk.x, "base64url"));
  const y = Uint8Array.from(Buffer.from(jwk.y, "base64url"));
  const cose = concatBytes(
    Uint8Array.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21]),
    cborByteString(x),
    Uint8Array.from([0x22]),
    cborByteString(y)
  );
  const rpHash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rpId))
  );
  const authData = concatBytes(
    rpHash,
    Uint8Array.from([0x41, 0, 0, 0, 7]),
    new Uint8Array(16),
    Uint8Array.from([credentialId.length >> 8, credentialId.length & 0xff]),
    credentialId,
    cose
  );
  const key = new TextEncoder().encode("authData");
  return concatBytes(
    Uint8Array.from([0xa1, 0x60 + key.length]),
    key,
    cborByteString(authData)
  );
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
  const row = {
    id: "user-admin",
    email: "admin@example.com",
    role: "admin",
    active: true
  };
  const result = await withFetchMock(
    () => jsonResponse([row]),
    () => authorizeAction("admin", {
      env: CORE_ENV,
      body: { _token: admin }
    })
  );
  equal(result.ok, true);
  equal(result.auth.role, "admin");
  equal(result.auth.owner, false);
  deepEqual(result.auth.user, row);
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

console.log("Registry-backed WebAuthn registration and stored geocoding");

await test("webauthnRegisterOptions preserves session and option behavior", async () => {
  const { owner, user, demo } = await sessionTokens();
  const env = {
    ...CORE_ENV,
    WEBAUTHN_RP_ID: "admin.example.test",
    WEBAUTHN_ORIGIN: "https://admin.example.test"
  };
  for (const token of [owner, user]) {
    const result = await invoke({
      env,
      body: { action: "webauthnRegisterOptions", _token: token },
      fetchMock: () => jsonResponse([
        { credential_id: "credential-one" },
        { credential_id: "credential-two" }
      ])
    });
    equal(result.json.ok, true);
    equal(result.json.options.rp.id, "admin.example.test");
    equal(result.json.options.rp.name, "Murph's Mitt Maintenance");
    equal(result.json.options.user.name, "murphsmitts");
    equal(result.json.options.user.displayName, "Murph's Mitts Admin");
    deepEqual(result.json.options.pubKeyCredParams, [{ type: "public-key", alg: -7 }]);
    deepEqual(result.json.options.authenticatorSelection, {
      residentKey: "preferred",
      userVerification: "preferred"
    });
    equal(result.json.options.timeout, 60000);
    equal(result.json.options.attestation, "none");
    deepEqual(result.json.options.excludeCredentials, [
      { id: "credential-one", type: "public-key" },
      { id: "credential-two", type: "public-key" }
    ]);
    const challenge = decodeTokenPayload(result.json.challengeToken);
    equal(challenge.k, "reg");
    equal(challenge.c, result.json.options.challenge);
    ok(challenge.exp > Date.now());
    ok(challenge.exp <= Date.now() + 5 * 60 * 1000);
    equal(result.fetchCalls.length, 1);
  }
  await assertDemoDenied("webauthnRegisterOptions", demo);
  await assertDemoDenied("webauthnRegisterVerify", demo);
});

await test("webauthnRegisterVerify preserves validation and ES256 storage", async () => {
  const { owner } = await sessionTokens();
  const env = {
    ...CORE_ENV,
    WEBAUTHN_RP_ID: "admin.example.test",
    WEBAUTHN_ORIGIN: "https://admin.example.test"
  };
  const invalid = await invoke({
    env,
    body: {
      action: "webauthnRegisterVerify", _token: owner,
      challengeToken: "invalid"
    }
  });
  deepEqual(invalid.json, { ok: false, error: "Invalid passkey challenge." });
  equal(invalid.fetchCalls.length, 0);

  const options = await invoke({
    env,
    body: { action: "webauthnRegisterOptions", _token: owner },
    fetchMock: () => jsonResponse([])
  });
  const challenge = options.json.options.challenge;
  const wrongType = await invoke({
    env,
    body: {
      action: "webauthnRegisterVerify", _token: owner,
      challengeToken: options.json.challengeToken,
      credential: {
        response: {
          clientDataJSON: base64Url(new TextEncoder().encode(JSON.stringify({
            type: "webauthn.get",
            challenge,
            origin: "https://admin.example.test"
          })))
        }
      }
    }
  });
  deepEqual(wrongType.json, { ok: false, error: "Unexpected passkey ceremony." });

  const credentialId = Uint8Array.from([1, 2, 3, 4, 5, 6]);
  const attestation = await registrationAttestation("admin.example.test", credentialId);
  let stored;
  const success = await invoke({
    env,
    body: {
      action: "webauthnRegisterVerify", _token: owner,
      challengeToken: options.json.challengeToken,
      label: " My Face ID ",
      credential: {
        transports: ["internal", "hybrid"],
        response: {
          clientDataJSON: base64Url(new TextEncoder().encode(JSON.stringify({
            type: "webauthn.create",
            challenge,
            origin: "https://admin.example.test"
          }))),
          attestationObject: base64Url(attestation)
        }
      }
    },
    fetchMock(input, init) {
      ok(String(input).endsWith("/rest/v1/webauthn_credentials"));
      equal(init.method, "POST");
      equal(init.headers.Prefer, "return=minimal");
      stored = JSON.parse(init.body);
      return jsonResponse(null);
    }
  });
  deepEqual(success.json, { ok: true });
  equal(stored.credential_id, base64Url(credentialId));
  equal(JSON.parse(stored.public_key).alg, -7);
  equal(stored.sign_count, 7);
  equal(stored.transports, "internal,hybrid");
  equal(stored.label, "My Face ID");
  equal(success.fetchCalls.length, 1);
});

await test("geocodeMissingOrderAddresses preserves provider and patch ordering", async () => {
  const { owner } = await sessionTokens();
  const empty = await invoke({
    body: {
      action: "geocodeMissingOrderAddresses", _token: owner, items: [{ orderNumber: "0169" }]
    }
  });
  deepEqual(empty.json, { ok: true, results: {} });
  equal(empty.fetchCalls.length, 0);

  const oldRow = {
    order_number: "0169",
    map_lat: null,
    map_lng: null,
    map_address_hash: null
  };
  const updatedRow = {
    ...oldRow,
    map_lat: 42.101,
    map_lng: -72.589,
    map_geocoded_address: "1 Main St, Springfield, MA",
    map_geocode_source: "census",
    map_geocode_status: "ok",
    map_geocode_quality: "exact",
    map_address_hash: "hash-1"
  };
  const result = await invoke({
    body: {
      action: "geocodeMissingOrderAddresses", _token: owner,
      items: [{
        orderNumber: "0169",
        addressHash: "hash-1",
        candidates: ["1 Main St, Springfield, MA"]
      }]
    },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) {
        ok(String(input).includes("/rest/v1/orders?"));
        return jsonResponse([oldRow]);
      }
      if (callNumber === 2) {
        ok(String(input).startsWith("https://geocoding.geo.census.gov/"));
        return jsonResponse({
          result: {
            addressMatches: [{
              matchedAddress: "1 MAIN ST, SPRINGFIELD, MA",
              coordinates: { y: 42.101, x: -72.589 }
            }]
          }
        });
      }
      ok(String(input).includes("order_number=eq.0169"));
      equal(init.method, "PATCH");
      equal(init.headers.Prefer, "return=representation");
      const patch = JSON.parse(init.body);
      equal(patch.map_lat, 42.101);
      equal(patch.map_lng, -72.589);
      equal(patch.map_geocode_source, "census");
      equal(patch.map_geocode_status, "ok");
      equal(patch.map_address_hash, "hash-1");
      ok(!Number.isNaN(Date.parse(patch.map_geocoded_at)));
      return jsonResponse([updatedRow]);
    }
  });
  equal(result.json.ok, true);
  equal(result.json.results["0169"].ok, true);
  equal(result.json.results["0169"].source, "census");
  equal(result.fetchCalls.length, 3);
});

console.log("Registry-backed pricing mutations");

const stageElevenActions = [
  "saveServicePricingDraft", "discardServicePricingDraft",
  "publishServicePricing", "restoreServicePricingRevision",
  "createServicePricing"
];

const pricingServiceRow = {
  id: "svc-1",
  service_key: "full_service",
  service_name: "Full Service",
  category: "relacing",
  short_description: "Current",
  bullet_details: ["Current bullet"],
  pricing_type: "fixed",
  base_price: 80,
  premium_price: null,
  price_suffix: "",
  display_override: "",
  is_public: true,
  is_active: true,
  sort_order: 10
};

const pricingDraftData = {
  service_name: "Full Service Plus",
  category: "relacing",
  short_description: "Updated",
  bullet_details: ["Clean", "Condition"],
  pricing_type: "tiered",
  base_price: 90,
  premium_price: 110,
  price_suffix: "",
  display_override: "",
  is_public: true,
  is_active: true,
  sort_order: 20
};

await test("Stage 11 pricing actions centralize authorization and demo denial", async () => {
  const { owner, demo } = await sessionTokens();
  for (const action of stageElevenActions) {
    const missing = await invoke({ body: { action } });
    deepEqual(missing.json, { ok: false, error: "Missing session token." }, action);
    equal(missing.fetchCalls.length, 0, action);
    await assertDemoDenied(action, demo);
    const valid = await invoke({
      body: { action, _token: owner },
      fetchMock: emptySupabaseFetch
    });
    equal(valid.response.status, 200, action);
    equal(valid.json?.error === "Missing session token.", false, action);
  }
});

await test("saveServicePricingDraft preserves patch and insert branches", async () => {
  const { owner } = await sessionTokens();
  const commonBody = {
    action: "saveServicePricingDraft",
    _token: owner,
    serviceKey: " full_service ",
    serviceName: " Full Service Plus ",
    category: "invalid-defaults-additional",
    pricingType: "invalid-defaults-fixed",
    shortDescription: " Updated ",
    bulletDetails: [" Clean ", "", " Condition "],
    basePrice: "90",
    premiumPrice: "",
    priceSuffix: " each ",
    displayOverride: " ",
    isPublic: false,
    isActive: false,
    sortOrder: "12.6",
    note: " Draft note "
  };

  const patched = await invoke({
    body: commonBody,
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) {
        ok(String(input).includes("service_key=eq.full_service"));
        return jsonResponse([pricingServiceRow]);
      }
      if (callNumber === 2) {
        ok(String(input).includes("status=eq.draft"));
        return jsonResponse([{ id: "draft-1" }]);
      }
      ok(String(input).includes("id=eq.draft-1"));
      equal(init.method, "PATCH");
      equal(init.headers.Prefer, "return=minimal");
      const payload = JSON.parse(init.body);
      deepEqual(payload.data, {
        service_name: "Full Service Plus",
        category: "additional",
        short_description: "Updated",
        bullet_details: ["Clean", "Condition"],
        pricing_type: "fixed",
        base_price: 90,
        premium_price: null,
        price_suffix: "each",
        display_override: null,
        is_public: false,
        is_active: false,
        sort_order: 13
      });
      equal(payload.note, "Draft note");
      ok(!Number.isNaN(Date.parse(payload.created_at)));
      return jsonResponse(null);
    }
  });
  deepEqual(patched.json, { ok: true, display: "$90" });
  equal(patched.fetchCalls.length, 3);

  const inserted = await invoke({
    body: { ...commonBody, category: "relacing", pricingType: "tiered", premiumPrice: "110" },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) return jsonResponse([pricingServiceRow]);
      if (callNumber === 2) return jsonResponse([]);
      equal(init.method, "POST");
      equal(init.headers.Prefer, "return=minimal");
      const payload = JSON.parse(init.body);
      equal(payload.service_pricing_id, "svc-1");
      equal(payload.service_key, "full_service");
      equal(payload.status, "draft");
      equal(payload.data.premium_price, 110);
      equal(payload.note, "Draft note");
      return jsonResponse(null);
    }
  });
  deepEqual(inserted.json, { ok: true, display: "$90–$110" });
  equal(inserted.fetchCalls.length, 3);
});

await test("discard and restore preserve lookup/write ordering", async () => {
  const { owner } = await sessionTokens();
  const discarded = await invoke({
    body: {
      action: "discardServicePricingDraft", _token: owner, serviceKey: "full_service"
    },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) return jsonResponse([pricingServiceRow]);
      ok(String(input).includes("service_pricing_id=eq.svc-1&status=eq.draft"));
      equal(init.method, "DELETE");
      equal(init.headers.Prefer, "return=minimal");
      return jsonResponse([]);
    }
  });
  deepEqual(discarded.json, { ok: true });
  equal(discarded.fetchCalls.length, 2);
  equal(discarded.fetchCalls.some(call => call.init.method === "PATCH"), false);

  const revision = {
    id: "revision-1",
    service_pricing_id: "svc-1",
    service_key: "full_service",
    data: pricingDraftData,
    published_at: "2026-01-15T12:00:00.000Z"
  };
  const restored = await invoke({
    body: {
      action: "restoreServicePricingRevision", _token: owner, revisionId: " revision-1 "
    },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) {
        ok(String(input).includes("id=eq.revision-1&limit=1"));
        return jsonResponse([revision]);
      }
      if (callNumber === 2) {
        ok(String(input).includes("service_pricing_id=eq.svc-1&status=eq.draft"));
        return jsonResponse([]);
      }
      equal(init.method, "POST");
      const payload = JSON.parse(init.body);
      deepEqual(payload.data, pricingDraftData);
      equal(payload.service_pricing_id, "svc-1");
      equal(payload.status, "draft");
      equal(payload.note, "Restored from 1/15/2026");
      return jsonResponse(null);
    }
  });
  deepEqual(restored.json, { ok: true });
  equal(restored.fetchCalls.length, 3);
  equal(
    restored.fetchCalls.some(call => call.url.includes("/rest/v1/service_pricing?")),
    false
  );
});

await test("createServicePricing preserves derived key and forced initial state", async () => {
  const { owner } = await sessionTokens();
  const missing = await invoke({
    body: { action: "createServicePricing", _token: owner }
  });
  deepEqual(missing.json, { ok: false, error: "Service name is required." });
  const invalid = await invoke({
    body: {
      action: "createServicePricing", _token: owner,
      serviceName: "New Service", serviceKey: "Not Valid"
    }
  });
  deepEqual(invalid.json, {
    ok: false,
    error: "Service key must be lowercase letters, numbers, and underscores."
  });

  const created = await invoke({
    body: {
      action: "createServicePricing", _token: owner,
      serviceName: " New Custom Service ", category: "unknown", pricingType: "unknown"
    },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) {
        ok(String(input).includes("service_key=eq.new_custom_service"));
        return jsonResponse([]);
      }
      if (callNumber === 2) return jsonResponse([{ sort_order: 10 }, { sort_order: 35 }]);
      equal(init.method, "POST");
      equal(init.headers.Prefer, "return=representation");
      const payload = JSON.parse(init.body);
      deepEqual(payload, {
        service_key: "new_custom_service",
        service_name: "New Custom Service",
        category: "additional",
        bullet_details: [],
        pricing_type: "fixed",
        is_public: false,
        is_active: false,
        sort_order: 45
      });
      return jsonResponse([{ id: "svc-new", ...payload, published_at: null }]);
    }
  });
  equal(created.json.ok, true);
  equal(created.json.service.serviceKey, "new_custom_service");
  equal(created.json.service.isPublic, false);
  equal(created.json.service.isActive, false);
  equal(created.fetchCalls.length, 3);
  equal(
    created.fetchCalls.some(call => call.url.includes("service_pricing_revisions")),
    false
  );
});

await test("publishServicePricing preserves writes, payload, and partial states", async () => {
  const { owner } = await sessionTokens();
  const draft = {
    id: "draft-1",
    service_pricing_id: "svc-1",
    service_key: "full_service",
    status: "draft",
    note: "Original note",
    data: pricingDraftData
  };
  const livePatched = {
    ...pricingServiceRow,
    ...pricingDraftData,
    id: "svc-1",
    service_key: "full_service"
  };

  const success = await invoke({
    body: {
      action: "publishServicePricing", _token: owner,
      serviceKey: "full_service", note: " Published note "
    },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) return jsonResponse([pricingServiceRow]);
      if (callNumber === 2) return jsonResponse([draft]);
      if (callNumber === 3) {
        ok(String(input).includes("/service_pricing?id=eq.svc-1"));
        equal(init.method, "PATCH");
        equal(init.headers.Prefer, "return=representation");
        const payload = JSON.parse(init.body);
        deepEqual(Object.keys(payload), [
          "service_name", "category", "short_description", "bullet_details",
          "pricing_type", "base_price", "premium_price", "price_suffix",
          "display_override", "is_public", "is_active", "sort_order",
          "updated_at", "published_at"
        ]);
        equal(payload.service_name, "Full Service Plus");
        equal(payload.updated_at, payload.published_at);
        ok(!Number.isNaN(Date.parse(payload.published_at)));
        return jsonResponse([{ ...livePatched, ...payload }]);
      }
      ok(String(input).includes("/service_pricing_revisions?id=eq.draft-1"));
      equal(init.method, "PATCH");
      equal(init.headers.Prefer, "return=minimal");
      const payload = JSON.parse(init.body);
      equal(payload.status, "published");
      equal(payload.previous_display, "$80");
      equal(payload.new_display, "$90–$110");
      equal(payload.note, "Published note");
      ok(!Number.isNaN(Date.parse(payload.published_at)));
      return jsonResponse(null);
    }
  });
  equal(success.json.ok, true);
  equal(success.json.previousDisplay, "$80");
  equal(success.json.newDisplay, "$90–$110");
  equal(success.fetchCalls.length, 4);

  const liveFailure = await invoke({
    body: {
      action: "publishServicePricing", _token: owner, serviceKey: "full_service"
    },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) return jsonResponse([pricingServiceRow]);
      if (callNumber === 2) return jsonResponse([draft]);
      return jsonResponse({ message: "live failed" }, 500);
    }
  });
  deepEqual(liveFailure.json, {
    ok: false,
    error: "Publish failed while updating live pricing."
  });
  equal(liveFailure.fetchCalls.length, 3);

  const promoteFailure = await invoke({
    body: {
      action: "publishServicePricing", _token: owner, serviceKey: "full_service"
    },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) return jsonResponse([pricingServiceRow]);
      if (callNumber === 2) return jsonResponse([draft]);
      if (callNumber === 3) return jsonResponse([livePatched]);
      return jsonResponse({ message: "promotion failed" }, 500);
    }
  });
  deepEqual(promoteFailure.json, {
    ok: false,
    error: "Publish saved pricing but failed to record history."
  });
  equal(promoteFailure.fetchCalls.length, 4);
  equal(
    promoteFailure.fetchCalls.filter(call => call.init.method === "PATCH").length,
    2
  );
});

console.log("Registry-backed storage and gallery workflows");

const stageTenActions = [
  "sendMessageReply", "uploadGalleryPhoto", "setGalleryPhotoCover",
  "setGalleryPhotoOrder", "moveGalleryPhoto", "hideGalleryPhoto",
  "restoreGalleryPhoto", "deleteGalleryPhoto", "uploadLacePhoto",
  "uploadSaleGlovePhoto", "setSalePhotoPrimary", "setSalePhotoHover",
  "deleteSaleGlovePhoto"
];

await test("Stage 10 actions centralize authorization and demo denial", async () => {
  const { owner, demo } = await sessionTokens();
  for (const action of stageTenActions) {
    const missing = await invoke({ body: { action } });
    deepEqual(missing.json, { ok: false, error: "Missing session token." }, action);
    equal(missing.fetchCalls.length, 0, action);
    await assertDemoDenied(action, demo);
    const valid = await invoke({
      body: { action, _token: owner },
      fetchMock: emptySupabaseFetch
    });
    equal(valid.response.status, 200, action);
    equal(valid.json?.error === "Missing session token.", false, action);
  }
});

await test("sendMessageReply preserves validation, SMS ordering, and outgoing log", async () => {
  const { owner } = await sessionTokens();
  const env = {
    ...CORE_ENV,
    TWILIO_ACCOUNT_SID: "AC123",
    TWILIO_AUTH_TOKEN: "secret",
    TWILIO_MESSAGING_SERVICE_SID: "MG123"
  };
  const invalid = await invoke({
    body: { action: "sendMessageReply", _token: owner, phoneNumber: "bad", body: "Hi" }
  });
  deepEqual(invalid.json, { ok: false, error: "Invalid phone number." });
  const blank = await invoke({
    body: { action: "sendMessageReply", _token: owner, phoneNumber: "555-867-5309" }
  });
  deepEqual(blank.json, { ok: false, error: "Enter a message." });
  const unconfigured = await invoke({
    body: {
      action: "sendMessageReply", _token: owner,
      phoneNumber: "555-867-5309", body: "Hello"
    }
  });
  deepEqual(unconfigured.json, { ok: false, error: "Twilio is not configured." });

  const sent = await invoke({
    env,
    body: {
      action: "sendMessageReply", _token: owner, phoneNumber: "(555) 867-5309",
      body: "  Hello  ", customerName: " Customer ", orderNumber: " 0169 "
    },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) {
        ok(String(input).includes("/Accounts/AC123/Messages.json"));
        equal(init.method, "POST");
        const form = new URLSearchParams(init.body);
        equal(form.get("To"), "+15558675309");
        equal(form.get("MessagingServiceSid"), "MG123");
        equal(form.get("Body"), "Hello");
        equal(form.has("MediaUrl"), false);
        return jsonResponse({ sid: "SM123" });
      }
      ok(String(input).includes("/rest/v1/sms_messages"));
      equal(init.method, "POST");
      equal(init.headers.Prefer, "return=minimal");
      deepEqual(JSON.parse(init.body), {
        direction: "out", phone_number: "+15558675309", customer_name: "Customer",
        order_number: "0169", body: "Hello", media_urls: null,
        twilio_sid: "SM123", read: true
      });
      return jsonResponse(null);
    }
  });
  deepEqual(sent.json, { ok: true });
  equal(sent.fetchCalls.length, 2);
});

await test("media, gallery, and lace uploads preserve storage-only behavior", async () => {
  const { owner } = await sessionTokens();
  const twilioEnv = {
    ...CORE_ENV,
    TWILIO_ACCOUNT_SID: "AC123",
    TWILIO_AUTH_TOKEN: "secret",
    TWILIO_MESSAGING_SERVICE_SID: "MG123"
  };
  const mms = await invoke({
    env: twilioEnv,
    body: {
      action: "sendMessageReply", _token: owner, phoneNumber: "5558675309",
      mediaDataUrl: "data:image/png;base64,QQ=="
    },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) {
        ok(String(input).includes("/storage/v1/object/order-photos/sms-out/"));
        ok(String(input).endsWith(".png"));
        equal(init.headers["Content-Type"], "image/png");
        return new Response("", { status: 200 });
      }
      if (callNumber === 2) {
        const form = new URLSearchParams(init.body);
        ok(form.get("MediaUrl").includes("/public/order-photos/sms-out/"));
        return jsonResponse({ sid: "SM-MMS" });
      }
      return jsonResponse(null);
    }
  });
  equal(mms.json.ok, true);
  equal(mms.fetchCalls.length, 3);

  for (const [action, body, bucket, pathPart] of [
    ["uploadGalleryPhoto", {
      filename: " My Photo.PNG ", contentType: "image/png",
      dataUrl: "data:image/png;base64,QQ==", section: "not-a-section"
    }, "gallery", "/fielding-gloves/"],
    ["uploadLacePhoto", {
      color: " Hot Pink!! ", filename: " Lace Photo.JPG ",
      contentType: "image/jpeg", dataUrl: "data:image/jpeg;base64,QQ=="
    }, "lace", "/hot-pink/"]
  ]) {
    const result = await invoke({
      body: { action, _token: owner, ...body },
      fetchMock(input, init) {
        ok(String(input).includes(`/storage/v1/object/${bucket}${pathPart}`));
        equal(init.method, "POST");
        equal(init.headers["x-upsert"], "true");
        return new Response("", { status: 200 });
      }
    });
    equal(result.json.ok, true, action);
    equal(result.fetchCalls.length, 1, action);
    equal(result.fetchCalls[0].url.includes("/rest/v1/"), false, action);
  }
});

await test("gallery management preserves non-transactional request ordering", async () => {
  const { owner } = await sessionTokens();
  const cover = await invoke({
    body: {
      action: "setGalleryPhotoCover", _token: owner,
      url: "https://supabase.invalid/storage/v1/object/public/gallery/fielding-gloves/a.jpg"
    },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) return jsonResponse([{ order_number: "0169" }]);
      equal(init.method, "PATCH");
      if (callNumber === 2) {
        ok(String(input).includes("order_number=eq.0169"));
        deepEqual(JSON.parse(init.body), { is_cover: false });
        return new Response("ignored", { status: 500 });
      }
      ok(String(input).includes("photo_url=eq."));
      deepEqual(JSON.parse(init.body), { is_cover: true });
      return jsonResponse([]);
    }
  });
  deepEqual(cover.json, { ok: true });
  equal(cover.fetchCalls.length, 3);

  const moved = await invoke({
    body: {
      action: "moveGalleryPhoto", _token: owner, path: "fielding-gloves/a.jpg",
      section: "catchers-mitts", url: "https://old.invalid/a.jpg"
    },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) {
        ok(String(input).endsWith("/storage/v1/object/move"));
        deepEqual(JSON.parse(init.body), {
          bucketId: "gallery",
          sourceKey: "fielding-gloves/a.jpg",
          destinationKey: "catchers-mitts/a.jpg"
        });
        return new Response("", { status: 200 });
      }
      ok(String(input).includes("/rest/v1/gallery_photo_links"));
      return new Response("ignored", { status: 500 });
    }
  });
  equal(moved.json.ok, true);
  equal(moved.fetchCalls.length, 2);

  for (const [action, path, sourceKey, destinationKey] of [
    ["hideGalleryPhoto", "fielding-gloves/a.jpg", "fielding-gloves/a.jpg", "_hidden/fielding-gloves/a.jpg"],
    ["restoreGalleryPhoto", "_hidden/fielding-gloves/a.jpg", "_hidden/fielding-gloves/a.jpg", "fielding-gloves/a.jpg"]
  ]) {
    const result = await invoke({
      body: { action, _token: owner, path },
      fetchMock(input, init) {
        ok(String(input).endsWith("/storage/v1/object/move"));
        deepEqual(JSON.parse(init.body), { bucketId: "gallery", sourceKey, destinationKey });
        return new Response("", { status: 200 });
      }
    });
    equal(result.json.ok, true);
    equal(result.fetchCalls.length, 1);
  }
});

await test("sale photo workflows preserve storage/DB order and constrained mutations", async () => {
  const { owner } = await sessionTokens();
  const uploaded = await invoke({
    body: {
      action: "uploadSaleGlovePhoto", _token: owner, gloveId: "g1",
      filename: "front.jpg", contentType: "image/jpeg",
      dataUrl: "data:image/jpeg;base64,QQ=="
    },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) return jsonResponse([{ id: "g1", slug: "pro-glove" }]);
      if (callNumber === 2) {
        ok(String(input).includes("/storage/v1/object/gloves-for-sale/pro-glove/"));
        return new Response("", { status: 200 });
      }
      if (callNumber === 3) return jsonResponse([{ id: "old1" }, { id: "old2" }]);
      const row = JSON.parse(init.body);
      deepEqual(row, {
        glove_id: "g1", url: row.url, filename: "front.jpg", sort_order: 2
      });
      return jsonResponse([{ id: "p3", ...row }]);
    }
  });
  equal(uploaded.json.ok, true);
  equal(uploaded.fetchCalls.length, 4);

  for (const [action, field] of [
    ["setSalePhotoPrimary", "is_primary"],
    ["setSalePhotoHover", "is_hover"]
  ]) {
    const result = await invoke({
      body: { action, _token: owner, gloveId: "g1", photoId: "p1" },
      fetchMock(input, init, callNumber) {
        equal(init.method, "PATCH");
        deepEqual(JSON.parse(init.body), { [field]: callNumber === 2 });
        if (callNumber === 2) {
          ok(String(input).includes("id=eq.p1&glove_id=eq.g1"));
          return jsonResponse([{ id: "p1", glove_id: "g1", [field]: true }]);
        }
        return jsonResponse([]);
      }
    });
    equal(result.json.ok, true);
    equal(result.fetchCalls.length, 2);
  }

  const deleted = await invoke({
    body: {
      action: "deleteSaleGlovePhoto", _token: owner, gloveId: "g1", photoId: "p1"
    },
    fetchMock(input, init) {
      ok(String(input).includes("id=eq.p1&glove_id=eq.g1"));
      equal(init.method, "DELETE");
      return jsonResponse([{ id: "p1", glove_id: "g1" }]);
    }
  });
  equal(deleted.json.ok, true);
  equal(deleted.fetchCalls.length, 1);
  equal(deleted.fetchCalls[0].url.includes("/storage/"), false);
});

console.log("Registry-backed order workflow actions");

const stageNineActions = [
  "deleteOrder", "uploadOrderPhoto", "removeOrderPhoto", "createOrder",
  "resendStatusEmail", "resendStatusText", "updateOrder"
];

await test("Stage 9 actions centralize authorization and global demo denial", async () => {
  const { owner, demo } = await sessionTokens();
  for (const action of stageNineActions) {
    const missing = await invoke({ body: { action } });
    deepEqual(missing.json, { ok: false, error: "Missing session token." }, action);
    equal(missing.fetchCalls.length, 0, action);
    await assertDemoDenied(action, demo);
    const valid = await invoke({
      body: { action, _token: owner },
      fetchMock: emptySupabaseFetch
    });
    equal(valid.response.status, 200, action);
    equal(valid.json?.error === "Missing session token.", false, action);
  }
});

await test("deleteOrder preserves exact delete and no-row/no-storage behavior", async () => {
  const { owner } = await sessionTokens();
  const missing = await invoke({ body: { action: "deleteOrder", _token: owner } });
  deepEqual(missing.json, { ok: false, error: "Missing orderNumber." });
  let requestUrl = "";
  const result = await invoke({
    body: { action: "deleteOrder", _token: owner, orderNumber: " 0999 " },
    fetchMock(input, init) {
      requestUrl = String(input);
      equal(init.method, "DELETE");
      equal(init.headers.Prefer, "return=representation");
      return jsonResponse([]);
    }
  });
  deepEqual(result.json, { ok: true, deleted: true, orderNumber: "0999" });
  ok(requestUrl.includes("/rest/v1/orders?order_number=eq.0999"));
  equal(requestUrl.includes("/storage/"), false);
  equal(result.fetchCalls.length, 1);
});

await test("order photo handlers preserve validation and DB-reference-only removal", async () => {
  const { owner } = await sessionTokens();
  const uploadMissing = await invoke({ body: { action: "uploadOrderPhoto", _token: owner } });
  deepEqual(uploadMissing.json, {
    ok: false,
    error: "Missing order number, filename or image data."
  });
  const mime = await invoke({
    body: {
      action: "uploadOrderPhoto", _token: owner, orderNumber: "0169",
      filename: "photo.txt", contentType: "text/plain", dataUrl: "data:text/plain;base64,QQ=="
    }
  });
  deepEqual(mime.json, { ok: false, error: "Only image uploads are allowed." });
  const uploadNotFound = await invoke({
    body: {
      action: "uploadOrderPhoto", _token: owner, orderNumber: "0169",
      filename: "photo.jpg", contentType: "image/jpeg", dataUrl: "data:image/jpeg;base64,QQ=="
    },
    fetchMock: () => jsonResponse([])
  });
  deepEqual(uploadNotFound.json, { ok: false, error: "Order not found." });

  const removeMissing = await invoke({ body: { action: "removeOrderPhoto", _token: owner } });
  deepEqual(removeMissing.json, { ok: false, error: "Missing order number or photo URL." });
  const unattached = await invoke({
    body: {
      action: "removeOrderPhoto", _token: owner,
      orderNumber: "0169", url: "https://photos.invalid/missing.jpg"
    },
    fetchMock: () => jsonResponse([{ order_number: "0169", glove_photos: [] }])
  });
  deepEqual(unattached.json, { ok: false, error: "Photo was not found on this order." });
  equal(unattached.fetchCalls.some(call => call.url.includes("/storage/")), false);
});

await test("createOrder preserves validation order and manual-order defaults", async () => {
  const { owner } = await sessionTokens();
  const cases = [
    [{}, "Customer name is required."],
    [{ customerName: "Customer" }, "Add a phone number or email."],
    [{ customerName: "Customer", emailAddress: "c@example.com", smsOptIn: true }, "Phone is required when SMS opt-in is enabled."],
    [{
      customerName: "Customer", emailAddress: "c@example.com",
      dropOffMethod: "Ship", streetAddress: "1 Main"
    }, "Shipping orders need street, city, state, and zip."]
  ];
  for (const [order, error] of cases) {
    const result = await invoke({ body: { action: "createOrder", _token: owner, order } });
    deepEqual(result.json, { ok: false, error });
    equal(result.fetchCalls.length, 0);
  }

  let inserted;
  const created = await invoke({
    body: {
      action: "createOrder", _token: owner,
      order: { customerName: " Customer ", phoneNumber: "555-0000" }
    },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) return jsonResponse([{ order_number: "0169" }]);
      if (callNumber === 2) {
        inserted = JSON.parse(init.body);
        return jsonResponse([inserted]);
      }
      return new Response("activity failed", { status: 500 });
    }
  });
  equal(created.json.ok, true);
  equal(inserted.order_number, "0170");
  equal(inserted.status, "Received");
  equal(inserted.paid, "Unpaid");
  equal(inserted.glove_photos.length, 0);
  equal(inserted.tracking_token.length, 64);
  equal(created.fetchCalls.length, 3);
});

await test("resend handlers preserve early validation and binding checks", async () => {
  const { owner } = await sessionTokens();
  for (const action of ["resendStatusEmail", "resendStatusText"]) {
    const missing = await invoke({ body: { action, _token: owner } });
    deepEqual(missing.json, { ok: false, error: "Missing orderNumber." }, action);
  }
  const email = await invoke({
    body: { action: "resendStatusEmail", _token: owner, orderNumber: "0169" },
    fetchMock: () => jsonResponse([{
      order_number: "0169", status: "Received", email_address: "customer@example.com"
    }])
  });
  deepEqual(email.json, { ok: false, error: "Missing RESEND_API_KEY environment variable." });
  equal(email.fetchCalls.length, 1);
  const text = await invoke({
    body: { action: "resendStatusText", _token: owner, orderNumber: "0169" },
    fetchMock: () => jsonResponse([{
      order_number: "0169", status: "Completed", phone_number: "5550000", sms_opt_in: true
    }])
  });
  deepEqual(text.json, { ok: false, error: "Missing Twilio environment variables." });
  equal(text.fetchCalls.length, 1);
});

await test("updateOrder preserves preflight-before-patch and simple patch ordering", async () => {
  const { owner } = await sessionTokens();
  const missing = await invoke({ body: { action: "updateOrder", _token: owner } });
  deepEqual(missing.json, { ok: false, error: "Missing orderNumber." });
  const notFound = await invoke({
    body: { action: "updateOrder", _token: owner, orderNumber: "0169", updates: {} },
    fetchMock: () => jsonResponse([])
  });
  deepEqual(notFound.json, { ok: false, error: "Order not found: 0169" });

  const oldRow = {
    order_number: "0169", status: "Received", drop_off_method: "Local Drop-Off",
    paid: "Unpaid", sms_opt_in: false, customer_name: "Customer"
  };
  const preflight = await invoke({
    body: {
      action: "updateOrder", _token: owner, orderNumber: "0169",
      updates: { status: "Completed" }
    },
    fetchMock: () => jsonResponse([oldRow])
  });
  equal(preflight.response.status, 500);
  deepEqual(preflight.json, {
    ok: false,
    error: "Missing RESEND_API_KEY environment variable."
  });
  equal(preflight.fetchCalls.length, 1);

  const calls = [];
  const updatedRow = { ...oldRow, internal_notes: "Cleaned" };
  const success = await invoke({
    body: {
      action: "updateOrder", _token: owner, orderNumber: "0169",
      updates: { internalNotes: "  Cleaned  ", ignoredField: "ignored" }
    },
    fetchMock(input, init, callNumber) {
      calls.push({ url: String(input), method: init.method, body: init.body });
      if (callNumber === 1) return jsonResponse([oldRow]);
      if (callNumber === 2) return jsonResponse([updatedRow]);
      return jsonResponse([]);
    }
  });
  equal(success.json.ok, true);
  equal(calls[0].method, "GET");
  equal(calls[1].method, "PATCH");
  deepEqual(JSON.parse(calls[1].body), { internal_notes: "Cleaned" });
  ok(calls.slice(2).every(call => call.url.includes("/rest/v1/order_activity")));
});

console.log("Registry-backed isolated write actions");

const stageEightActions = [
  "savePushSubscription", "sendTestPush", "markMessagesRead", "deleteMessage",
  "deleteMessageThread", "createInventoryItem", "updateInventoryItem",
  "startLaborSession", "stopLaborSession", "pauseLaborSession",
  "resumeLaborSession", "updateLaborSessionNotes", "createExpense",
  "deleteExpense", "saveShopSettings", "createSaleGlove",
  "updateSaleGlove", "deleteSaleGlove"
];

await test("Stage 8 actions reject before I/O, deny demo, and accept valid sessions", async () => {
  const { owner, demo } = await sessionTokens();
  for (const action of stageEightActions) {
    const missing = await invoke({ body: { action } });
    deepEqual(missing.json, { ok: false, error: "Missing session token." }, action);
    equal(missing.fetchCalls.length, 0, action);
    await assertDemoDenied(action, demo);
    const valid = await invoke({
      body: { action, _token: owner },
      fetchMock: emptySupabaseFetch
    });
    equal(valid.response.status, 200, action);
    equal(
      ["Missing session token.", "Invalid session token.", "Session expired."].includes(valid.json?.error),
      false,
      `${action} reached its handler`
    );
  }
});

await test("push subscription preserves validation, cleaning, and exact upsert", async () => {
  const { owner } = await sessionTokens();
  for (const subscription of [{}, { endpoint: "https://push.invalid", keys: {} }]) {
    const invalid = await invoke({
      body: { action: "savePushSubscription", _token: owner, subscription }
    });
    deepEqual(invalid.json, { ok: false, error: "Invalid subscription." });
    equal(invalid.fetchCalls.length, 0);
  }
  let payload;
  const result = await invoke({
    body: {
      action: "savePushSubscription",
      _token: owner,
      label: "  Brett's phone  ",
      subscription: {
        endpoint: "not-validated://endpoint",
        keys: { p256dh: "p-key", auth: "a-key" }
      }
    },
    fetchMock(input, init) {
      ok(String(input).includes("push_subscriptions?on_conflict=endpoint"));
      equal(init.method, "POST");
      equal(init.headers.Prefer, "resolution=merge-duplicates,return=minimal");
      payload = JSON.parse(init.body);
      return jsonResponse([]);
    }
  });
  deepEqual(result.json, { ok: true });
  deepEqual(
    { endpoint: payload.endpoint, p256dh: payload.p256dh, auth: payload.auth, label: payload.label },
    { endpoint: "not-validated://endpoint", p256dh: "p-key", auth: "a-key", label: "Brett's phone" }
  );
  ok(payload.last_used_at);
});

await test("test push remains successful when VAPID is absent", async () => {
  const { owner } = await sessionTokens();
  const result = await invoke({ body: { action: "sendTestPush", _token: owner } });
  deepEqual(result.json, { ok: true });
  equal(result.fetchCalls.length, 0);
});

await test("message mutations preserve filters, caps, and affected-row behavior", async () => {
  const { owner } = await sessionTokens();
  for (const [phoneNumber, expected] of [
    ["  +15550000000  ", "phone_number=eq.%2B15550000000&read=eq.false"],
    ["   ", "sms_messages?read=eq.false"]
  ]) {
    const result = await invoke({
      body: { action: "markMessagesRead", _token: owner, phoneNumber },
      fetchMock(input, init) {
        ok(String(input).includes(expected));
        equal(init.method, "PATCH");
        deepEqual(JSON.parse(init.body), { read: true });
        return jsonResponse([]);
      }
    });
    deepEqual(result.json, { ok: true });
  }
  const missing = await invoke({ body: { action: "deleteMessage", _token: owner } });
  deepEqual(missing.json, { ok: false, error: "Missing message id." });
  const deleted = await invoke({
    body: { action: "deleteMessage", _token: owner, id: " m 1 " },
    fetchMock(input, init) {
      ok(String(input).includes("id=eq.m%201"));
      equal(init.method, "DELETE");
      return jsonResponse([]);
    }
  });
  deepEqual(deleted.json, { ok: true });
  const invalidThread = await invoke({
    body: { action: "deleteMessageThread", _token: owner, phoneNumbers: [null, "", false] }
  });
  deepEqual(invalidThread.json, { ok: false, error: "Missing phone numbers." });
  const phones = Array.from({ length: 25 }, (_, i) => `"+1555${i}"`);
  const thread = await invoke({
    body: { action: "deleteMessageThread", _token: owner, phoneNumbers: phones },
    fetchMock(input, init) {
      equal(init.method, "DELETE");
      const decoded = decodeURIComponent(String(input));
      equal((decoded.match(/\+1555/g) || []).length, 20);
      equal(decoded.includes('""'), false);
      return jsonResponse([]);
    }
  });
  deepEqual(thread.json, { ok: true });
});

await test("labor mutation handlers preserve validation before helper I/O", async () => {
  const { owner } = await sessionTokens();
  const startMissing = await invoke({ body: { action: "startLaborSession", _token: owner } });
  deepEqual(startMissing.json, { ok: false, error: "Missing orderNumber." });
  const phaseMissing = await invoke({
    body: { action: "startLaborSession", _token: owner, orderNumber: "0169" }
  });
  deepEqual(phaseMissing.json, { ok: false, error: "Select a phase before starting the timer." });
  const invalidPhase = await invoke({
    body: { action: "startLaborSession", _token: owner, orderNumber: "0169", phase: "Unknown" }
  });
  deepEqual(invalidPhase.json, { ok: false, error: "Invalid labor phase." });
  for (const action of [
    "stopLaborSession", "pauseLaborSession", "resumeLaborSession", "updateLaborSessionNotes"
  ]) {
    const result = await invoke({ body: { action, _token: owner } });
    deepEqual(result.json, { ok: false, error: "Missing sessionId." }, action);
    equal(result.fetchCalls.length, 0, action);
  }
});

await test("inventory writes preserve normalized uniqueness, validation, capabilities, and empty updates", async () => {
  const { owner } = await sessionTokens();
  const duplicate = await invoke({
    body: { action: "createInventoryItem", _token: owner, color: "  jet   black " },
    fetchMock: () => jsonResponse([{ color: "Jet Black", quantity_on_hand: 2 }])
  });
  deepEqual(duplicate.json, { ok: false, error: "That lace color already exists." });
  const invalid = await invoke({
    body: { action: "createInventoryItem", _token: owner, color: "Tan", quantityOnHand: -1 },
    fetchMock: () => jsonResponse([])
  });
  deepEqual(invalid.json, { ok: false, error: "Invalid quantity." });

  let payload;
  const created = await invoke({
    body: {
      action: "createInventoryItem", _token: owner, color: "Tan",
      quantityOnHand: 3, reorderAt: 1, reorderAlertEnabled: false, active: false
    },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) {
        return jsonResponse([{
          color: "Black", quantity_on_hand: 2, reorder_at: 1,
          reorder_alert_enabled: true, active: true, photo_url: null
        }]);
      }
      equal(init.method, "POST");
      payload = JSON.parse(init.body);
      return jsonResponse([{ ...payload }]);
    }
  });
  equal(created.json.ok, true);
  deepEqual(payload, {
    color: "Tan", quantity_on_hand: 3, reorder_at: 1,
    reorder_alert_enabled: false, active: false
  });

  const missing = await invoke({
    body: { action: "updateInventoryItem", _token: owner, color: "Missing", updates: {} },
    fetchMock: () => jsonResponse([{ color: "Black", quantity_on_hand: 2 }])
  });
  deepEqual(missing.json, { ok: false, error: "Lace color not found." });
  const row = { color: "Black", quantity_on_hand: 2 };
  const unchanged = await invoke({
    body: { action: "updateInventoryItem", _token: owner, color: "Black", updates: {} },
    fetchMock: () => jsonResponse([row])
  });
  deepEqual(unchanged.json, { ok: true, item: row });
  equal(unchanged.fetchCalls.length, 1);
  const collision = await invoke({
    body: {
      action: "updateInventoryItem", _token: owner,
      color: "Black", updates: { color: "  jet black " }
    },
    fetchMock: () => jsonResponse([row, { color: "Jet   Black", quantity_on_hand: 1 }])
  });
  deepEqual(collision.json, { ok: false, error: "That lace color already exists." });
});

await test("expense writes preserve validation, payload coercion, and no-row success", async () => {
  const { owner } = await sessionTokens();
  for (const amount of [0, -1, "not-a-number"]) {
    const invalid = await invoke({
      body: { action: "createExpense", _token: owner, expenseDate: "2026-01-01", category: "lace", amount }
    });
    deepEqual(invalid.json, { ok: false, error: "Expense needs a date, category, and amount." });
  }
  let payload;
  const created = await invoke({
    body: {
      action: "createExpense", _token: owner, expenseDate: " 2026-01-01 ",
      category: " lace ", amount: "12.5", quantity: "-2",
      description: "  Lace  ", unitKind: " spools "
    },
    fetchMock(input, init) {
      equal(init.method, "POST");
      payload = JSON.parse(init.body);
      return jsonResponse([]);
    }
  });
  deepEqual(created.json, { ok: true });
  deepEqual(payload, {
    expense_date: "2026-01-01", category: "lace", description: "Lace",
    amount: 12.5, quantity: null, unit_kind: "spools"
  });
  const missing = await invoke({ body: { action: "deleteExpense", _token: owner } });
  deepEqual(missing.json, { ok: false, error: "Missing expense id." });
  const deleted = await invoke({
    body: { action: "deleteExpense", _token: owner, id: "e 1" },
    fetchMock: () => jsonResponse([])
  });
  deepEqual(deleted.json, { ok: true });
});

await test("settings preserve validation and upsert-readback order", async () => {
  const { owner } = await sessionTokens();
  for (const body of [
    {}, { targetLaborRate: 0 }, { roundingIncrement: 0 }, { minShopCharge: -1 }
  ]) {
    const invalid = await invoke({ body: { action: "saveShopSettings", _token: owner, ...body } });
    deepEqual(invalid.json, { ok: false, error: "No valid settings to save." });
  }
  let payload;
  const result = await invoke({
    body: {
      action: "saveShopSettings", _token: owner,
      targetLaborRate: "50", minShopCharge: "0", roundingIncrement: "5"
    },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) {
        ok(String(input).includes("shop_settings?on_conflict=key"));
        payload = JSON.parse(init.body);
        return jsonResponse([]);
      }
      ok(String(input).includes("shop_settings?select=key,value"));
      return jsonResponse(payload);
    }
  });
  deepEqual(result.json.settings, {
    targetLaborRate: 50, minShopCharge: 0, roundingIncrement: 5
  });
  equal(result.fetchCalls.length, 2);
});

await test("sale glove writes preserve defaults, full payloads, and database-only deletion", async () => {
  const { owner } = await sessionTokens();
  let createPayload;
  const created = await invoke({
    body: { action: "createSaleGlove", _token: owner, title: "Glove" },
    fetchMock(input, init) {
      equal(init.method, "POST");
      createPayload = JSON.parse(init.body);
      return jsonResponse([]);
    }
  });
  deepEqual(created.json, { ok: true, glove: null });
  equal(createPayload.status, "available");
  equal(createPayload.sort_order, 0);
  const updateMissing = await invoke({ body: { action: "updateSaleGlove", _token: owner } });
  deepEqual(updateMissing.json, { ok: false, error: "Missing glove id." });
  let updatePayload;
  const updated = await invoke({
    body: {
      action: "updateSaleGlove", _token: owner, id: "g 1",
      title: "  Glove  ", price: "99.5", featured: true, sortOrder: "4"
    },
    fetchMock(input, init) {
      equal(init.method, "PATCH");
      updatePayload = JSON.parse(init.body);
      return jsonResponse([]);
    }
  });
  deepEqual(updated.json, { ok: true, glove: null });
  equal(updatePayload.title, "Glove");
  equal(updatePayload.price, 99.5);
  equal(updatePayload.featured, true);
  equal(updatePayload.sort_order, 4);
  const deleted = await invoke({
    body: { action: "deleteSaleGlove", _token: owner, id: "g 1" },
    fetchMock(input, init) {
      ok(String(input).includes("/rest/v1/gloves_for_sale?id=eq.g%201"));
      equal(String(input).includes("/storage/"), false);
      equal(init.method, "DELETE");
      return jsonResponse([]);
    }
  });
  deepEqual(deleted.json, { ok: true, deleted: true, id: "g 1" });
});

console.log("Registry-backed read actions");

const stageSevenSessionActions = [
  "listMessages", "listOrders", "listInventory", "getOrder",
  "listOrderActivity", "listOrdersWithActivity", "listLaborSessions",
  "listOpenLaborSessions", "listLaborSummary", "geocodeAddresses",
  "listExpenses", "listServicePricing", "listServicePricingHistory",
  "getShopSettings", "listSaleGloves", "getSaleGlove", "listSaleGlovePhotos"
];

await test("Stage 7 session actions reject before external I/O and deny demo tokens", async () => {
  const { demo } = await sessionTokens();
  for (const action of stageSevenSessionActions) {
    const missing = await invoke({ body: { action } });
    deepEqual(missing.json, { ok: false, error: "Missing session token." }, action);
    equal(missing.fetchCalls.length, 0, action);
    await assertDemoDenied(action, demo);
  }
});

await test("valid sessions reach every Stage 7 session handler", async () => {
  const { owner } = await sessionTokens();
  for (const action of stageSevenSessionActions) {
    const result = await invoke({
      body: { action, _token: owner, items: [] },
      fetchMock: emptySupabaseFetch
    });
    equal(result.response.status, 200, action);
    equal(
      ["Missing session token.", "Invalid session token.", "Session expired."].includes(result.json?.error),
      false,
      `${action} passed centralized session authorization`
    );
  }
});

await test("message, inventory, expense, and store reads preserve queries and mappings", async () => {
  const { owner } = await sessionTokens();
  const messages = await invoke({
    body: { action: "listMessages", _token: owner },
    fetchMock(input) {
      ok(String(input).includes("order=created_at.desc&limit=300"));
      return jsonResponse([{
        id: "m1", direction: null, phone_number: "+15550000000",
        customer_name: "Customer", order_number: "0169", body: "Hello",
        media_urls: null, read: true, created_at: "2026-01-01"
      }]);
    }
  });
  deepEqual(messages.json.messages[0], {
    id: "m1", direction: "in", phoneNumber: "+15550000000",
    customerName: "Customer", orderNumber: "0169", body: "Hello",
    mediaUrls: [], read: true, createdAt: "2026-01-01"
  });
  const inventory = await invoke({
    body: { action: "listInventory", _token: owner },
    fetchMock(input) {
      ok(String(input).includes("order=color.asc"));
      return jsonResponse([{ color: "Black", quantity: 4 }]);
    }
  });
  deepEqual(inventory.json.inventory, [{ color: "Black", quantity: 4 }]);
  const expenses = await invoke({
    body: { action: "listExpenses", _token: owner },
    fetchMock(input) {
      ok(String(input).includes("order=expense_date.desc,created_at.desc&limit=500"));
      return jsonResponse([{ id: "e1", amount: "12.50", quantity: "2" }]);
    }
  });
  equal(expenses.json.expenses[0].amount, 12.5);
  equal(expenses.json.expenses[0].quantity, 2);
  const gloves = await invoke({
    body: { action: "listSaleGloves", _token: owner },
    fetchMock(input) {
      ok(String(input).includes("order=sort_order.asc,created_at.desc"));
      return jsonResponse([]);
    }
  });
  deepEqual(gloves.json, { ok: true, gloves: [] });
  const photos = await invoke({
    body: { action: "listSaleGlovePhotos", _token: owner, gloveId: "g 1" },
    fetchMock(input) {
      ok(String(input).includes("glove_id=eq.g%201"));
      ok(String(input).includes("order=sort_order.asc,id.asc"));
      return jsonResponse([{ id: "p1" }]);
    }
  });
  deepEqual(photos.json, { ok: true, photos: [{ id: "p1" }] });
});

await test("order, activity, and labor reads preserve validation and query semantics", async () => {
  const { owner } = await sessionTokens();
  const missing = await invoke({ body: { action: "getOrder", _token: owner } });
  deepEqual(missing.json, { ok: false, error: "Missing orderNumber." });
  const notFound = await invoke({
    body: { action: "getOrder", _token: owner, orderNumber: " 0169 " },
    fetchMock(input) {
      ok(String(input).includes("order_number=eq.0169"));
      return jsonResponse([]);
    }
  });
  deepEqual(notFound.json, { ok: false, error: "Order not found." });
  const activity = await invoke({
    body: { action: "listOrderActivity", _token: owner, orderNumber: "0169" },
    fetchMock(input) {
      ok(String(input).includes("order=created_at.desc&limit=50"));
      return jsonResponse([]);
    }
  });
  deepEqual(activity.json, { ok: true, activity: [] });
  const index = await invoke({
    body: { action: "listOrdersWithActivity", _token: owner },
    fetchMock(input) {
      ok(String(input).includes("event_type=neq.order_created_manual"));
      return jsonResponse([
        { order_number: "0169" }, { order_number: "0169" }, { order_number: "0170" }
      ]);
    }
  });
  deepEqual(index.json, { ok: true, orderNumbers: ["0169", "0170"] });
  const summary = await invoke({
    body: { action: "listLaborSummary", _token: owner },
    fetchMock(input) {
      ok(String(input).includes("ended_at=not.is.null"));
      return jsonResponse([{ order_number: "0169", phase: "Full Service", duration_minutes: "75", ended_at: "done" }]);
    }
  });
  deepEqual(summary.json.sessions[0], {
    orderNumber: "0169", phase: "Full Service", durationMinutes: 75, endedAt: "done"
  });
});

await test("pricing, history, settings defaults, and empty geocoding remain unchanged", async () => {
  const { owner } = await sessionTokens();
  const pricing = await invoke({
    body: { action: "listServicePricing", _token: owner },
    fetchMock: () => jsonResponse([])
  });
  deepEqual(pricing.json.services, []);
  equal(typeof pricing.json.settings.targetLaborRate, "number");
  equal(pricing.fetchCalls.length, 4);
  const history = await invoke({
    body: { action: "listServicePricingHistory", _token: owner, serviceKey: "full service" },
    fetchMock(input) {
      ok(String(input).includes("limit=200&service_key=eq.full%20service"));
      return jsonResponse([]);
    }
  });
  deepEqual(history.json, { ok: true, history: [] });
  const settings = await invoke({
    body: { action: "getShopSettings", _token: owner },
    fetchMock: () => jsonResponse([])
  });
  equal(typeof settings.json.settings.roundingIncrement, "number");
  const geocode = await invoke({
    body: { action: "geocodeAddresses", _token: owner, items: [] }
  });
  deepEqual(geocode.json, { ok: true, results: [] });
  equal(geocode.fetchCalls.length, 0);
});

await test("geocodeMissingOrderAddresses dispatches through the registry", async () => {
  const { owner } = await sessionTokens();
  const result = await invoke({
    body: { action: "geocodeMissingOrderAddresses", _token: owner, items: [] }
  });
  deepEqual(result.json, { ok: true, results: {} });
  equal(result.fetchCalls.length, 0);
});

await test("public glove search preserves threshold, all-term matching, cap, and safe fields", async () => {
  const short = await invoke({ body: { action: "searchPublicGloves", q: " a " } });
  deepEqual(short.json, { ok: true, gloves: [] });
  equal(short.fetchCalls.length, 0);
  const rows = Array.from({ length: 30 }, (_, index) => ({
    photo_url: `https://gallery.invalid/${index}.jpg`,
    order_number: null,
    brand_model: "Wilson A2000",
    glove_type: "Infield",
    web_type: "I-web",
    primary_lace_color: "Black",
    secondary_lace_color: null,
    customer_name: "must-not-leak"
  }));
  const result = await invoke({
    body: { action: "searchPublicGloves", q: " WILSON black " },
    fetchMock: () => jsonResponse(rows)
  });
  equal(result.json.gloves.length, 24);
  deepEqual(Object.keys(result.json.gloves[0]).sort(), [
    "brandModel", "gloveType", "laceColors", "photos", "webType"
  ]);
  equal(JSON.stringify(result.json).includes("must-not-leak"), false);
  equal(result.json.source, "gallery");
});

await test("geocoding retains caps, fallback order, pacing, and no storage writes", async () => {
  const source = fs.readFileSync(new URL("../functions/api/orders.js", import.meta.url), "utf8");
  const helper = source.match(/async function geocodeAddresses\([\s\S]*?(?=\nasync function geocodeMissingOrderAddresses)/);
  const candidates = source.match(/async function geocodeCandidateAddresses\([\s\S]*?(?=\nasync function geocodeWithCensus)/);
  ok(helper);
  ok(candidates);
  ok(helper[0].includes(".slice(0, 250)"));
  ok(helper[0].includes("await delayMs(1000)"));
  ok(candidates[0].indexOf("geocodeWithCensus") < candidates[0].indexOf("geocodeWithNominatim"));
  ok(candidates[0].includes("await delayMs(1000)"));
  equal(/supabaseFetch|storage\/v1/.test(helper[0]), false);
  ok(source.includes(".filter(Boolean).slice(0, 8)"));
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

await test("gallery preserves configured links, covers, and hidden-only descriptors", async () => {
  const linkedUrl = "https://supabase.invalid/storage/v1/object/public/gallery/fielding-gloves/linked.jpg";
  const describedUrl = "https://supabase.invalid/storage/v1/object/public/gallery/fielding-gloves/shop.jpg";
  const links = [
    { photo_url: linkedUrl, order_number: "0169", is_cover: true },
    {
      photo_url: describedUrl,
      order_number: null,
      brand_model: "Wilson A2000",
      glove_type: "Infield",
      web_type: "I-web",
      primary_lace_color: "Black",
      secondary_lace_color: "Tan"
    }
  ];
  const publicResult = await invoke({
    body: { action: "listGalleryPhotos" },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) return jsonResponse(links);
      equal(init.method, "POST");
      return jsonResponse([]);
    }
  });
  deepEqual(publicResult.json.photoLinks, { [linkedUrl]: "0169" });
  deepEqual(publicResult.json.photoCovers, { [linkedUrl]: true });
  deepEqual(publicResult.json.photoGloveMeta, {});

  const { owner } = await sessionTokens();
  const hiddenResult = await invoke({
    body: { action: "listGalleryPhotos", includeHidden: true, _token: owner },
    fetchMock(input, init, callNumber) {
      if (callNumber === 1) return jsonResponse(links);
      equal(init.method, "POST");
      return jsonResponse([]);
    }
  });
  deepEqual(hiddenResult.json.photoGloveMeta[describedUrl], {
    brandModel: "Wilson A2000",
    gloveType: "Infield",
    webType: "I-web",
    primaryLaceColor: "Black",
    secondaryLaceColor: "Tan"
  });
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

console.log("Registry-backed admin user actions");

const adminUserActions = [
  "listUsers",
  "createUserInvite",
  "setUserPassword",
  "updateUser",
  "deleteUser"
];

function validAdminActionBody(action, token) {
  const bodies = {
    listUsers: {},
    createUserInvite: { email: `${action}@example.com`, displayName: "Invitee", role: "admin" },
    setUserPassword: { userId: "target-user", password: "password123" },
    updateUser: { userId: "target-user", active: true },
    deleteUser: { userId: "target-user" }
  };
  return { action, _token: token, ...bodies[action] };
}

function successfulAdminActionFetch(input, init) {
  const url = String(input);
  if (url.includes("email=eq.admin%40example.com")) {
    return jsonResponse([{
      id: "user-admin",
      email: "admin@example.com",
      role: "admin",
      active: true
    }]);
  }
  if (url.includes("email=eq.createuserinvite%40example.com")) return jsonResponse([]);
  if (url.includes("?select=*&order=created_at.asc")) return jsonResponse([]);
  if (url.includes("/rest/v1/admin_users")) {
    ok(["POST", "PATCH", "DELETE"].includes(init.method));
    return jsonResponse([]);
  }
  return noNetworkFetch(input);
}

await test("all five admin-user actions reject before handler I/O", async () => {
  for (const action of adminUserActions) {
    const result = await invoke({ body: validAdminActionBody(action, undefined) });
    equal(result.response.status, 200, action);
    deepEqual(result.json, { ok: false, error: "Missing session token." }, action);
    equal(result.fetchCalls.length, 0, action);
  }
});

await test("owner token succeeds for all five admin-user actions", async () => {
  const { owner } = await sessionTokens();
  for (const action of adminUserActions) {
    const result = await invoke({
      body: validAdminActionBody(action, owner),
      fetchMock: successfulAdminActionFetch
    });
    equal(result.response.status, 200, action);
    equal(result.json?.ok, true, action);
  }
});

await test("active admin succeeds for all five admin-user actions", async () => {
  const { admin } = await sessionTokens();
  for (const action of adminUserActions) {
    const result = await invoke({
      body: validAdminActionBody(action, admin),
      fetchMock: successfulAdminActionFetch
    });
    equal(result.response.status, 200, action);
    equal(result.json?.ok, true, action);
    ok(result.fetchCalls[0].url.includes("email=eq.admin%40example.com"), action);
  }
});

await test("non-admin, inactive, and missing identities reject all five actions before handler I/O", async () => {
  const { user, admin } = await sessionTokens();
  const cases = [
    [user, [{
      id: "user-standard",
      email: "user@example.com",
      role: "demo",
      active: true
    }]],
    [admin, [{
      id: "user-admin",
      email: "admin@example.com",
      role: "admin",
      active: false
    }]],
    [admin, []]
  ];
  for (const action of adminUserActions) {
    for (const [token, rows] of cases) {
      const result = await invoke({
        body: validAdminActionBody(action, token),
        fetchMock: () => jsonResponse(rows)
      });
      deepEqual(result.json, { ok: false, error: "Admins only." }, action);
      equal(result.fetchCalls.length, 1, `${action} stops after identity lookup`);
    }
  }
});

await test("admin-user actions preserve global demo-token denial", async () => {
  const { demo } = await sessionTokens();
  for (const action of adminUserActions) {
    await assertDemoDenied(action, demo);
  }
});

await test("listUsers maps rows without sensitive account material", async () => {
  const { owner } = await sessionTokens();
  const result = await invoke({
    body: { action: "listUsers", _token: owner },
    fetchMock: () => jsonResponse([{
      id: "target-user",
      email: "target@example.com",
      display_name: "Target",
      role: "admin",
      active: true,
      password_hash: "secret-hash",
      password_salt: "secret-salt",
      password_iterations: 100000,
      invite_token: "secret-invite",
      invite_expires_at: "2030-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
      last_login_at: null
    }])
  });
  equal(result.json?.ok, true);
  equal(result.json?.users.length, 1);
  deepEqual(Object.keys(result.json.users[0]).sort(), [
    "active", "createdAt", "displayName", "email", "hasPassword", "id",
    "inviteExpiresAt", "invitePending", "lastLoginAt", "role"
  ]);
  equal(JSON.stringify(result.json).includes("secret-"), false);
});

await test("createUserInvite validates email and rejects duplicates in order", async () => {
  const { owner } = await sessionTokens();
  const invalid = await invoke({
    body: { action: "createUserInvite", _token: owner, email: "invalid" }
  });
  deepEqual(invalid.json, { ok: false, error: "Enter a valid email address." });
  equal(invalid.fetchCalls.length, 0);

  const duplicate = await invoke({
    body: { action: "createUserInvite", _token: owner, email: "DUP@example.com" },
    fetchMock: () => jsonResponse([{ id: "existing" }])
  });
  deepEqual(duplicate.json, { ok: false, error: "That email already has an account." });
  equal(duplicate.fetchCalls.length, 1);
  ok(duplicate.fetchCalls[0].url.includes("email=eq.dup%40example.com"));
});

await test("createUserInvite preserves role coercion, token, expiry, and missing-email behavior", async () => {
  const { owner } = await sessionTokens();
  for (const [inputRole, expectedRole] of [["admin", "admin"], ["demo", "demo"], ["staff", "demo"]]) {
    let inserted = null;
    const before = Date.now();
    const result = await invoke({
      body: {
        action: "createUserInvite",
        _token: owner,
        email: `${inputRole}@example.com`,
        displayName: "  New User  ",
        role: inputRole
      },
      fetchMock(input, init, callNumber) {
        if (callNumber === 1) return jsonResponse([]);
        inserted = JSON.parse(init.body);
        equal(init.method, "POST");
        return jsonResponse([]);
      }
    });
    equal(result.json?.ok, true);
    equal(result.json?.emailed, false);
    equal(inserted.email, `${inputRole}@example.com`);
    equal(inserted.display_name, "New User");
    equal(inserted.role, expectedRole);
    equal(inserted.active, true);
    equal(typeof inserted.invite_token, "string");
    ok(inserted.invite_token.length > 20);
    const expires = new Date(inserted.invite_expires_at).getTime();
    ok(expires >= before + 7 * 24 * 60 * 60 * 1000);
    ok(expires <= Date.now() + 7 * 24 * 60 * 60 * 1000);
    ok(result.json.inviteLink.endsWith(`/admin/?invite=${inserted.invite_token}`));
    equal(result.fetchCalls.length, 2);
  }
});

await test("createUserInvite preserves Resend success, failure, and preview suppression", async () => {
  const { owner } = await sessionTokens();
  for (const [status, emailed] of [[200, true], [500, false]]) {
    const result = await invoke({
      env: { ...CORE_ENV, RESEND_API_KEY: "resend-test" },
      body: { action: "createUserInvite", _token: owner, email: `mail${status}@example.com` },
      fetchMock(input, init, callNumber) {
        if (callNumber === 1) return jsonResponse([]);
        if (callNumber === 2) return jsonResponse([]);
        equal(String(input), "https://api.resend.com/emails");
        equal(init.method, "POST");
        return jsonResponse(status === 200 ? { id: "email-id" } : { error: "failed" }, status);
      }
    });
    equal(result.json?.ok, true);
    equal(result.json?.emailed, emailed);
    equal(result.fetchCalls.length, 3);
  }

  const preview = await invoke({
    env: { ...CORE_ENV, RESEND_API_KEY: "resend-test", MURPHOS_ENV: "preview" },
    body: { action: "createUserInvite", _token: owner, email: "preview@example.com" },
    fetchMock(input, init, callNumber) {
      if (callNumber <= 2) return jsonResponse([]);
      return noNetworkFetch(input);
    }
  });
  equal(preview.json?.ok, true);
  equal(preview.json?.emailed, true);
  equal(preview.fetchCalls.length, 2);
});

await test("setUserPassword validates and writes current PBKDF2 fields", async () => {
  const { owner } = await sessionTokens();
  for (const body of [{ password: "password123" }, { userId: "target", password: "short" }]) {
    const result = await invoke({ body: { action: "setUserPassword", _token: owner, ...body } });
    deepEqual(result.json, { ok: false, error: "Password must be at least 8 characters." });
    equal(result.fetchCalls.length, 0);
  }
  let payload;
  const result = await invoke({
    body: { action: "setUserPassword", _token: owner, userId: "target user", password: "password123" },
    fetchMock(input, init) {
      ok(String(input).includes("id=eq.target%20user"));
      equal(init.method, "PATCH");
      payload = JSON.parse(init.body);
      return jsonResponse([]);
    }
  });
  deepEqual(result.json, { ok: true });
  equal(typeof payload.password_hash, "string");
  equal(typeof payload.password_salt, "string");
  equal(payload.password_iterations, 100000);
  equal(payload.invite_token, null);
  equal(payload.invite_expires_at, null);
  equal(payload.active, true);
});

await test("updateUser preserves whitelist, coercion, and combined patch payload", async () => {
  const { owner } = await sessionTokens();
  const missing = await invoke({ body: { action: "updateUser", _token: owner, role: "admin" } });
  deepEqual(missing.json, { ok: false, error: "Missing user." });
  const empty = await invoke({ body: { action: "updateUser", _token: owner, userId: "target", ignored: true } });
  deepEqual(empty.json, { ok: false, error: "Nothing to update." });

  let payload;
  const result = await invoke({
    body: {
      action: "updateUser",
      _token: owner,
      userId: "target",
      role: "staff",
      active: 0,
      displayName: "  Renamed  ",
      ignored: "not written"
    },
    fetchMock(input, init) {
      equal(init.method, "PATCH");
      payload = JSON.parse(init.body);
      return jsonResponse([]);
    }
  });
  deepEqual(result.json, { ok: true });
  deepEqual(payload, { role: "demo", active: false, display_name: "Renamed" });
});

await test("deleteUser validates ID and preserves no-row success behavior", async () => {
  const { owner } = await sessionTokens();
  const missing = await invoke({ body: { action: "deleteUser", _token: owner } });
  deepEqual(missing.json, { ok: false, error: "Missing user." });
  equal(missing.fetchCalls.length, 0);
  const result = await invoke({
    body: { action: "deleteUser", _token: owner, userId: "missing row" },
    fetchMock(input, init) {
      ok(String(input).includes("id=eq.missing%20row"));
      equal(init.method, "DELETE");
      equal(init.headers.Prefer, "return=minimal");
      return jsonResponse([]);
    }
  });
  deepEqual(result.json, { ok: true });
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

await test("all v1.3 Bench Focus action names are registry-backed", async () => {
  const source = fs.readFileSync(new URL("../functions/api/orders.js", import.meta.url), "utf8");
  const registryMatch = source.match(/const ACTIONS = \{([\s\S]*?)\n\};/);
  ok(registryMatch, "ACTIONS registry is present");
  for (const action of ["getBenchFocus", "startBenchWork", "resumePausedLaborForBench", "snoozeBenchReminder", "endBenchWork", "resolveBenchWork"]) {
    equal(new RegExp(`^  ${action}: \\{`, "m").test(registryMatch[1]), true, `${action} is registry-backed`);
  }
});

await test("all production actions are registry-backed with no legacy chain", async () => {
  const source = fs.readFileSync(new URL("../functions/api/orders.js", import.meta.url), "utf8");
  const plan = fs.readFileSync(new URL("../.docs/V1_2_ACTION_REGISTRY_PLAN.md", import.meta.url), "utf8");
  const dispatcher = source.split("/* =========================\n   RESPONSE HELPERS")[0];
  const registryMatch = source.match(/const ACTIONS = \{([\s\S]*?)\n\};/);
  ok(registryMatch, "ACTIONS registry is present");
  const registryActions = [...registryMatch[1].matchAll(/^  ([A-Za-z][A-Za-z0-9]*): \{/gm)]
    .map(match => match[1]);
  const registryEntryStarts = [...registryMatch[1].matchAll(/^  ([A-Za-z][A-Za-z0-9]*): \{/gm)];
  const registryEntries = registryEntryStarts.map((match, index) => ({
    action: match[1],
    source: registryMatch[1].slice(
      match.index,
      index + 1 < registryEntryStarts.length
        ? registryEntryStarts[index + 1].index
        : registryMatch[1].length
    )
  }));

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
    "listUsers",
    "createUserInvite",
    "setUserPassword",
    "updateUser",
    "deleteUser",
    "getPushPublicKey",
    "savePushSubscription",
    "sendTestPush",
    "listMessages",
    "sendMessageReply",
    "markMessagesRead",
    "deleteMessage",
    "deleteMessageThread",
    "listOrders",
    "listInventory",
    "createInventoryItem",
    "updateInventoryItem",
    "getOrder",
    "listOrderActivity",
    "listOrdersWithActivity",
    "webauthnLoginOptions",
    "webauthnLoginVerify",
    "webauthnRegisterOptions",
    "webauthnRegisterVerify",
    "listLaborSessions",
    "startLaborSession",
    "stopLaborSession",
    "listOpenLaborSessions",
    "listLaborSummary",
    "pauseLaborSession",
    "resumeLaborSession",
    "updateLaborSessionNotes",
    "getBenchFocus",
    "startBenchWork",
    "resumePausedLaborForBench",
    "snoozeBenchReminder",
    "endBenchWork",
    "resolveBenchWork",
    "deleteOrder",
    "uploadOrderPhoto",
    "removeOrderPhoto",
    "createOrder",
    "resendStatusEmail",
    "resendStatusText",
    "updateOrder",
    "geocodeAddresses",
    "geocodeMissingOrderAddresses",
    "uploadGalleryPhoto",
    "listExpenses",
    "createExpense",
    "deleteExpense",
    "listServicePricing",
    "listServicePricingHistory",
    "saveServicePricingDraft",
    "discardServicePricingDraft",
    "publishServicePricing",
    "restoreServicePricingRevision",
    "createServicePricing",
    "getShopSettings",
    "saveShopSettings",
    "setGalleryPhotoCover",
    "setGalleryPhotoOrder",
    "moveGalleryPhoto",
    "hideGalleryPhoto",
    "restoreGalleryPhoto",
    "deleteGalleryPhoto",
    "listSaleGloves",
    "getSaleGlove",
    "createSaleGlove",
    "updateSaleGlove",
    "deleteSaleGlove",
    "uploadLacePhoto",
    "uploadSaleGlovePhoto",
    "listSaleGlovePhotos",
    "setSalePhotoPrimary",
    "setSalePhotoHover",
    "deleteSaleGlovePhoto",
    "searchPublicGloves",
    "listGalleryPhotos"
  ];
  const expectedDemoPolicies = new Map([
    ["login", "allow"],
    ["getInvite", "allow"],
    ["acceptInvite", "allow"],
    ["listUsers", "deny"],
    ["createUserInvite", "deny"],
    ["setUserPassword", "deny"],
    ["updateUser", "deny"],
    ["deleteUser", "deny"],
    ["getPushPublicKey", "deny"],
    ["savePushSubscription", "deny"],
    ["sendTestPush", "deny"],
    ["listMessages", "deny"],
    ["sendMessageReply", "deny"],
    ["markMessagesRead", "deny"],
    ["deleteMessage", "deny"],
    ["deleteMessageThread", "deny"],
    ["listOrders", "deny"],
    ["listInventory", "deny"],
    ["createInventoryItem", "deny"],
    ["updateInventoryItem", "deny"],
    ["getOrder", "deny"],
    ["listOrderActivity", "deny"],
    ["listOrdersWithActivity", "deny"],
    ["webauthnLoginOptions", "allow"],
    ["webauthnLoginVerify", "allow"],
    ["webauthnRegisterOptions", "deny"],
    ["webauthnRegisterVerify", "deny"],
    ["listLaborSessions", "deny"],
    ["startLaborSession", "deny"],
    ["stopLaborSession", "deny"],
    ["listOpenLaborSessions", "deny"],
    ["listLaborSummary", "deny"],
    ["pauseLaborSession", "deny"],
    ["resumeLaborSession", "deny"],
    ["updateLaborSessionNotes", "deny"],
    ["getBenchFocus", "deny"],
    ["startBenchWork", "deny"],
    ["resumePausedLaborForBench", "deny"],
    ["snoozeBenchReminder", "deny"],
    ["endBenchWork", "deny"],
    ["resolveBenchWork", "deny"],
    ["deleteOrder", "deny"],
    ["uploadOrderPhoto", "deny"],
    ["removeOrderPhoto", "deny"],
    ["createOrder", "deny"],
    ["resendStatusEmail", "deny"],
    ["resendStatusText", "deny"],
    ["updateOrder", "deny"],
    ["geocodeAddresses", "deny"],
    ["geocodeMissingOrderAddresses", "deny"],
    ["uploadGalleryPhoto", "deny"],
    ["listExpenses", "deny"],
    ["createExpense", "deny"],
    ["deleteExpense", "deny"],
    ["listServicePricing", "deny"],
    ["listServicePricingHistory", "deny"],
    ["saveServicePricingDraft", "deny"],
    ["discardServicePricingDraft", "deny"],
    ["publishServicePricing", "deny"],
    ["restoreServicePricingRevision", "deny"],
    ["createServicePricing", "deny"],
    ["getShopSettings", "deny"],
    ["saveShopSettings", "deny"],
    ["setGalleryPhotoCover", "deny"],
    ["setGalleryPhotoOrder", "deny"],
    ["moveGalleryPhoto", "deny"],
    ["hideGalleryPhoto", "deny"],
    ["restoreGalleryPhoto", "deny"],
    ["deleteGalleryPhoto", "deny"],
    ["listSaleGloves", "deny"],
    ["getSaleGlove", "deny"],
    ["createSaleGlove", "deny"],
    ["updateSaleGlove", "deny"],
    ["deleteSaleGlove", "deny"],
    ["uploadLacePhoto", "deny"],
    ["uploadSaleGlovePhoto", "deny"],
    ["listSaleGlovePhotos", "deny"],
    ["setSalePhotoPrimary", "deny"],
    ["setSalePhotoHover", "deny"],
    ["deleteSaleGlovePhoto", "deny"],
    ["searchPublicGloves", "deny"],
    ["listGalleryPhotos", "deny"]
  ]);
  const registryActionSet = new Set(expectedRegistryActions);
  const plannedLegacyActions = plannedActions.filter(action => !registryActionSet.has(action));
  const legacyCounts = new Map();
  for (const action of legacyActions) {
    legacyCounts.set(action, (legacyCounts.get(action) || 0) + 1);
  }

  deepEqual(registryActions, expectedRegistryActions);
  equal(registryActions.length, 82);
  const registeredHandlers = [];
  for (const entry of registryEntries) {
    ok(/\bauth\s*:/.test(entry.source), `${entry.action} has auth metadata`);
    ok(/\bdemo\s*:/.test(entry.source), `${entry.action} has demo metadata`);
    ok(/\beffects\s*:\s*\[/.test(entry.source), `${entry.action} has effects metadata`);
    ok(/\bbindings\s*:\s*\{/.test(entry.source), `${entry.action} has bindings metadata`);
    ok(/\brequired\s*:\s*\[/.test(entry.source), `${entry.action} has required bindings`);
    ok(/\boptional\s*:\s*\[/.test(entry.source), `${entry.action} has optional bindings`);
    const handler = entry.source.match(/\bhandler\s*:\s*(handle[A-Za-z0-9]+)/)?.[1];
    ok(handler, `${entry.action} has a named handler`);
    registeredHandlers.push(handler);
    ok(
      new RegExp(`async function ${handler}\\s*\\(`).test(source),
      `${entry.action} handler resolves`
    );
    const handlerSource = source.match(
      new RegExp(`async function ${handler}\\([\\s\\S]*?(?=\\nasync function |\\/\\* =========================)`)
    );
    ok(handlerSource, `${entry.action} handler source is inspectable`);
    equal(
      /validateTokenFromBody|body(?:\._token|\["_token"\]|\['_token'\])/.test(handlerSource[0]),
      false,
      `${entry.action} handler does not validate _token`
    );
  }
  equal(new Set(registeredHandlers).size, registeredHandlers.length);
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
    const expectedAuth = adminUserActions.includes(action)
      ? "admin"
      : [
          "listMessages", "listOrders", "listInventory", "getOrder",
          "sendMessageReply",
          "listOrderActivity", "listOrdersWithActivity", "listLaborSessions",
          "listOpenLaborSessions", "listLaborSummary", "geocodeAddresses",
          "listExpenses", "listServicePricing", "listServicePricingHistory",
          "getShopSettings", "listSaleGloves", "getSaleGlove", "listSaleGlovePhotos",
          "savePushSubscription", "sendTestPush", "markMessagesRead", "deleteMessage",
          "deleteMessageThread", "createInventoryItem", "updateInventoryItem",
          "startLaborSession", "stopLaborSession", "pauseLaborSession",
          "resumeLaborSession", "updateLaborSessionNotes", "createExpense",
          "getBenchFocus", "startBenchWork",
          "resumePausedLaborForBench",
          "snoozeBenchReminder", "endBenchWork", "resolveBenchWork",
          "deleteExpense", "saveShopSettings", "createSaleGlove",
          "updateSaleGlove", "deleteSaleGlove", "deleteOrder",
          "uploadOrderPhoto", "removeOrderPhoto", "createOrder",
          "resendStatusEmail", "resendStatusText", "updateOrder"
          , "uploadGalleryPhoto", "setGalleryPhotoCover", "setGalleryPhotoOrder",
          "moveGalleryPhoto", "hideGalleryPhoto", "restoreGalleryPhoto",
          "deleteGalleryPhoto", "uploadLacePhoto", "uploadSaleGlovePhoto",
          "setSalePhotoPrimary", "setSalePhotoHover", "deleteSaleGlovePhoto",
          "saveServicePricingDraft", "discardServicePricingDraft",
          "publishServicePricing", "restoreServicePricingRevision",
          "createServicePricing", "webauthnRegisterOptions",
          "webauthnRegisterVerify", "geocodeMissingOrderAddresses"
        ].includes(action) ? "session" : "public";
    if (action === "listGalleryPhotos") {
      ok(
        /listGalleryPhotos: \{[\s\S]*?body\.includeHidden === true \? "session" : "public"/.test(registryMatch[1]),
        "listGalleryPhotos retains strict conditional authorization"
      );
      continue;
    }
    ok(
      new RegExp(
        `^  ${action}: \\{[\\s\\S]*?auth: "${expectedAuth}",[\\s\\S]*?demo: "${expectedDemoPolicies.get(action)}",`,
        "m"
      ).test(registryMatch[1]),
      `${action} retains its authorization and demo policy`
    );
  }
  for (const handler of [
    "handleListUsers",
    "handleCreateUserInvite",
    "handleSetUserPassword",
    "handleUpdateUser",
    "handleDeleteUser"
  ]) {
    const handlerSource = source.match(
      new RegExp(`async function ${handler}\\([\\s\\S]*?(?=\\nasync function )`)
    );
    ok(handlerSource, `${handler} is present`);
    equal(handlerSource[0].includes("requireAdmin("), false, `${handler} does not reauthorize`);
    equal(
      /\bbody(?:\._token|\["_token"\]|\['_token'\])/.test(handlerSource[0]),
      false,
      `${handler} does not revalidate the token`
    );
  }
  for (const handler of [
    "handleListMessages", "handleListOrders", "handleListInventory", "handleGetOrder",
    "handleListOrderActivity", "handleListOrdersWithActivity", "handleListLaborSessions",
    "handleListOpenLaborSessions", "handleListLaborSummary", "handleGeocodeAddresses",
    "handleListExpenses", "handleListServicePricing", "handleListServicePricingHistory",
    "handleGetShopSettings", "handleListSaleGloves", "handleGetSaleGlove",
    "handleListSaleGlovePhotos", "handleSearchPublicGloves", "handleListGalleryPhotos"
  ]) {
    const handlerSource = source.match(
      new RegExp(`async function ${handler}\\([\\s\\S]*?(?=\\nasync function )`)
    );
    ok(handlerSource, `${handler} is present`);
    equal(
      /validateTokenFromBody|body(?:\._token|\["_token"\]|\['_token'\])/.test(handlerSource[0]),
      false,
      `${handler} relies on centralized authorization`
    );
  }
  for (const handler of [
    "handleSavePushSubscription", "handleSendTestPush", "handleMarkMessagesRead",
    "handleDeleteMessage", "handleDeleteMessageThread", "handleCreateInventoryItem",
    "handleUpdateInventoryItem", "handleStartLaborSession", "handleStopLaborSession",
    "handlePauseLaborSession", "handleResumeLaborSession", "handleUpdateLaborSessionNotes",
    "handleCreateExpense", "handleDeleteExpense", "handleSaveShopSettings",
    "handleCreateSaleGlove", "handleUpdateSaleGlove", "handleDeleteSaleGlove"
  ]) {
    const handlerSource = source.match(
      new RegExp(`async function ${handler}\\([\\s\\S]*?(?=\\nasync function )`)
    );
    ok(handlerSource, `${handler} is present`);
    equal(
      /validateTokenFromBody|body(?:\._token|\["_token"\]|\['_token'\])/.test(handlerSource[0]),
      false,
      `${handler} relies on centralized authorization`
    );
  }
  for (const handler of [
    "handleDeleteOrder", "handleUploadOrderPhoto", "handleRemoveOrderPhoto",
    "handleCreateOrder", "handleResendStatusEmail", "handleResendStatusText",
    "handleUpdateOrder"
  ]) {
    const handlerSource = source.match(
      new RegExp(`async function ${handler}\\([\\s\\S]*?(?=\\nasync function )`)
    );
    ok(handlerSource, `${handler} is present`);
    equal(
      /validateTokenFromBody|body(?:\._token|\["_token"\]|\['_token'\])/.test(handlerSource[0]),
      false,
      `${handler} relies on centralized authorization`
    );
  }
  for (const handler of [
    "handleSendMessageReply", "handleUploadGalleryPhoto", "handleSetGalleryPhotoCover",
    "handleSetGalleryPhotoOrder", "handleMoveGalleryPhoto", "handleHideGalleryPhoto",
    "handleRestoreGalleryPhoto", "handleDeleteGalleryPhoto", "handleUploadLacePhoto",
    "handleUploadSaleGlovePhoto", "handleSetSalePhotoPrimary",
    "handleSetSalePhotoHover", "handleDeleteSaleGlovePhoto"
  ]) {
    const handlerSource = source.match(
      new RegExp(`async function ${handler}\\([\\s\\S]*?(?=\\nasync function )`)
    );
    ok(handlerSource, `${handler} is present`);
    equal(
      /validateTokenFromBody|body(?:\._token|\["_token"\]|\['_token'\])/.test(handlerSource[0]),
      false,
      `${handler} relies on centralized authorization`
    );
  }
  for (const handler of [
    "handleSaveServicePricingDraft", "handleDiscardServicePricingDraft",
    "handlePublishServicePricing", "handleRestoreServicePricingRevision",
    "handleCreateServicePricing"
  ]) {
    const handlerSource = source.match(
      new RegExp(`async function ${handler}\\([\\s\\S]*?(?=\\nasync function )`)
    );
    ok(handlerSource, `${handler} is present`);
    equal(
      /validateTokenFromBody|body(?:\._token|\["_token"\]|\['_token'\])/.test(handlerSource[0]),
      false,
      `${handler} relies on centralized authorization`
    );
  }
  for (const handler of [
    "handleWebauthnRegisterOptions", "handleWebauthnRegisterVerify",
    "handleGeocodeMissingOrderAddresses"
  ]) {
    const handlerSource = source.match(
      new RegExp(`async function ${handler}\\([\\s\\S]*?(?=\\nasync function |\\/\\* =========================)`)
    );
    ok(handlerSource, `${handler} is present`);
    equal(
      /validateTokenFromBody|body(?:\._token|\["_token"\]|\['_token'\])/.test(handlerSource[0]),
      false,
      `${handler} relies on centralized authorization`
    );
  }
  equal(legacyActions.length, 0);
  equal(new Set(legacyActions).size, 0);
  equal(/if\s*\([^)]*\baction ===/.test(dispatcher), false);
  equal(plannedActions.length, 76);
  deepEqual(legacyActions, plannedLegacyActions);
  deepEqual([...legacyCounts.entries()].filter(([, count]) => count !== 1), []);
  deepEqual(
    [...registryActions, ...legacyActions].sort(),
    [...plannedActions, "getBenchFocus", "startBenchWork", "resumePausedLaborForBench", "snoozeBenchReminder", "endBenchWork", "resolveBenchWork"].sort()
  );
});

console.log(`\n${testCount} tests, ${assertionCount} assertions passed`);
