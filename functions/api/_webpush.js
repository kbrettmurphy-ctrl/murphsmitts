/* Dependency-free Web Push for Cloudflare Workers.
   VAPID (RFC 8292, ES256 JWT) + payload encryption (RFC 8291, aes128gcm),
   using only WebCrypto. Subscriptions live in public.push_subscriptions;
   dead endpoints (404/410) are pruned automatically. */

function b64uToBytes(s) {
  const b = String(s || "").replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s || "").length + 3) % 4);
  const bin = atob(b);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64u(bytes) {
  let bin = "";
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function concatBytes(...arrs) {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    len * 8
  );
  return new Uint8Array(bits);
}

async function vapidJwt(env, audience) {
  const pub = b64uToBytes(env.VAPID_PUBLIC_KEY); // 0x04||x||y
  const jwk = {
    kty: "EC", crv: "P-256",
    x: bytesToB64u(pub.slice(1, 33)),
    y: bytesToB64u(pub.slice(33, 65)),
    d: env.VAPID_PRIVATE_KEY,
    ext: true
  };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const enc = new TextEncoder();
  const header = bytesToB64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64u(enc.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: "mailto:murphsmitts@gmail.com"
  })));
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${payload}`)
  );
  return `${header}.${payload}.${bytesToB64u(sig)}`;
}

/* RFC 8291: encrypt payload for one subscription. */
async function encryptPayload(payloadText, p256dhB64u, authB64u) {
  const uaPublic = b64uToBytes(p256dhB64u);
  const authSecret = b64uToBytes(authB64u);

  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const uaKey = await crypto.subtle.importKey(
    "raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []
  );
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));

  const enc = new TextEncoder();
  const keyInfo = concatBytes(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdh, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const plaintext = concatBytes(enc.encode(payloadText), new Uint8Array([2])); // 0x02 = last record
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plaintext));

  // aes128gcm header: salt(16) | rs(4) | idlen(1) | keyid(65)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concatBytes(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

async function pushToSubscription(env, sub, payloadText) {
  const url = new URL(sub.endpoint);
  const jwt = await vapidJwt(env, `${url.protocol}//${url.host}`);
  const body = await encryptPayload(payloadText, sub.p256dh, sub.auth);

  const resp = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      TTL: "86400",
      Urgency: "high",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`
    },
    body
  });
  return resp.status;
}

async function supa(env, path, options = {}) {
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
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: resp.ok, data };
}

/* Send a notification to every registered device. Never throws. */
export async function sendWebPushToAll(env, { title, body, url }) {
  try {
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;
    const list = await supa(env, `/rest/v1/push_subscriptions?select=*`);
    if (!list.ok || !Array.isArray(list.data) || !list.data.length) return;

    const payload = JSON.stringify({ title, body, url: url || "/admin/" });
    for (const sub of list.data) {
      try {
        const status = await pushToSubscription(env, sub, payload);
        if (status === 404 || status === 410) {
          await supa(env, `/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`, {
            method: "DELETE", headers: { Prefer: "return=minimal" }
          });
        }
      } catch { /* one bad device never blocks the rest */ }
    }
  } catch { /* push is best-effort */ }
}
