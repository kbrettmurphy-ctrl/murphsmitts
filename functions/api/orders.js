import { sendWebPushToAll } from "./_webpush.js";

export async function onRequest(context) {
  const { request, env } = context;

  const jsonHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  if (request.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        message: "admin-api is alive"
      }),
      { status: 200, headers: jsonHeaders }
    );
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Method not allowed: ${request.method}`
      }),
      { status: 405, headers: jsonHeaders }
    );
  }

  try {
    const bodyText = await request.text();
    const body = bodyText ? JSON.parse(bodyText) : {};
    const action = String(body.action || "").trim();

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return json(
        {
          ok: false,
          error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable."
        },
        500,
        jsonHeaders
      );
    }

    if (!env.ADMIN_PIN || !env.ADMIN_SESSION_SECRET) {
      return json(
        {
          ok: false,
          error: "Missing ADMIN_PIN or ADMIN_SESSION_SECRET environment variable."
        },
        500,
        jsonHeaders
      );
    }

    /* Hard safety guarantee: the demo role can never reach any real-data
       action. Demo clients serve their sandbox entirely in the browser and
       don't call these endpoints; this server-side block is the backstop, so
       even a client bug or a crafted request can't read or write real data.
       The token role is signed by us, so it can't be forged. */
    const DEMO_ALLOWED_ACTIONS = new Set([
      "login", "getInvite", "acceptInvite",
      "webauthnLoginOptions", "webauthnLoginVerify"
    ]);
    if (!DEMO_ALLOWED_ACTIONS.has(action)) {
      const demoAuth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (demoAuth.ok && demoAuth.payload && demoAuth.payload.role === "demo") {
        return json(
          { ok: false, error: "Demo mode: that action runs in your sandbox only.", demo: true },
          200,
          jsonHeaders
        );
      }
    }

    if (action === "login") {
      const email = normalizeEmail(body.email);
      const password = String(body.password || body.pin || "").trim();
      const sessionMs = 1000 * 60 * 60 * 24 * 14;

      /* Owner escape hatch: blank email + the ADMIN_PIN. Keeps the owner able
         to sign in anywhere (including preview URLs where the passkey's domain
         binding doesn't apply) with zero lockout risk. */
      if (!email && password && env.ADMIN_PIN && password === String(env.ADMIN_PIN).trim()) {
        const token = await createSignedToken(
          { sub: "owner", role: "admin", exp: Date.now() + sessionMs },
          env.ADMIN_SESSION_SECRET
        );
        return json({ ok: true, token, role: "admin" }, 200, jsonHeaders);
      }

      if (!email || !password) {
        return json({ ok: false, error: "Enter your email and password." }, 200, jsonHeaders);
      }

      const found = await getUserByEmail(env, email);
      if (!found.ok) {
        return json({ ok: false, error: "Could not sign in." }, 200, jsonHeaders);
      }

      const user = found.user;
      const passwordOk = user && user.active !== false && await verifyPassword(password, {
        hash: user.password_hash,
        salt: user.password_salt,
        iterations: user.password_iterations
      });

      if (!passwordOk) {
        return json({ ok: false, error: "Invalid email or password." }, 200, jsonHeaders);
      }

      await touchUserLogin(env, user.id);

      const token = await createSignedToken(
        { sub: user.id, email: user.email, role: user.role, exp: Date.now() + sessionMs },
        env.ADMIN_SESSION_SECRET
      );

      return json({ ok: true, token, role: user.role }, 200, jsonHeaders);
    }

    if (action === "getInvite") {
      const found = await getUserByInviteToken(env, body.token);
      const user = found.ok ? found.user : null;
      if (!user || !user.invite_token) {
        return json({ ok: false, error: "This invite is invalid or already used." }, 200, jsonHeaders);
      }
      if (user.invite_expires_at && Date.now() > new Date(user.invite_expires_at).getTime()) {
        return json({ ok: false, error: "This invite has expired." }, 200, jsonHeaders);
      }
      return json({ ok: true, email: user.email, displayName: user.display_name, role: user.role }, 200, jsonHeaders);
    }

    if (action === "acceptInvite") {
      const password = String(body.password || "").trim();
      if (password.length < 8) {
        return json({ ok: false, error: "Password must be at least 8 characters." }, 200, jsonHeaders);
      }
      const found = await getUserByInviteToken(env, body.token);
      const user = found.ok ? found.user : null;
      if (!user || !user.invite_token) {
        return json({ ok: false, error: "This invite is invalid or already used." }, 200, jsonHeaders);
      }
      if (user.invite_expires_at && Date.now() > new Date(user.invite_expires_at).getTime()) {
        return json({ ok: false, error: "This invite has expired." }, 200, jsonHeaders);
      }

      const hashed = await hashPassword(password);
      const resp = await supabaseFetch(
        env,
        `/rest/v1/admin_users?id=eq.${encodeURIComponent(user.id)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            password_hash: hashed.hash,
            password_salt: hashed.salt,
            password_iterations: hashed.iterations,
            invite_token: null,
            invite_expires_at: null,
            active: true,
            last_login_at: new Date().toISOString()
          })
        }
      );
      if (!resp.ok) {
        return json({ ok: false, error: "Could not set your password." }, 200, jsonHeaders);
      }

      await sendWebPushToAll(env, {
        title: "Invite accepted",
        body: `${user.display_name || user.email} set their password (${user.role}).`,
        url: "/admin/?view=users"
      });

      const token = await createSignedToken(
        { sub: user.id, email: user.email, role: user.role, exp: Date.now() + 1000 * 60 * 60 * 24 * 14 },
        env.ADMIN_SESSION_SECRET
      );
      return json({ ok: true, token, role: user.role }, 200, jsonHeaders);
    }

    if (action === "listUsers") {
      const gate = await requireAdmin(env, body);
      if (!gate.ok) return json(gate, 200, jsonHeaders);
      const resp = await supabaseFetch(env, `/rest/v1/admin_users?select=*&order=created_at.asc`);
      if (!resp.ok) return json({ ok: false, error: "Could not load users." }, 200, jsonHeaders);
      return json({ ok: true, users: (resp.data || []).map(mapUserFromDb) }, 200, jsonHeaders);
    }

    if (action === "createUserInvite") {
      const gate = await requireAdmin(env, body);
      if (!gate.ok) return json(gate, 200, jsonHeaders);

      const email = normalizeEmail(body.email);
      const displayName = cleanText(body.displayName);
      const role = body.role === "admin" ? "admin" : "demo";
      if (!email || !email.includes("@")) {
        return json({ ok: false, error: "Enter a valid email address." }, 200, jsonHeaders);
      }
      const existing = await getUserByEmail(env, email);
      if (existing.ok && existing.user) {
        return json({ ok: false, error: "That email already has an account." }, 200, jsonHeaders);
      }

      const token = randomChallengeB64Url();
      const insert = await supabaseFetch(env, `/rest/v1/admin_users`, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          email,
          display_name: displayName,
          role,
          active: true,
          invite_token: token,
          invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        })
      });
      if (!insert.ok) {
        return json({ ok: false, error: "Could not create the account." }, 200, jsonHeaders);
      }

      const link = `${getInviteBaseUrl(env)}/admin/?invite=${encodeURIComponent(token)}`;
      let emailed = false;
      if (env.RESEND_API_KEY) {
        const send = await sendBrandedEmail(env, {
          to: email,
          subject: "Your Murph's Mitts admin invite",
          plainBody: `You've been invited to the Murph's Mitts admin as a ${role} user.\n\nSet your password to get started:\n${link}\n\nThis link expires in 7 days.`,
          htmlBody: `<p>You've been invited to the Murph's Mitts admin as a <strong>${role}</strong> user.</p><p><a href="${link}">Set your password to get started</a></p><p>This link expires in 7 days.</p>`
        });
        emailed = !!send.ok;
      }

      return json({ ok: true, inviteLink: link, emailed }, 200, jsonHeaders);
    }

    if (action === "setUserPassword") {
      const gate = await requireAdmin(env, body);
      if (!gate.ok) return json(gate, 200, jsonHeaders);
      const userId = cleanText(body.userId);
      const password = String(body.password || "").trim();
      if (!userId || password.length < 8) {
        return json({ ok: false, error: "Password must be at least 8 characters." }, 200, jsonHeaders);
      }
      const hashed = await hashPassword(password);
      const resp = await supabaseFetch(
        env,
        `/rest/v1/admin_users?id=eq.${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            password_hash: hashed.hash,
            password_salt: hashed.salt,
            password_iterations: hashed.iterations,
            invite_token: null,
            invite_expires_at: null,
            active: true
          })
        }
      );
      if (!resp.ok) return json({ ok: false, error: "Could not set the password." }, 200, jsonHeaders);
      return json({ ok: true }, 200, jsonHeaders);
    }

    if (action === "updateUser") {
      const gate = await requireAdmin(env, body);
      if (!gate.ok) return json(gate, 200, jsonHeaders);
      const userId = cleanText(body.userId);
      if (!userId) return json({ ok: false, error: "Missing user." }, 200, jsonHeaders);

      const updates = {};
      if ("role" in body) updates.role = body.role === "admin" ? "admin" : "demo";
      if ("active" in body) updates.active = !!body.active;
      if ("displayName" in body) updates.display_name = cleanText(body.displayName);
      if (!Object.keys(updates).length) {
        return json({ ok: false, error: "Nothing to update." }, 200, jsonHeaders);
      }

      const resp = await supabaseFetch(
        env,
        `/rest/v1/admin_users?id=eq.${encodeURIComponent(userId)}`,
        { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(updates) }
      );
      if (!resp.ok) return json({ ok: false, error: "Could not update the user." }, 200, jsonHeaders);
      return json({ ok: true }, 200, jsonHeaders);
    }

    if (action === "deleteUser") {
      const gate = await requireAdmin(env, body);
      if (!gate.ok) return json(gate, 200, jsonHeaders);
      const userId = cleanText(body.userId);
      if (!userId) return json({ ok: false, error: "Missing user." }, 200, jsonHeaders);
      const resp = await supabaseFetch(
        env,
        `/rest/v1/admin_users?id=eq.${encodeURIComponent(userId)}`,
        { method: "DELETE", headers: { Prefer: "return=minimal" } }
      );
      if (!resp.ok) return json({ ok: false, error: "Could not remove the user." }, 200, jsonHeaders);
      return json({ ok: true }, 200, jsonHeaders);
    }

    if (action === "getPushPublicKey") {
      return json({ ok: true, publicKey: env.VAPID_PUBLIC_KEY || "" }, 200, jsonHeaders);
    }

    if (action === "savePushSubscription") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) return json(auth, 200, jsonHeaders);
      const sub = body.subscription || {};
      const keys = sub.keys || {};
      if (!sub.endpoint || !keys.p256dh || !keys.auth) {
        return json({ ok: false, error: "Invalid subscription." }, 200, jsonHeaders);
      }
      const resp = await supabaseFetch(env, `/rest/v1/push_subscriptions?on_conflict=endpoint`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth,
          label: cleanText(body.label) || null, last_used_at: new Date().toISOString()
        })
      });
      if (!resp.ok) return json({ ok: false, error: "Could not save subscription." }, 200, jsonHeaders);
      return json({ ok: true }, 200, jsonHeaders);
    }

    if (action === "sendTestPush") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) return json(auth, 200, jsonHeaders);
      await sendWebPushToAll(env, { title: "MurphOS", body: "Push notifications are working.", url: "/admin/" });
      return json({ ok: true }, 200, jsonHeaders);
    }

    if (action === "listMessages") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) return json(auth, 200, jsonHeaders);
      const resp = await supabaseFetch(
        env,
        `/rest/v1/sms_messages?select=*&order=created_at.desc&limit=300`
      );
      if (!resp.ok) return json({ ok: false, error: "Could not load messages." }, 200, jsonHeaders);
      return json({ ok: true, messages: (resp.data || []).map(mapSmsMessage) }, 200, jsonHeaders);
    }

    if (action === "markMessagesRead") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) return json(auth, 200, jsonHeaders);
      const phone = cleanText(body.phoneNumber);
      const path = phone
        ? `/rest/v1/sms_messages?phone_number=eq.${encodeURIComponent(phone)}&read=eq.false`
        : `/rest/v1/sms_messages?read=eq.false`;
      const resp = await supabaseFetch(env, path, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ read: true })
      });
      if (!resp.ok) return json({ ok: false, error: "Could not update messages." }, 200, jsonHeaders);
      return json({ ok: true }, 200, jsonHeaders);
    }

    if (action === "deleteMessage") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) return json(auth, 200, jsonHeaders);
      const id = cleanText(body.id);
      if (!id) return json({ ok: false, error: "Missing message id." }, 200, jsonHeaders);
      const resp = await supabaseFetch(
        env,
        `/rest/v1/sms_messages?id=eq.${encodeURIComponent(id)}`,
        { method: "DELETE", headers: { Prefer: "return=minimal" } }
      );
      if (!resp.ok) return json({ ok: false, error: "Could not delete the message." }, 200, jsonHeaders);
      return json({ ok: true }, 200, jsonHeaders);
    }

    if (action === "deleteMessageThread") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) return json(auth, 200, jsonHeaders);
      const phones = Array.isArray(body.phoneNumbers) ? body.phoneNumbers.filter(Boolean).slice(0, 20) : [];
      if (!phones.length) return json({ ok: false, error: "Missing phone numbers." }, 200, jsonHeaders);
      const inList = phones.map(pn => `"${String(pn).replace(/"/g, "")}"`).join(",");
      const resp = await supabaseFetch(
        env,
        `/rest/v1/sms_messages?phone_number=in.(${encodeURIComponent(inList)})`,
        { method: "DELETE", headers: { Prefer: "return=minimal" } }
      );
      if (!resp.ok) return json({ ok: false, error: "Could not delete the conversation." }, 200, jsonHeaders);
      return json({ ok: true }, 200, jsonHeaders);
    }

    if (action === "sendMessageReply") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) return json(auth, 200, jsonHeaders);

      const to = toE164US(body.phoneNumber);
      const text = cleanText(body.body);
      const mediaDataUrl = String(body.mediaDataUrl || "");
      if (!to) return json({ ok: false, error: "Invalid phone number." }, 200, jsonHeaders);
      if (!text && !mediaDataUrl) return json({ ok: false, error: "Enter a message." }, 200, jsonHeaders);
      if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_MESSAGING_SERVICE_SID) {
        return json({ ok: false, error: "Twilio is not configured." }, 200, jsonHeaders);
      }

      let mediaUrl = null;
      if (mediaDataUrl.startsWith("data:image/")) {
        const contentType = mediaDataUrl.slice(5, mediaDataUrl.indexOf(";"));
        const b64 = mediaDataUrl.slice(mediaDataUrl.indexOf(",") + 1);
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const ext = contentType.includes("png") ? "png" : "jpg";
        const path = `sms-out/${Date.now()}.${ext}`;
        const up = await fetch(`${env.SUPABASE_URL}/storage/v1/object/order-photos/${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": contentType,
            "x-upsert": "true"
          },
          body: bytes
        });
        if (!up.ok) return json({ ok: false, error: "Photo upload failed." }, 200, jsonHeaders);
        mediaUrl = `${env.SUPABASE_URL}/storage/v1/object/public/order-photos/${path}`;
      }

      const sent = await sendTwilioSms(env, to, text, mediaUrl);
      if (!sent.ok) {
        return json({ ok: false, error: "Message failed to send.", details: sent.error }, 200, jsonHeaders);
      }

      await supabaseFetch(env, `/rest/v1/sms_messages`, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          direction: "out",
          phone_number: to,
          customer_name: cleanText(body.customerName) || null,
          order_number: cleanText(body.orderNumber) || null,
          body: text,
          media_urls: mediaUrl ? [mediaUrl] : null,
          twilio_sid: sent.sid || null,
          read: true
        })
      });

      return json({ ok: true }, 200, jsonHeaders);
    }

    if (action === "listOrders") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const supa = await supabaseFetch(
        env,
        `/rest/v1/orders?select=*&order=order_number.desc`
      );

      if (!supa.ok) {
        return json(
          {
            ok: false,
            error: "Failed to load orders from Supabase.",
            details: supa.error
          },
          200,
          jsonHeaders
        );
      }

      return json(
        {
          ok: true,
          orders: (supa.data || []).map(mapOrderFromDb)
        },
        200,
        jsonHeaders
      );
    }

    if (action === "listInventory") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const supa = await supabaseFetch(
        env,
        `/rest/v1/lace_inventory?select=*&order=color.asc`
      );

      if (!supa.ok) {
        return json(
          {
            ok: false,
            error: "Failed to load lace inventory from Supabase.",
            details: supa.error
          },
          200,
          jsonHeaders
        );
      }

      return json(
        {
          ok: true,
          inventory: supa.data || []
        },
        200,
        jsonHeaders
      );
    }

    if (action === "createInventoryItem") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const result = await createInventoryItem(env, body);
      return json(result, 200, jsonHeaders);
    }

    if (action === "updateInventoryItem") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const result = await updateInventoryItem(env, body);
      return json(result, 200, jsonHeaders);
    }

    if (action === "getOrder") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const orderNumber = String(body.orderNumber || "").trim();
      if (!orderNumber) {
        return json(
          {
            ok: false,
            error: "Missing orderNumber."
          },
          200,
          jsonHeaders
        );
      }

      const existing = await fetchOrderByNumber(env, orderNumber);
      if (!existing.ok || !existing.data) {
        return json(
          {
            ok: false,
            error: "Order not found."
          },
          200,
          jsonHeaders
        );
      }

      return json(
        {
          ok: true,
          order: mapOrderFromDb(existing.data)
        },
        200,
        jsonHeaders
      );
    }

    if (action === "listOrderActivity") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const orderNumber = cleanText(body.orderNumber);
      if (!orderNumber) {
        return json({ ok: false, error: "Missing orderNumber." }, 200, jsonHeaders);
      }

      const result = await listOrderActivity(env, orderNumber);
      if (!result.ok) {
        return json(
          {
            ok: false,
            error: "Activity could not be loaded.",
            details: result.error
          },
          200,
          jsonHeaders
        );
      }

      return json({ ok: true, activity: result.activity }, 200, jsonHeaders);
    }

    if (action === "listOrdersWithActivity") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const result = await listOrdersWithActivity(env);
      if (!result.ok) {
        return json(
          {
            ok: false,
            error: "Activity index could not be loaded.",
            details: result.error
          },
          200,
          jsonHeaders
        );
      }

      return json({ ok: true, orderNumbers: result.orderNumbers }, 200, jsonHeaders);
    }

    if (action === "webauthnRegisterOptions") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const cfg = getWebauthnConfig(env);
      const challenge = randomChallengeB64Url();
      const challengeToken = await createChallengeToken("reg", challenge, env.ADMIN_SESSION_SECRET);

      const existing = await listWebauthnCredentials(env);
      const excludeCredentials = (existing.ok ? existing.credentials : []).map(cred => ({
        id: cred.credential_id,
        type: "public-key"
      }));

      return json(
        {
          ok: true,
          challengeToken,
          options: {
            challenge,
            rp: { id: cfg.rpId, name: cfg.rpName },
            user: {
              id: arrayBufferToBase64Url(new TextEncoder().encode(cfg.userId)),
              name: cfg.userName,
              displayName: cfg.userDisplayName
            },
            pubKeyCredParams: [{ type: "public-key", alg: -7 }],
            authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
            timeout: 60000,
            attestation: "none",
            excludeCredentials
          }
        },
        200,
        jsonHeaders
      );
    }

    if (action === "webauthnRegisterVerify") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const cfg = getWebauthnConfig(env);
      const chk = await verifyChallengeToken(body.challengeToken, "reg", env.ADMIN_SESSION_SECRET);
      if (!chk.ok) {
        return json({ ok: false, error: chk.error }, 200, jsonHeaders);
      }

      const cred = body.credential || {};
      const resp = cred.response || {};

      let clientData;
      try {
        clientData = JSON.parse(new TextDecoder().decode(base64UrlToBytes(resp.clientDataJSON)));
      } catch {
        return json({ ok: false, error: "Could not read passkey response." }, 200, jsonHeaders);
      }

      if (clientData.type !== "webauthn.create") {
        return json({ ok: false, error: "Unexpected passkey ceremony." }, 200, jsonHeaders);
      }
      if (clientData.challenge !== chk.challenge) {
        return json({ ok: false, error: "Passkey challenge mismatch." }, 200, jsonHeaders);
      }
      if (!cfg.origins.includes(clientData.origin)) {
        return json({ ok: false, error: "Passkey origin mismatch." }, 200, jsonHeaders);
      }

      let authDataInfo;
      let keyInfo;
      let credentialIdB64;
      try {
        const attestation = cborDecodeFirst(base64UrlToBytes(resp.attestationObject));
        authDataInfo = parseAuthData(attestation.get("authData"));
        if (!authDataInfo.at || !authDataInfo.credentialPublicKey) {
          throw new Error("Passkey did not include a credential.");
        }
        const expectedRpIdHash = await sha256Bytes(cfg.rpId);
        if (!bytesEqual(authDataInfo.rpIdHash, expectedRpIdHash)) {
          throw new Error("Passkey domain mismatch.");
        }
        if (!authDataInfo.up) {
          throw new Error("Passkey user presence missing.");
        }
        keyInfo = coseToKeyInfo(authDataInfo.credentialPublicKey);
        credentialIdB64 = arrayBufferToBase64Url(authDataInfo.credentialId);
      } catch (err) {
        return json({ ok: false, error: err.message || "Passkey could not be verified." }, 200, jsonHeaders);
      }

      const stored = await insertWebauthnCredential(env, {
        credential_id: credentialIdB64,
        public_key: JSON.stringify(keyInfo),
        sign_count: authDataInfo.signCount,
        transports: Array.isArray(cred.transports) && cred.transports.length ? cred.transports.join(",") : null,
        label: cleanText(body.label) || "Passkey"
      });

      if (!stored.ok) {
        return json({ ok: false, error: "Could not save passkey.", details: stored.error }, 200, jsonHeaders);
      }

      return json({ ok: true }, 200, jsonHeaders);
    }

    if (action === "webauthnLoginOptions") {
      const cfg = getWebauthnConfig(env);
      const existing = await listWebauthnCredentials(env);
      const creds = existing.ok ? existing.credentials : [];
      const challenge = randomChallengeB64Url();
      const challengeToken = await createChallengeToken("auth", challenge, env.ADMIN_SESSION_SECRET);

      return json(
        {
          ok: true,
          hasCredentials: creds.length > 0,
          challengeToken,
          options: {
            challenge,
            rpId: cfg.rpId,
            timeout: 60000,
            userVerification: "preferred",
            allowCredentials: creds.map(cred => ({ id: cred.credential_id, type: "public-key" }))
          }
        },
        200,
        jsonHeaders
      );
    }

    if (action === "webauthnLoginVerify") {
      const cfg = getWebauthnConfig(env);
      const chk = await verifyChallengeToken(body.challengeToken, "auth", env.ADMIN_SESSION_SECRET);
      if (!chk.ok) {
        return json({ ok: false, error: chk.error }, 200, jsonHeaders);
      }

      const cred = body.credential || {};
      const resp = cred.response || {};
      const credentialId = cleanText(cred.id) || cleanText(cred.rawId);
      if (!credentialId) {
        return json({ ok: false, error: "Missing passkey id." }, 200, jsonHeaders);
      }

      const record = await getWebauthnCredential(env, credentialId);
      if (!record.ok || !record.credential) {
        return json({ ok: false, error: "This passkey is not registered." }, 200, jsonHeaders);
      }

      let clientData;
      try {
        clientData = JSON.parse(new TextDecoder().decode(base64UrlToBytes(resp.clientDataJSON)));
      } catch {
        return json({ ok: false, error: "Could not read passkey response." }, 200, jsonHeaders);
      }

      if (clientData.type !== "webauthn.get") {
        return json({ ok: false, error: "Unexpected passkey ceremony." }, 200, jsonHeaders);
      }
      if (clientData.challenge !== chk.challenge) {
        return json({ ok: false, error: "Passkey challenge mismatch." }, 200, jsonHeaders);
      }
      if (!cfg.origins.includes(clientData.origin)) {
        return json({ ok: false, error: "Passkey origin mismatch." }, 200, jsonHeaders);
      }

      let valid = false;
      let newSignCount = 0;
      try {
        const authDataBytes = base64UrlToBytes(resp.authenticatorData);
        const info = parseAuthData(authDataBytes);
        const expectedRpIdHash = await sha256Bytes(cfg.rpId);
        if (!bytesEqual(info.rpIdHash, expectedRpIdHash)) {
          throw new Error("Passkey domain mismatch.");
        }
        if (!info.up) {
          throw new Error("Passkey user presence missing.");
        }
        newSignCount = info.signCount;
        const keyInfo = JSON.parse(record.credential.public_key);
        valid = await verifyAssertionSignature(
          keyInfo,
          authDataBytes,
          base64UrlToBytes(resp.clientDataJSON),
          base64UrlToBytes(resp.signature)
        );
      } catch (err) {
        return json({ ok: false, error: err.message || "Passkey could not be verified." }, 200, jsonHeaders);
      }

      if (!valid) {
        return json({ ok: false, error: "Passkey signature was invalid." }, 200, jsonHeaders);
      }

      /* Counter is stored for the record but not hard-enforced: iCloud-synced
         passkeys routinely report a sign count of 0, so a strict monotonic
         check would lock out legitimate Face ID logins. */
      const storedCount = Number(record.credential.sign_count) || 0;
      await touchWebauthnCredential(env, credentialId, Math.max(storedCount, newSignCount));

      const token = await createSignedToken(
        {
          sub: "owner",
          role: "admin",
          exp: Date.now() + 1000 * 60 * 60 * 24 * 14
        },
        env.ADMIN_SESSION_SECRET
      );

      return json({ ok: true, token, role: "admin" }, 200, jsonHeaders);
    }

    if (action === "listLaborSessions") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const orderNumber = cleanText(body.orderNumber);
      if (!orderNumber) {
        return json({ ok: false, error: "Missing orderNumber." }, 200, jsonHeaders);
      }

      const result = await listLaborSessions(env, orderNumber);
      if (!result.ok) {
        return json(
          {
            ok: false,
            error: "Labor sessions could not be loaded.",
            details: result.error
          },
          200,
          jsonHeaders
        );
      }

      return json({ ok: true, sessions: result.sessions }, 200, jsonHeaders);
    }

    if (action === "startLaborSession") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const orderNumber = cleanText(body.orderNumber);
      const phase = cleanText(body.phase);
      if (!orderNumber) {
        return json({ ok: false, error: "Missing orderNumber." }, 200, jsonHeaders);
      }
      if (!phase) {
        return json({ ok: false, error: "Select a phase before starting the timer." }, 200, jsonHeaders);
      }
      if (!isValidLaborPhase(phase)) {
        return json({ ok: false, error: "Invalid labor phase." }, 200, jsonHeaders);
      }

      const result = await startLaborSession(env, {
        orderNumber,
        phase,
        notes: body.notes
      });
      if (!result.ok) {
        return json(
          {
            ok: false,
            error: result.error || "Labor session could not be started.",
            details: result.details
          },
          200,
          jsonHeaders
        );
      }

      return json({ ok: true, session: result.session }, 200, jsonHeaders);
    }

    if (action === "stopLaborSession") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const sessionId = cleanText(body.sessionId);
      if (!sessionId) {
        return json({ ok: false, error: "Missing sessionId." }, 200, jsonHeaders);
      }

      const result = await stopLaborSession(env, {
        sessionId,
        notes: body.notes
      });
      if (!result.ok) {
        return json(
          {
            ok: false,
            error: result.error || "Labor session could not be stopped.",
            details: result.details
          },
          200,
          jsonHeaders
        );
      }

      return json({ ok: true, session: result.session }, 200, jsonHeaders);
    }

    if (action === "listOpenLaborSessions") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const result = await fetchOpenLaborSessions(env);
      if (!result.ok) {
        return json(
          {
            ok: false,
            error: "Open labor sessions could not be loaded.",
            details: result.error
          },
          200,
          jsonHeaders
        );
      }

      return json(
        { ok: true, sessions: result.data.map(mapLaborSessionFromDb) },
        200,
        jsonHeaders
      );
    }

    if (action === "listLaborSummary") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const result = await fetchLaborSummary(env);
      if (!result.ok) {
        return json(
          {
            ok: false,
            error: "Labor summary could not be loaded.",
            details: result.error
          },
          200,
          jsonHeaders
        );
      }

      return json({ ok: true, sessions: result.sessions }, 200, jsonHeaders);
    }

    if (action === "pauseLaborSession") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const sessionId = cleanText(body.sessionId);
      if (!sessionId) {
        return json({ ok: false, error: "Missing sessionId." }, 200, jsonHeaders);
      }

      const result = await pauseLaborSession(env, {
        sessionId,
        notes: body.notes
      });
      if (!result.ok) {
        return json(
          {
            ok: false,
            error: result.error || "Labor session could not be paused.",
            details: result.details
          },
          200,
          jsonHeaders
        );
      }

      return json({ ok: true, session: result.session }, 200, jsonHeaders);
    }

    if (action === "resumeLaborSession") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const sessionId = cleanText(body.sessionId);
      if (!sessionId) {
        return json({ ok: false, error: "Missing sessionId." }, 200, jsonHeaders);
      }

      const result = await resumeLaborSession(env, {
        sessionId,
        notes: body.notes
      });
      if (!result.ok) {
        return json(
          {
            ok: false,
            error: result.error || "Labor session could not be resumed.",
            details: result.details
          },
          200,
          jsonHeaders
        );
      }

      return json({ ok: true, session: result.session }, 200, jsonHeaders);
    }

    if (action === "updateLaborSessionNotes") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const sessionId = cleanText(body.sessionId);
      if (!sessionId) {
        return json({ ok: false, error: "Missing sessionId." }, 200, jsonHeaders);
      }

      const result = await updateLaborSessionNotes(env, {
        sessionId,
        notes: body.notes
      });
      if (!result.ok) {
        return json(
          {
            ok: false,
            error: result.error || "Labor session notes could not be updated.",
            details: result.details
          },
          200,
          jsonHeaders
        );
      }

      return json({ ok: true, session: result.session }, 200, jsonHeaders);
    }

    if (action === "deleteOrder") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const orderNumber = String(body.orderNumber || "").trim();
      if (!orderNumber) {
        return json(
          {
            ok: false,
            error: "Missing orderNumber."
          },
          200,
          jsonHeaders
        );
      }

      const del = await supabaseFetch(
        env,
        `/rest/v1/orders?order_number=eq.${encodeURIComponent(orderNumber)}`,
        {
          method: "DELETE",
          headers: {
            Prefer: "return=representation"
          }
        }
      );

      if (!del.ok) {
        return json(
          {
            ok: false,
            error: "Failed to delete order from Supabase.",
            details: del.error
          },
          200,
          jsonHeaders
        );
      }

      return json(
        {
          ok: true,
          deleted: true,
          orderNumber
        },
        200,
        jsonHeaders
      );
    }

    if (action === "uploadOrderPhoto") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const result = await uploadOrderPhotoAction(env, body);
      return json(result, 200, jsonHeaders);
    }

    if (action === "removeOrderPhoto") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const result = await removeOrderPhotoAction(env, body);
      return json(result, 200, jsonHeaders);
    }

    if (action === "createOrder") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const result = await createOrderAction(env, body);
      return json(result, 200, jsonHeaders);
    }

    if (action === "resendStatusEmail") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const result = await resendStatusEmailAction(env, body);
      return json(result, 200, jsonHeaders);
    }

    if (action === "resendStatusText") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const result = await resendStatusTextAction(env, body);
      return json(result, 200, jsonHeaders);
    }

    if (action === "updateOrder") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const orderNumber = String(body.orderNumber || "").trim();
      const updates = body.updates || {};

      if (!orderNumber) {
        return json(
          {
            ok: false,
            error: "Missing orderNumber."
          },
          200,
          jsonHeaders
        );
      }

      const existing = await fetchOrderByNumber(env, orderNumber);
      if (!existing.ok || !existing.data) {
        return json(
          {
            ok: false,
            error: `Order not found: ${orderNumber}`
          },
          200,
          jsonHeaders
        );
      }

      const oldRow = existing.data;
      const oldStatus = normalizeStatus(oldRow.status);
      const lastStatusEmailed = normalizeStatus(oldRow.last_status_emailed);
      const lastStatusTexted = normalizeStatus(oldRow.last_status_texted);
      const oldPrimaryColor = cleanText(oldRow.primary_lace_color);
      const oldSecondaryColor = cleanText(oldRow.secondary_lace_color);
      const oldPrimaryUsed = Number(oldRow.primary_lace_used || 0);
      const oldSecondaryUsed = Number(oldRow.secondary_lace_used || 0);
      const dbUpdates = mapUpdatesToDb(updates);
      const mergedPreview = { ...oldRow, ...dbUpdates };

      const newStatus = normalizeStatus(mergedPreview.status);
      const statusChanged = !!newStatus && newStatus !== oldStatus;
      const shouldEmailForStatus =
        statusChanged &&
        !isInternalOnlyStatus(newStatus) &&
        newStatus !== lastStatusEmailed;
      const shouldTextForStatus =
        statusChanged &&
        toBoolean(mergedPreview.sms_opt_in) &&
        shouldSendTextForStatus(newStatus) &&
        newStatus !== lastStatusTexted;
      
      if (
        newStatus === "completed" &&
        looksLikeShipMethod(mergedPreview.drop_off_method) &&
        normalizePaidValue(mergedPreview.paid) !== "paid" &&
        !toBoolean(mergedPreview.allow_ship_without_payment)
      ) {
        return json(
          {
            ok: false,
            error: "Cannot mark a shipped order completed unless it is paid or override is checked."
          },
          200,
          jsonHeaders
        );
      }

      if (newStatus === "completed" && !mergedPreview.date_completed) {
        dbUpdates.date_completed = todayIsoDate();
        mergedPreview.date_completed = dbUpdates.date_completed;
      }

      if (statusChanged && isInternalOnlyStatus(newStatus)) {
        dbUpdates.last_status_emailed = normalizeDisplayStatus(mergedPreview.status);
        mergedPreview.last_status_emailed = normalizeDisplayStatus(mergedPreview.status);
      }

      if (shouldEmailForStatus && !env.RESEND_API_KEY) {
        return json(
          {
            ok: false,
            error: "Missing RESEND_API_KEY environment variable."
          },
          500,
          jsonHeaders
        );
      }

      const patch = await supabaseFetch(
        env,
        `/rest/v1/orders?order_number=eq.${encodeURIComponent(orderNumber)}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation"
          },
          body: JSON.stringify(dbUpdates)
        }
      );

      if (!patch.ok) {
        return json(
          {
            ok: false,
            error: "Failed to update order in Supabase.",
            details: patch.error
          },
          200,
          jsonHeaders
        );
      }

      let updated = Array.isArray(patch.data) ? patch.data[0] : null;
      if (!updated) {
        return json(
          {
            ok: false,
            error: "Update succeeded but no row was returned."
          },
          200,
          jsonHeaders
        );
      }

      await adjustLaceInventoryForOrderUpdate(env, {
        oldPrimaryColor,
        oldSecondaryColor,
        oldPrimaryUsed,
        oldSecondaryUsed,
        newPrimaryColor: cleanText(updated.primary_lace_color),
        newSecondaryColor: cleanText(updated.secondary_lace_color),
        newPrimaryUsed: Number(updated.primary_lace_used || 0),
        newSecondaryUsed: Number(updated.secondary_lace_used || 0)
      });

      await logOrderActivities(env, getOrderUpdateActivityEvents(oldRow, updated));
      
      if (shouldEmailForStatus) {
        const emailResult = await sendStatusEmail(
          env,
          updated,
          normalizeDisplayStatus(updated.status)
        );

        if (!emailResult.ok) {
          return json(
            {
              ok: false,
              error: "Order updated, but status email failed to send.",
              details: emailResult.error
            },
            200,
            jsonHeaders
          );
        }

        const stamp = await supabaseFetch(
          env,
          `/rest/v1/orders?order_number=eq.${encodeURIComponent(orderNumber)}`,
          {
            method: "PATCH",
            headers: {
              Prefer: "return=representation"
            },
            body: JSON.stringify({
              last_status_emailed: normalizeDisplayStatus(updated.status)
            })
          }
        );

        if (stamp.ok && Array.isArray(stamp.data) && stamp.data[0]) {
          updated = stamp.data[0];
        }

        await logOrderActivity(env, {
          orderNumber,
          eventType: "status_email_sent",
          eventLabel: "Status email sent",
          eventDetail: normalizeDisplayStatus(updated.status)
        });
      }

      if (shouldTextForStatus) {
        if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_MESSAGING_SERVICE_SID) {
          return json(
            {
              ok: false,
              error: "Order updated, but SMS was not sent because Twilio environment variables are missing."
            },
            200,
            jsonHeaders
          );
        }

        const textResult = await sendStatusText(
          env,
          updated,
          normalizeDisplayStatus(updated.status)
        );

        if (textResult.skipped) {
          return json(
            {
              ok: false,
              error: "Order updated, but SMS was skipped.",
              details: textResult.reason
            },
            200,
            jsonHeaders
          );
        }

        if (!textResult.ok) {
          return json(
            {
              ok: false,
              error: "Order updated, but status text failed to send.",
              details: textResult.error
            },
            200,
            jsonHeaders
          );
        }

        const textStamp = await supabaseFetch(
          env,
          `/rest/v1/orders?order_number=eq.${encodeURIComponent(orderNumber)}`,
          {
            method: "PATCH",
            headers: {
              Prefer: "return=representation"
            },
            body: JSON.stringify({
              last_status_texted: normalizeDisplayStatus(updated.status)
            })
          }
        );

        if (textStamp.ok && Array.isArray(textStamp.data) && textStamp.data[0]) {
          updated = textStamp.data[0];
        }

        await logOrderActivity(env, {
          orderNumber,
          eventType: "status_text_sent",
          eventLabel: "Status text sent",
          eventDetail: normalizeDisplayStatus(updated.status)
        });
      }

      return json(
        {
          ok: true,
          order: mapOrderFromDb(updated)
        },
        200,
        jsonHeaders
      );
    }

    if (action === "geocodeAddresses") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const items = Array.isArray(body.items) ? body.items : [];
      const results = await geocodeAddresses(items);

      return json(
        {
          ok: true,
          results
        },
        200,
        jsonHeaders
      );
    }

    if (action === "geocodeMissingOrderAddresses") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const items = Array.isArray(body.items) ? body.items : [];
      const results = await geocodeMissingOrderAddresses(env, items);

      return json(
        {
          ok: true,
          results
        },
        200,
        jsonHeaders
      );
    }

    if (action === "uploadGalleryPhoto") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const filename = cleanText(body.filename);
      const contentType = cleanText(body.contentType) || "image/jpeg";
      const dataUrl = cleanText(body.dataUrl);
      const section = cleanText(body.section) || "fielding-gloves";

      if (!filename || !dataUrl) {
        return json(
          {
            ok: false,
            error: "Missing filename or image data."
          },
          200,
          jsonHeaders
        );
      }

      if (!contentType.startsWith("image/")) {
        return json(
          {
            ok: false,
            error: "Only image uploads are allowed."
          },
          200,
          jsonHeaders
        );
      }

      const uploaded = await uploadGalleryPhoto(env, {
        section,
        filename,
        contentType,
        dataUrl
      });

      if (!uploaded.ok) {
        return json(
          {
            ok: false,
            error: "Gallery upload failed.",
            details: uploaded.error
          },
          200,
          jsonHeaders
        );
      }

      return json(
        {
          ok: true,
          url: uploaded.url,
          path: uploaded.path
        },
        200,
        jsonHeaders
      );
    }

    if (action === "setGalleryPhotoCover") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) return json(auth, 200, jsonHeaders);
      const url = cleanText(body.url);
      if (!url) return json({ ok: false, error: "Missing photo url." }, 200, jsonHeaders);

      const link = await supabaseFetch(env, `/rest/v1/gallery_photo_links?photo_url=eq.${encodeURIComponent(url)}&select=order_number&limit=1`);
      const row = link.ok && Array.isArray(link.data) ? link.data[0] : null;
      if (!row?.order_number) {
        return json({ ok: false, error: "Photo must be linked to an order first." }, 200, jsonHeaders);
      }

      /* One cover per album: clear the order's flag, then set this photo. */
      await supabaseFetch(env, `/rest/v1/gallery_photo_links?order_number=eq.${encodeURIComponent(row.order_number)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ is_cover: false })
      });
      const set = await supabaseFetch(env, `/rest/v1/gallery_photo_links?photo_url=eq.${encodeURIComponent(url)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ is_cover: true })
      });
      if (!set.ok) return json({ ok: false, error: "Could not set the cover." }, 200, jsonHeaders);
      return json({ ok: true }, 200, jsonHeaders);
    }

    if (action === "setGalleryPhotoOrder") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) return json(auth, 200, jsonHeaders);
      const url = cleanText(body.url);
      const orderNumber = cleanText(body.orderNumber);
      if (!url) return json({ ok: false, error: "Missing photo url." }, 200, jsonHeaders);

      /* Orderless "shop glove" description: descriptors make the photo
         searchable without an order (personal/family/sold gloves). */
      const d = body.descriptors && typeof body.descriptors === "object" ? body.descriptors : null;
      const descriptors = {
        brand_model: cleanText(d?.brandModel) || null,
        glove_type: cleanText(d?.gloveType) || null,
        web_type: cleanText(d?.webType) || null,
        primary_lace_color: cleanText(d?.primaryLaceColor) || null,
        secondary_lace_color: cleanText(d?.secondaryLaceColor) || null
      };
      const hasDescriptors = Object.values(descriptors).some(Boolean);

      if (!orderNumber && !hasDescriptors) {
        await supabaseFetch(env, `/rest/v1/gallery_photo_links?photo_url=eq.${encodeURIComponent(url)}`, {
          method: "DELETE", headers: { Prefer: "return=minimal" }
        });
        return json({ ok: true, cleared: true }, 200, jsonHeaders);
      }

      if (orderNumber) {
        const found = await fetchOrderByNumber(env, orderNumber);
        if (!found.ok || !found.data) {
          return json({ ok: false, error: `Order #${orderNumber} not found.` }, 200, jsonHeaders);
        }
      }

      /* Linking to an order clears descriptors and vice versa. */
      const row = orderNumber
        ? {
            photo_url: url,
            photo_path: cleanText(body.path) || null,
            order_number: orderNumber,
            brand_model: null,
            glove_type: null,
            web_type: null,
            primary_lace_color: null,
            secondary_lace_color: null
          }
        : {
            photo_url: url,
            photo_path: cleanText(body.path) || null,
            order_number: null,
            ...descriptors
          };

      const resp = await supabaseFetch(env, `/rest/v1/gallery_photo_links?on_conflict=photo_url`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(row)
      });
      if (!resp.ok) return json({ ok: false, error: "Could not save the link." }, 200, jsonHeaders);
      return json({ ok: true }, 200, jsonHeaders);
    }

    if (action === "moveGalleryPhoto") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) return json(auth, 200, jsonHeaders);

      const photoPath = cleanText(body.path);
      const oldUrl = cleanText(body.url);
      const targetSection = safeGallerySection(cleanText(body.section));
      const parsed = parseGalleryPhotoPath(photoPath);
      if (!parsed.ok) return json({ ok: false, error: "Invalid gallery photo path." }, 200, jsonHeaders);
      if (parsed.section === targetSection) {
        return json({ ok: false, error: "Photo is already in that section." }, 200, jsonHeaders);
      }

      const destinationPath = parsed.hidden
        ? `_hidden/${targetSection}/${parsed.name}`
        : `${targetSection}/${parsed.name}`;
      const moved = await moveGalleryStorageObject(env, photoPath, destinationPath);
      if (!moved.ok) return json({ ok: false, error: moved.error || "Move failed." }, 200, jsonHeaders);

      const photo = galleryPhotoFromPath(env, destinationPath, parsed.hidden);

      /* The URL changes with the path — keep the album link attached. */
      if (oldUrl) {
        await supabaseFetch(env, `/rest/v1/gallery_photo_links?photo_url=eq.${encodeURIComponent(oldUrl)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ photo_url: photo.url, photo_path: photo.path })
        });
      }

      return json({ ok: true, photo }, 200, jsonHeaders);
    }

    if (action === "hideGalleryPhoto" || action === "restoreGalleryPhoto" || action === "deleteGalleryPhoto") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const photoPath = cleanText(body.path);
      const result = action === "hideGalleryPhoto"
        ? await hideGalleryPhoto(env, photoPath)
        : action === "restoreGalleryPhoto"
          ? await restoreGalleryPhoto(env, photoPath)
          : await deleteGalleryPhoto(env, photoPath);

      if (!result.ok) {
        return json(
          {
            ok: false,
            error: result.error || "Gallery photo action failed."
          },
          200,
          jsonHeaders
        );
      }

      return json(
        {
          ok: true,
          photo: result.photo || null
        },
        200,
        jsonHeaders
      );
    }

    if (action === "listSaleGloves") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const supa = await supabaseFetch(
        env,
        `/rest/v1/gloves_for_sale?select=*&order=sort_order.asc,created_at.desc`
      );

      if (!supa.ok) {
        return json(
          {
            ok: false,
            error: "Failed to load gloves for sale from Supabase.",
            details: supa.error
          },
          200,
          jsonHeaders
        );
      }

      return json(
        {
          ok: true,
          gloves: (supa.data || []).map(mapSaleGloveFromDb)
        },
        200,
        jsonHeaders
      );
    }

    if (action === "getSaleGlove") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const id = cleanText(body.id);

      if (!id) {
        return json(
          {
            ok: false,
            error: "Missing glove id."
          },
          200,
          jsonHeaders
        );
      }

      const supa = await supabaseFetch(
        env,
        `/rest/v1/gloves_for_sale?select=*&id=eq.${encodeURIComponent(id)}&limit=1`
      );

      if (!supa.ok) {
        return json(
          {
            ok: false,
            error: "Failed to load glove listing.",
            details: supa.error
          },
          200,
          jsonHeaders
        );
      }

      const row = Array.isArray(supa.data) ? supa.data[0] : null;

      if (!row) {
        return json(
          {
            ok: false,
            error: "Glove listing not found."
          },
          200,
          jsonHeaders
        );
      }

      return json(
        {
          ok: true,
          glove: mapSaleGloveFromDb(row)
        },
        200,
        jsonHeaders
      );
    }

    if (action === "createSaleGlove") {
      const auth = await validateTokenFromBody(
        body,
        env.ADMIN_SESSION_SECRET
      );

      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const payload = {
        slug: body.slug,
        title: body.title,
        short_description: body.shortDescription,
        description: body.description,
        price: body.price || null,
        brand: body.brand,
        model: body.model,
        glove_size: body.gloveSize,
        position: body.position,
        web: body.web,
        throw_hand: body.throwHand,
        condition: body.condition,
        status: body.status || "available",
        purchase_url: body.purchaseUrl,
        featured: body.featured === true,
        sort_order: Number(body.sortOrder || 0)
      };

      const result = await supabaseFetch(
        env,
        "/rest/v1/gloves_for_sale",
        {
          method: "POST",
          headers: {
            Prefer: "return=representation"
          },
          body: JSON.stringify(payload)
        }
      );

      if (!result.ok) {
        return json(
          {
            ok: false,
            error: "Failed to create glove listing.",
            details: result.error
          },
          200,
          jsonHeaders
        );
      }

      return json(
        {
          ok: true,
          glove: result.data?.[0] || null
        },
        200,
        jsonHeaders
      );
    }

    if (action === "updateSaleGlove") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const id = cleanText(body.id);

      if (!id) {
        return json({ ok: false, error: "Missing glove id." }, 200, jsonHeaders);
      }

      const payload = {
        slug: cleanText(body.slug),
        title: cleanText(body.title),
        short_description: cleanText(body.shortDescription),
        description: cleanText(body.description),
        price: cleanNumeric(body.price),
        brand: cleanText(body.brand),
        model: cleanText(body.model),
        glove_size: cleanText(body.gloveSize),
        position: cleanText(body.position),
        web: cleanText(body.web),
        throw_hand: cleanText(body.throwHand),
        condition: cleanText(body.condition),
        status: cleanText(body.status) || "available",
        purchase_url: cleanText(body.purchaseUrl),
        featured: body.featured === true,
        sort_order: Number(body.sortOrder || 0)
      };

      const result = await supabaseFetch(
        env,
        `/rest/v1/gloves_for_sale?id=eq.${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation"
          },
          body: JSON.stringify(payload)
        }
      );

      if (!result.ok) {
        return json(
          {
            ok: false,
            error: "Failed to update glove listing.",
            details: result.error
          },
          200,
          jsonHeaders
        );
      }

      return json(
        {
          ok: true,
          glove: result.data?.[0] || null
        },
        200,
        jsonHeaders
      );
    }

    if (action === "deleteSaleGlove") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const id = cleanText(body.id);

      if (!id) {
        return json({ ok: false, error: "Missing glove id." }, 200, jsonHeaders);
      }

      const result = await supabaseFetch(
        env,
        `/rest/v1/gloves_for_sale?id=eq.${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: {
            Prefer: "return=representation"
          }
        }
      );

      if (!result.ok) {
        return json(
          {
            ok: false,
            error: "Failed to delete glove listing.",
            details: result.error
          },
          200,
          jsonHeaders
        );
      }

      return json(
        {
          ok: true,
          deleted: true,
          id
        },
        200,
        jsonHeaders
      );
    }

    if (action === "uploadSaleGlovePhoto") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);

      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const gloveId = cleanText(body.gloveId);
      const filename = cleanText(body.filename);
      const contentType = cleanText(body.contentType) || "image/jpeg";
      const dataUrl = cleanText(body.dataUrl);

      if (!gloveId || !filename || !dataUrl) {
        return json(
          {
            ok: false,
            error: "Missing gloveId, filename or image data."
          },
          200,
          jsonHeaders
        );
      }

      if (!contentType.startsWith("image/")) {
        return json(
          {
            ok: false,
            error: "Only image uploads are allowed."
          },
          200,
          jsonHeaders
        );
      }

      const gloveResp = await supabaseFetch(
        env,
        `/rest/v1/gloves_for_sale?select=id,slug&id=eq.${encodeURIComponent(gloveId)}&limit=1`
      );

      if (!gloveResp.ok || !Array.isArray(gloveResp.data) || !gloveResp.data[0]) {
        return json(
          {
            ok: false,
            error: "Glove not found.",
            details: gloveResp.error
          },
          200,
          jsonHeaders
        );
      }

      const glove = gloveResp.data[0];

      const uploaded = await uploadSaleGlovePhoto(env, {
        slug: glove.slug,
        filename,
        contentType,
        dataUrl
      });

      if (!uploaded.ok) {
        return json(
          {
            ok: false,
            error: "Glove photo upload failed.",
            details: uploaded.error
          },
          200,
          jsonHeaders
        );
      }

      const countResp = await supabaseFetch(
        env,
        `/rest/v1/glove_sale_photos?select=id&glove_id=eq.${encodeURIComponent(gloveId)}`
      );

      const sortOrder = Array.isArray(countResp.data)
        ? countResp.data.length
        : 0;

      const photoInsert = await supabaseFetch(
        env,
        "/rest/v1/glove_sale_photos",
        {
          method: "POST",
          headers: {
            Prefer: "return=representation"
          },
          body: JSON.stringify({
            glove_id: gloveId,
            url: uploaded.url,
            filename,
            sort_order: sortOrder
          })
        }
      );

      if (!photoInsert.ok) {
        return json(
          {
            ok: false,
            error: "Photo uploaded but database insert failed.",
            details: photoInsert.error
          },
          200,
          jsonHeaders
        );
      }

      return json(
        {
          ok: true,
          photo: photoInsert.data?.[0] || null
        },
        200,
        jsonHeaders
      );
    }

    if (action === "listSaleGlovePhotos") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);

      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const gloveId = cleanText(body.gloveId);

      if (!gloveId) {
        return json(
          {
            ok: false,
            error: "Missing glove id."
          },
          200,
          jsonHeaders
        );
      }

      const photos = await supabaseFetch(
        env,
        `/rest/v1/glove_sale_photos?glove_id=eq.${encodeURIComponent(gloveId)}&select=*&order=sort_order.asc,id.asc`
      );

      if (!photos.ok) {
        return json(
          {
            ok: false,
            error: "Failed to load glove photos.",
            details: photos.error
          },
          200,
          jsonHeaders
        );
      }

      return json(
        {
          ok: true,
          photos: photos.data || []
        },
        200,
        jsonHeaders
      );
    }

    if (action === "setSalePhotoPrimary") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);

      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const gloveId = cleanText(body.gloveId);
      const photoId = cleanText(body.photoId);

      if (!gloveId || !photoId) {
        return json(
          {
            ok: false,
            error: "Missing gloveId or photoId."
          },
          200,
          jsonHeaders
        );
      }

      const clearPrimary = await supabaseFetch(
        env,
        `/rest/v1/glove_sale_photos?glove_id=eq.${encodeURIComponent(gloveId)}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation"
          },
          body: JSON.stringify({
            is_primary: false
          })
        }
      );

      if (!clearPrimary.ok) {
        return json(
          {
            ok: false,
            error: "Failed to clear existing primary photo.",
            details: clearPrimary.error
          },
          200,
          jsonHeaders
        );
      }

      const setPrimary = await supabaseFetch(
        env,
        `/rest/v1/glove_sale_photos?id=eq.${encodeURIComponent(photoId)}&glove_id=eq.${encodeURIComponent(gloveId)}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation"
          },
          body: JSON.stringify({
            is_primary: true
          })
        }
      );

      if (!setPrimary.ok) {
        return json(
          {
            ok: false,
            error: "Failed to set primary photo.",
            details: setPrimary.error
          },
          200,
          jsonHeaders
        );
      }

      return json(
        {
          ok: true,
          photo: Array.isArray(setPrimary.data) ? setPrimary.data[0] : null
        },
        200,
        jsonHeaders
      );
    }

    if (action === "setSalePhotoHover") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);

      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const gloveId = cleanText(body.gloveId);
      const photoId = cleanText(body.photoId);

      if (!gloveId || !photoId) {
        return json(
          {
            ok: false,
            error: "Missing gloveId or photoId."
          },
          200,
          jsonHeaders
        );
      }

      const clearHover = await supabaseFetch(
        env,
        `/rest/v1/glove_sale_photos?glove_id=eq.${encodeURIComponent(gloveId)}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation"
          },
          body: JSON.stringify({
            is_hover: false
          })
        }
      );

      if (!clearHover.ok) {
        return json(
          {
            ok: false,
            error: "Failed to clear existing hover photo.",
            details: clearHover.error
          },
          200,
          jsonHeaders
        );
      }

      const setHover = await supabaseFetch(
        env,
        `/rest/v1/glove_sale_photos?id=eq.${encodeURIComponent(photoId)}&glove_id=eq.${encodeURIComponent(gloveId)}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation"
          },
          body: JSON.stringify({
            is_hover: true
          })
        }
      );

      if (!setHover.ok) {
        return json(
          {
            ok: false,
            error: "Failed to set hover photo.",
            details: setHover.error
          },
          200,
          jsonHeaders
        );
      }

      return json(
        {
          ok: true,
          photo: Array.isArray(setHover.data) ? setHover.data[0] : null
        },
        200,
        jsonHeaders
      );
    }

    if (action === "deleteSaleGlovePhoto") {
      const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);

      if (!auth.ok) {
        return json(auth, 200, jsonHeaders);
      }

      const gloveId = cleanText(body.gloveId);
      const photoId = cleanText(body.photoId);

      if (!gloveId || !photoId) {
        return json(
          {
            ok: false,
            error: "Missing gloveId or photoId."
          },
          200,
          jsonHeaders
        );
      }
    
      const del = await supabaseFetch(
        env,
        `/rest/v1/glove_sale_photos?id=eq.${encodeURIComponent(photoId)}&glove_id=eq.${encodeURIComponent(gloveId)}`,
        {
          method: "DELETE",
          headers: {
            Prefer: "return=representation"
          }
        }
      );
    
      if (!del.ok) {
        return json(
          {
            ok: false,
            error: "Failed to delete glove photo.",
            details: del.error
          },
          200,
          jsonHeaders
        );
      }
    
      return json(
        {
          ok: true,
          deleted: true,
          photo: Array.isArray(del.data) ? del.data[0] : null
        },
        200,
        jsonHeaders
      );
    }

    if (action === "searchPublicGloves") {
      /* Public glove search for the website gallery. Returns ONLY glove
         fields + photos — never customer name/contact/address. */
      const q = String(body.q || "").trim().toLowerCase();
      if (q.length < 2) return json({ ok: true, gloves: [] }, 200, jsonHeaders);

      const terms = q.split(/\s+/).filter(Boolean);
      const gloves = [];

      /* Source: curated gallery photos, either linked to an order (searchable
         via the order's fields) or carrying their own shop-glove descriptors. */
      const links = await supabaseFetch(
        env,
        `/rest/v1/gallery_photo_links?select=photo_url,order_number,brand_model,glove_type,web_type,primary_lace_color,secondary_lace_color&limit=1000`
      );
      const linkRows = (links.ok && Array.isArray(links.data)) ? links.data : [];

      const byOrder = new Map();
      /* Shop gloves described directly on the photo link. No grouping: two
         distinct gloves can share identical descriptors, so every described
         photo is its own result. */
      for (const l of linkRows) {
        if (l.order_number) {
          if (!byOrder.has(l.order_number)) byOrder.set(l.order_number, []);
          byOrder.get(l.order_number).push(l.photo_url);
          continue;
        }
        const fields = [l.brand_model, l.glove_type, l.web_type, l.primary_lace_color, l.secondary_lace_color];
        if (!fields.some(Boolean)) continue;
        if (gloves.length >= 24) continue;
        const hay = fields.map(v => String(v || "").toLowerCase()).join(" ");
        if (!terms.every(t => hay.includes(t))) continue;
        gloves.push({
          brandModel: l.brand_model || "",
          gloveType: l.glove_type || "",
          webType: l.web_type || "",
          laceColors: [l.primary_lace_color, l.secondary_lace_color].filter(Boolean),
          photos: [l.photo_url]
        });
      }

      if (byOrder.size && gloves.length < 24) {
        const nums = [...byOrder.keys()].map(n => `"${String(n).replace(/"/g, "")}"`).join(",");
        const ordersResp = await supabaseFetch(
          env,
          `/rest/v1/orders?select=order_number,brand_model,glove_type,web_type,primary_lace_color,secondary_lace_color,custom_color_request,services_requested&order_number=in.(${encodeURIComponent(nums)})`
        );
        for (const row of (ordersResp.ok && Array.isArray(ordersResp.data)) ? ordersResp.data : []) {
          const hay = [
            row.brand_model, row.glove_type, row.web_type,
            row.primary_lace_color, row.secondary_lace_color,
            row.custom_color_request, row.services_requested
          ].map(v => String(v || "").toLowerCase()).join(" ");
          if (!terms.every(t => hay.includes(t))) continue;
          gloves.push({
            brandModel: row.brand_model || "",
            gloveType: row.glove_type || "",
            webType: row.web_type || "",
            laceColors: [row.primary_lace_color, row.secondary_lace_color].filter(Boolean),
            photos: (byOrder.get(row.order_number) || []).slice(0, 4)
          });
          if (gloves.length >= 24) break;
        }
      }

      /* Curated linked gallery photos only — customer intake/SMS photos
         (orders.glove_photos) must never appear in public search results. */
      return json({ ok: true, gloves, source: "gallery" }, 200, jsonHeaders);
    }

    if (action === "listGalleryPhotos") {
      const includeHidden = body.includeHidden === true;

      if (includeHidden) {
        const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
        if (!auth.ok) {
          return json(auth, 200, jsonHeaders);
        }
      }

      const sections = [
        "fielding-gloves",
        "catchers-mitts",
        "first-base-mitts",
        "custom-color-relaces",
        "vintage"
      ];

      const gallery = {};
      const hiddenGallery = {};

      /* photoLinks (photo -> order number) ships publicly so the gallery can
         group a glove's photos into one album; descriptors stay admin-only. */
      let photoLinks = {};
      let photoCovers = {};
      let photoGloveMeta = {};
      {
        const links = await supabaseFetch(
          env,
          `/rest/v1/gallery_photo_links?select=photo_url,order_number,is_cover,brand_model,glove_type,web_type,primary_lace_color,secondary_lace_color&limit=1000`
        );
        if (links.ok && Array.isArray(links.data)) {
          for (const l of links.data) {
            if (l.is_cover) photoCovers[l.photo_url] = true;
            if (l.order_number) {
              photoLinks[l.photo_url] = l.order_number;
              continue;
            }
            if (includeHidden) {
              photoGloveMeta[l.photo_url] = {
                brandModel: l.brand_model || "",
                gloveType: l.glove_type || "",
                webType: l.web_type || "",
                primaryLaceColor: l.primary_lace_color || "",
                secondaryLaceColor: l.secondary_lace_color || ""
              };
            }
          }
        }
      }

      for (const section of sections) {
        const listed = await listGallerySection(env, section);

        if (!listed.ok) {
          return json(
            {
              ok: false,
              error: `Failed to load gallery section: ${section}`,
              details: listed.error
            },
            200,
            jsonHeaders
          );
        }

        gallery[section] = listed.photos;

        if (includeHidden) {
          const hidden = await listGallerySection(env, section, { hidden: true });

          if (!hidden.ok) {
            return json(
              {
                ok: false,
                error: `Failed to load hidden gallery section: ${section}`,
                details: hidden.error
              },
              200,
              jsonHeaders
            );
          }

          hiddenGallery[section] = hidden.photos;
        }
      }

      return json(
        {
          ok: true,
          gallery,
          photoLinks,
          photoCovers,
          photoGloveMeta,
          hiddenGallery
        },
        200,
        jsonHeaders
      );
    }

    return json(
      {
        ok: false,
        error: `Unknown action: ${action || "[none]"}`
      },
      200,
      jsonHeaders
    );
  } catch (err) {
    return json(
      {
        ok: false,
        error: err && err.message ? err.message : String(err)
      },
      500,
      jsonHeaders
    );
  }
}

/* =========================
   RESPONSE HELPERS
========================= */
function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers
  });
}

/* =========================
   SUPABASE
========================= */
async function supabaseFetch(env, path, options = {}) {
  const url = `${env.SUPABASE_URL}${path}`;

  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const resp = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body
  });

  const text = await resp.text();

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!resp.ok) {
    return {
      ok: false,
      status: resp.status,
      error: data
    };
  }

  return {
    ok: true,
    status: resp.status,
    data
  };
}

async function fetchOrderByNumber(env, orderNumber) {
  const resp = await supabaseFetch(
    env,
    `/rest/v1/orders?select=*&order_number=eq.${encodeURIComponent(orderNumber)}&limit=1`
  );

  if (!resp.ok) return resp;

  return {
    ok: true,
    data: Array.isArray(resp.data) ? (resp.data[0] || null) : null
  };
}

async function listOrderActivity(env, orderNumber) {
  const resp = await supabaseFetch(
    env,
    `/rest/v1/order_activity?select=*&order_number=eq.${encodeURIComponent(orderNumber)}&order=created_at.desc&limit=50`
  );

  if (!resp.ok) return resp;

  return {
    ok: true,
    activity: Array.isArray(resp.data) ? resp.data.map(mapOrderActivityFromDb) : []
  };
}

/* Distinct order numbers that carry at least one real activity-log entry.
   order_created_manual is excluded so a freshly-created order (whether from
   intake, which logs nothing, or the admin form, which logs a creation
   event) counts as "new" until it picks up genuine activity. */
async function listOrdersWithActivity(env) {
  const resp = await supabaseFetch(
    env,
    `/rest/v1/order_activity?select=order_number&event_type=neq.order_created_manual`
  );

  if (!resp.ok) return resp;

  const seen = new Set();
  if (Array.isArray(resp.data)) {
    for (const row of resp.data) {
      const orderNumber = cleanText(row?.order_number);
      if (orderNumber) seen.add(orderNumber);
    }
  }

  return { ok: true, orderNumbers: Array.from(seen) };
}

async function logOrderActivities(env, events) {
  for (const event of events) {
    await logOrderActivity(env, event);
  }
}

async function logOrderActivity(env, event) {
  const orderNumber = cleanText(event?.orderNumber);
  const eventType = cleanText(event?.eventType);
  const eventLabel = cleanText(event?.eventLabel);

  if (!orderNumber || !eventType || !eventLabel) {
    return { ok: false, error: "Missing activity fields." };
  }

  try {
    const resp = await supabaseFetch(
      env,
      `/rest/v1/order_activity`,
      {
        method: "POST",
        headers: {
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          order_number: orderNumber,
          event_type: eventType,
          event_label: eventLabel,
          event_detail: cleanText(event?.eventDetail) || null,
          actor: cleanText(event?.actor) || "admin",
          metadata: event?.metadata || null
        })
      }
    );

    if (!resp.ok) {
      console.warn("Order activity insert failed", resp.error);
      return { ok: false, error: resp.error };
    }

    return { ok: true };
  } catch (err) {
    console.warn("Order activity insert failed", err);
    return { ok: false, error: err?.message || String(err) };
  }
}

function mapOrderActivityFromDb(row) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    eventType: row.event_type,
    eventLabel: row.event_label,
    eventDetail: row.event_detail,
    actor: row.actor,
    metadata: row.metadata,
    createdAt: row.created_at
  };
}

const LABOR_TIMER_PHASES = [
  "Tear down",
  "Cleaning",
  "Relacing",
  "Conditioning",
  "Palm Pad",
  "Photos",
  "Packing/Shipping",
  "Admin/Messaging",
  "Other"
];

function isValidLaborPhase(phase) {
  return LABOR_TIMER_PHASES.includes(cleanText(phase));
}

function normalizeLaborRowStatus(row) {
  if (row.ended_at) return "stopped";
  if (row.status === "paused") return "paused";
  return "running";
}

function mapLaborSessionFromDb(row) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    phase: row.phase,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMinutes: row.duration_minutes != null ? Number(row.duration_minutes) : null,
    status: normalizeLaborRowStatus(row),
    pausedAt: row.paused_at ?? null,
    pauseAccumulatedSeconds: Number(row.pause_accumulated_seconds) || 0,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function calculateLaborDurationMinutes(startedAt, endedAt) {
  const started = new Date(startedAt);
  const ended = new Date(endedAt);
  if (Number.isNaN(started.getTime()) || Number.isNaN(ended.getTime())) {
    return null;
  }

  const minutes = (ended.getTime() - started.getTime()) / 60000;
  if (!Number.isFinite(minutes) || minutes < 0) {
    return null;
  }

  return Math.round(minutes * 100) / 100;
}

/* Active labor time excludes paused time:
   running: (now - started_at) - pause_accumulated_seconds
   paused:  (paused_at - started_at) - pause_accumulated_seconds
   clamped at >= 0. */
function calculateLaborActiveSeconds(row, nowIso) {
  const started = new Date(row.started_at);
  if (Number.isNaN(started.getTime())) return null;

  const status = normalizeLaborRowStatus(row);
  const referenceIso = status === "paused" && row.paused_at ? row.paused_at : nowIso;
  const reference = new Date(referenceIso);
  if (Number.isNaN(reference.getTime())) return null;

  const pausedSeconds = Number(row.pause_accumulated_seconds) || 0;
  const seconds = (reference.getTime() - started.getTime()) / 1000 - pausedSeconds;
  if (!Number.isFinite(seconds)) return null;

  return Math.max(0, seconds);
}

async function listLaborSessions(env, orderNumber) {
  const resp = await supabaseFetch(
    env,
    `/rest/v1/order_labor_sessions?select=*&order_number=eq.${encodeURIComponent(orderNumber)}&order=started_at.desc`
  );

  if (!resp.ok) return resp;

  return {
    ok: true,
    sessions: Array.isArray(resp.data) ? resp.data.map(mapLaborSessionFromDb) : []
  };
}

async function fetchOpenLaborSession(env, orderNumber) {
  const resp = await supabaseFetch(
    env,
    `/rest/v1/order_labor_sessions?select=*&order_number=eq.${encodeURIComponent(orderNumber)}&ended_at=is.null&order=started_at.desc&limit=1`
  );

  if (!resp.ok) return resp;

  const row = Array.isArray(resp.data) ? (resp.data[0] || null) : null;
  return {
    ok: true,
    data: row
  };
}

async function fetchOpenLaborSessions(env) {
  const resp = await supabaseFetch(
    env,
    `/rest/v1/order_labor_sessions?select=*&ended_at=is.null&order=started_at.desc`
  );

  if (!resp.ok) return resp;

  return {
    ok: true,
    data: Array.isArray(resp.data) ? resp.data : []
  };
}

async function fetchLaborSessionById(env, sessionId) {
  const resp = await supabaseFetch(
    env,
    `/rest/v1/order_labor_sessions?select=*&id=eq.${encodeURIComponent(sessionId)}&limit=1`
  );

  if (!resp.ok) return resp;

  return {
    ok: true,
    data: Array.isArray(resp.data) ? (resp.data[0] || null) : null
  };
}

async function startLaborSession(env, { orderNumber, phase, notes }) {
  const openAll = await fetchOpenLaborSessions(env);
  if (!openAll.ok) return openAll;

  const runningAnywhere = openAll.data.some(
    row => normalizeLaborRowStatus(row) === "running"
  );
  if (runningAnywhere) {
    return {
      ok: false,
      error: "Pause or stop the current timer first."
    };
  }

  const open = await fetchOpenLaborSession(env, orderNumber);
  if (!open.ok) return open;

  if (open.data) {
    return {
      ok: false,
      error: "Stop the active timer before starting a new session."
    };
  }

  const startedAt = new Date().toISOString();
  const resp = await supabaseFetch(env, `/rest/v1/order_labor_sessions`, {
    method: "POST",
    headers: {
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      order_number: orderNumber,
      phase,
      started_at: startedAt,
      status: "running",
      pause_accumulated_seconds: 0,
      notes: cleanText(notes) || null,
      updated_at: startedAt
    })
  });

  if (!resp.ok) return resp;

  const row = Array.isArray(resp.data) ? resp.data[0] : resp.data;
  const session = mapLaborSessionFromDb(row);

  await logOrderActivity(env, {
    orderNumber,
    eventType: "labor_timer",
    eventLabel: "Labor timer started",
    eventDetail: phase,
    metadata: {
      sessionId: session.id,
      phase
    }
  });

  return {
    ok: true,
    session
  };
}

async function stopLaborSession(env, { sessionId, notes }) {
  const existing = await fetchLaborSessionById(env, sessionId);
  if (!existing.ok) return existing;

  const row = existing.data;
  if (!row) {
    return {
      ok: false,
      error: "Labor session not found."
    };
  }

  if (row.ended_at) {
    return {
      ok: false,
      error: "This session is already stopped.",
      session: mapLaborSessionFromDb(row)
    };
  }

  const endedAt = new Date().toISOString();
  const activeSeconds = calculateLaborActiveSeconds(row, endedAt);
  const durationMinutes = activeSeconds === null
    ? null
    : Math.round((activeSeconds / 60) * 100) / 100;
  const nextNotes = notes !== undefined && notes !== null
    ? (cleanText(notes) || null)
    : (row.notes || null);

  const resp = await supabaseFetch(
    env,
    `/rest/v1/order_labor_sessions?id=eq.${encodeURIComponent(sessionId)}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        ended_at: endedAt,
        duration_minutes: durationMinutes,
        status: "stopped",
        updated_at: endedAt,
        notes: nextNotes
      })
    }
  );

  if (!resp.ok) return resp;

  const updated = Array.isArray(resp.data) ? resp.data[0] : resp.data;
  const session = mapLaborSessionFromDb(updated);

  await logOrderActivity(env, {
    orderNumber: session.orderNumber,
    eventType: "labor_timer",
    eventLabel: "Labor timer stopped",
    eventDetail: session.phase,
    metadata: {
      sessionId: session.id,
      phase: session.phase,
      durationMinutes: session.durationMinutes
    }
  });

  return {
    ok: true,
    session
  };
}

async function fetchLaborSummary(env) {
  const resp = await supabaseFetch(
    env,
    `/rest/v1/order_labor_sessions?select=order_number,phase,duration_minutes&ended_at=not.is.null`
  );

  if (!resp.ok) return resp;

  return {
    ok: true,
    sessions: (Array.isArray(resp.data) ? resp.data : []).map(row => ({
      orderNumber: row.order_number,
      phase: row.phase,
      durationMinutes: row.duration_minutes != null ? Number(row.duration_minutes) : 0
    }))
  };
}

async function pauseLaborSession(env, { sessionId, notes }) {
  const existing = await fetchLaborSessionById(env, sessionId);
  if (!existing.ok) return existing;

  const row = existing.data;
  if (!row) {
    return {
      ok: false,
      error: "Labor session not found."
    };
  }

  if (row.ended_at) {
    return {
      ok: false,
      error: "This session is already stopped.",
      session: mapLaborSessionFromDb(row)
    };
  }

  if (row.status === "paused") {
    return {
      ok: false,
      error: "This session is already paused.",
      session: mapLaborSessionFromDb(row)
    };
  }

  const pausedAt = new Date().toISOString();
  const nextNotes = notes !== undefined && notes !== null
    ? (cleanText(notes) || null)
    : (row.notes || null);

  const resp = await supabaseFetch(
    env,
    `/rest/v1/order_labor_sessions?id=eq.${encodeURIComponent(sessionId)}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        status: "paused",
        paused_at: pausedAt,
        updated_at: pausedAt,
        notes: nextNotes
      })
    }
  );

  if (!resp.ok) return resp;

  const updated = Array.isArray(resp.data) ? resp.data[0] : resp.data;
  return {
    ok: true,
    session: mapLaborSessionFromDb(updated)
  };
}

async function resumeLaborSession(env, { sessionId, notes }) {
  const existing = await fetchLaborSessionById(env, sessionId);
  if (!existing.ok) return existing;

  const row = existing.data;
  if (!row) {
    return {
      ok: false,
      error: "Labor session not found."
    };
  }

  if (row.ended_at) {
    return {
      ok: false,
      error: "This session is already stopped.",
      session: mapLaborSessionFromDb(row)
    };
  }

  if (row.status !== "paused") {
    return {
      ok: false,
      error: "This session is already running.",
      session: mapLaborSessionFromDb(row)
    };
  }

  const openAll = await fetchOpenLaborSessions(env);
  if (!openAll.ok) return openAll;

  const otherRunning = openAll.data.some(
    other => other.id !== row.id && normalizeLaborRowStatus(other) === "running"
  );
  if (otherRunning) {
    return {
      ok: false,
      error: "Pause or stop the current timer first."
    };
  }

  const resumedAt = new Date();
  const pausedAtMs = row.paused_at ? new Date(row.paused_at).getTime() : NaN;
  const pausedSeconds = Number.isNaN(pausedAtMs)
    ? 0
    : Math.max(0, Math.round((resumedAt.getTime() - pausedAtMs) / 1000));
  const nextAccumulated = (Number(row.pause_accumulated_seconds) || 0) + pausedSeconds;
  const resumedIso = resumedAt.toISOString();
  const nextNotes = notes !== undefined && notes !== null
    ? (cleanText(notes) || null)
    : (row.notes || null);

  const resp = await supabaseFetch(
    env,
    `/rest/v1/order_labor_sessions?id=eq.${encodeURIComponent(sessionId)}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        status: "running",
        paused_at: null,
        pause_accumulated_seconds: nextAccumulated,
        updated_at: resumedIso,
        notes: nextNotes
      })
    }
  );

  if (!resp.ok) return resp;

  const updated = Array.isArray(resp.data) ? resp.data[0] : resp.data;
  return {
    ok: true,
    session: mapLaborSessionFromDb(updated)
  };
}

async function updateLaborSessionNotes(env, { sessionId, notes }) {
  const existing = await fetchLaborSessionById(env, sessionId);
  if (!existing.ok) return existing;

  if (!existing.data) {
    return {
      ok: false,
      error: "Labor session not found."
    };
  }

  const updatedAt = new Date().toISOString();
  const resp = await supabaseFetch(
    env,
    `/rest/v1/order_labor_sessions?id=eq.${encodeURIComponent(sessionId)}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        notes: cleanText(notes) || null,
        updated_at: updatedAt
      })
    }
  );

  if (!resp.ok) return resp;

  const row = Array.isArray(resp.data) ? resp.data[0] : resp.data;
  return {
    ok: true,
    session: mapLaborSessionFromDb(row)
  };
}

function getOrderUpdateActivityEvents(oldRow, newRow) {
  const orderNumber = cleanText(newRow.order_number || oldRow.order_number);
  const events = [];

  addActivityChange(events, {
    orderNumber,
    eventType: "status_changed",
    eventLabel: "Status changed",
    oldValue: normalizeDisplayStatus(oldRow.status),
    newValue: normalizeDisplayStatus(newRow.status)
  });

  addActivityChange(events, {
    orderNumber,
    eventType: "price_changed",
    eventLabel: "Price changed",
    oldValue: formatActivityMoney(oldRow.price_quoted),
    newValue: formatActivityMoney(newRow.price_quoted)
  });

  addActivityChange(events, {
    orderNumber,
    eventType: "paid_changed",
    eventLabel: "Paid changed",
    oldValue: oldRow.paid,
    newValue: newRow.paid
  });

  addActivityChange(events, {
    orderNumber,
    eventType: "date_received_changed",
    eventLabel: "Date received changed",
    oldValue: oldRow.date_received,
    newValue: newRow.date_received
  });

  addActivityChange(events, {
    orderNumber,
    eventType: "estimated_completion_changed",
    eventLabel: "Estimated completion changed",
    oldValue: oldRow.estimated_completion,
    newValue: newRow.estimated_completion
  });

  addActivityChange(events, {
    orderNumber,
    eventType: "date_completed_changed",
    eventLabel: "Date completed changed",
    oldValue: oldRow.date_completed,
    newValue: newRow.date_completed
  });

  addActivityChange(events, {
    orderNumber,
    eventType: "tracking_changed",
    eventLabel: "Tracking changed",
    oldValue: formatActivityTracking(oldRow),
    newValue: formatActivityTracking(newRow)
  });

  addActivityChange(events, {
    orderNumber,
    eventType: "shipping_override_changed",
    eventLabel: "Shipping override changed",
    oldValue: formatActivityBoolean(oldRow.allow_ship_without_payment),
    newValue: formatActivityBoolean(newRow.allow_ship_without_payment)
  });

  if (cleanText(oldRow.internal_notes) !== cleanText(newRow.internal_notes)) {
    events.push({
      orderNumber,
      eventType: "internal_notes_updated",
      eventLabel: "Internal notes updated",
      eventDetail: "Notes changed"
    });
  }

  return events;
}

function addActivityChange(events, change) {
  const oldValue = cleanText(change.oldValue);
  const newValue = cleanText(change.newValue);
  if (oldValue === newValue) return;
  if (!oldValue && !newValue) return;

  events.push({
    orderNumber: change.orderNumber,
    eventType: change.eventType,
    eventLabel: change.eventLabel,
    eventDetail: `${oldValue || "blank"} -> ${newValue || "blank"}`
  });
}

function formatActivityMoney(value) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return cleanText(value);
  return `$${number.toFixed(2)}`;
}

function formatActivityTracking(row) {
  return [cleanText(row.carrier), cleanText(row.tracking_number)].filter(Boolean).join(" ");
}

function formatActivityBoolean(value) {
  return toBoolean(value) ? "Yes" : "No";
}

async function createOrderAction(env, body) {
  const input = body.order || {};
  const customerName = cleanText(input.customerName);
  const phoneNumber = cleanText(input.phoneNumber);
  const emailAddress = cleanText(input.emailAddress);
  const dropOffMethod = cleanText(input.dropOffMethod) || "Local Drop-Off";
  const smsOptIn = toBoolean(input.smsOptIn);

  if (!customerName) {
    return { ok: false, error: "Customer name is required." };
  }

  if (!phoneNumber && !emailAddress) {
    return { ok: false, error: "Add a phone number or email." };
  }

  if (smsOptIn && !phoneNumber) {
    return { ok: false, error: "Phone is required when SMS opt-in is enabled." };
  }

  if (looksLikeShipMethod(dropOffMethod)) {
    if (!cleanText(input.streetAddress) || !cleanText(input.city) || !cleanText(input.state) || !cleanText(input.zipCode)) {
      return { ok: false, error: "Shipping orders need street, city, state, and zip." };
    }
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nextOrderNumber = await getNextAdminOrderNumber(env);
    const dbOrder = {
      ...mapUpdatesToDb({
        ...input,
        customerName,
        phoneNumber,
        emailAddress,
        dropOffMethod,
        status: cleanText(input.status) || "Received",
        paid: cleanText(input.paid) || "Unpaid",
        smsOptIn
      }),
      timestamp_submitted: new Date().toISOString(),
      order_number: nextOrderNumber,
      glove_photos: [],
      shipping_cost: null,
      tracking_number: null,
      carrier: null,
      date_completed: null,
      allow_ship_without_payment: false,
      last_status_emailed: null,
      last_status_texted: null
    };

    if (!looksLikeShipMethod(dropOffMethod)) {
      dbOrder.street_address = null;
      dbOrder.city = null;
      dbOrder.state = null;
      dbOrder.zip_code = null;
    }

    const insert = await supabaseFetch(
      env,
      `/rest/v1/orders`,
      {
        method: "POST",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify(dbOrder)
      }
    );

    if (insert.ok && Array.isArray(insert.data) && insert.data[0]) {
      await logOrderActivity(env, {
        orderNumber: insert.data[0].order_number,
        eventType: "order_created_manual",
        eventLabel: "Order created manually",
        eventDetail: customerName,
        metadata: {
          source: "admin"
        }
      });

      return {
        ok: true,
        order: mapOrderFromDb(insert.data[0])
      };
    }

    const details = JSON.stringify(insert.error || {});
    if (!/duplicate|unique|23505/i.test(details)) {
      return {
        ok: false,
        error: "Failed to create order in Supabase.",
        details: insert.error
      };
    }
  }

  return {
    ok: false,
    error: "Could not reserve the next order number. Please try again."
  };
}

async function getNextAdminOrderNumber(env) {
  const resp = await supabaseFetch(
    env,
    `/rest/v1/orders?select=order_number`
  );

  if (!resp.ok) {
    throw new Error("Failed to determine next order number.");
  }

  let maxNum = 79;
  if (Array.isArray(resp.data)) {
    for (const row of resp.data) {
      const n = parseInt(String(row.order_number || "").trim(), 10);
      if (!Number.isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }

  return String(maxNum + 1).padStart(4, "0");
}

async function resendStatusEmailAction(env, body) {
  const orderNumber = cleanText(body.orderNumber);
  if (!orderNumber) {
    return { ok: false, error: "Missing orderNumber." };
  }

  const existing = await fetchOrderByNumber(env, orderNumber);
  if (!existing.ok || !existing.data) {
    return { ok: false, error: `Order not found: ${orderNumber}` };
  }

  const statusDisplay = normalizeDisplayStatus(existing.data.status);
  const status = normalizeStatus(statusDisplay);
  if (!status) {
    return { ok: false, error: "This order does not have a status to send." };
  }

  if (isInternalOnlyStatus(status)) {
    return { ok: false, error: `${statusDisplay} is internal-only and is not emailed.` };
  }

  if (!cleanText(existing.data.email_address)) {
    return { ok: false, error: "This order does not have a customer email address." };
  }

  if (!env.RESEND_API_KEY) {
    return { ok: false, error: "Missing RESEND_API_KEY environment variable." };
  }

  const emailResult = await sendStatusEmail(env, existing.data, statusDisplay);
  if (emailResult.skipped) {
    return { ok: false, error: emailResult.reason || "Status email was skipped." };
  }
  if (!emailResult.ok) {
    return { ok: false, error: "Status email failed to send.", details: emailResult.error };
  }

  const stamp = await supabaseFetch(
    env,
    `/rest/v1/orders?order_number=eq.${encodeURIComponent(orderNumber)}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        last_status_emailed: statusDisplay
      })
    }
  );

  if (!stamp.ok || !Array.isArray(stamp.data) || !stamp.data[0]) {
    return { ok: false, error: "Status email sent, but delivery status could not be updated.", details: stamp.error };
  }

  await logOrderActivity(env, {
    orderNumber,
    eventType: "status_email_resent",
    eventLabel: "Status email resent",
    eventDetail: statusDisplay
  });

  return {
    ok: true,
    order: mapOrderFromDb(stamp.data[0])
  };
}

async function resendStatusTextAction(env, body) {
  const orderNumber = cleanText(body.orderNumber);
  if (!orderNumber) {
    return { ok: false, error: "Missing orderNumber." };
  }

  const existing = await fetchOrderByNumber(env, orderNumber);
  if (!existing.ok || !existing.data) {
    return { ok: false, error: `Order not found: ${orderNumber}` };
  }

  const statusDisplay = normalizeDisplayStatus(existing.data.status);
  const status = normalizeStatus(statusDisplay);
  if (!status) {
    return { ok: false, error: "This order does not have a status to text." };
  }

  if (!shouldSendTextForStatus(status)) {
    return { ok: false, error: `${statusDisplay} is not configured for status text messages.` };
  }

  if (!toBoolean(existing.data.sms_opt_in)) {
    return { ok: false, error: "This customer has not opted in to SMS updates." };
  }

  if (!cleanText(existing.data.phone_number)) {
    return { ok: false, error: "This order does not have a customer phone number." };
  }

  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_MESSAGING_SERVICE_SID) {
    return { ok: false, error: "Missing Twilio environment variables." };
  }

  const textResult = await sendStatusText(env, existing.data, statusDisplay);
  if (textResult.skipped) {
    return { ok: false, error: textResult.reason || "Status text was skipped." };
  }
  if (!textResult.ok) {
    return { ok: false, error: "Status text failed to send.", details: textResult.error };
  }

  const stamp = await supabaseFetch(
    env,
    `/rest/v1/orders?order_number=eq.${encodeURIComponent(orderNumber)}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        last_status_texted: statusDisplay
      })
    }
  );

  if (!stamp.ok || !Array.isArray(stamp.data) || !stamp.data[0]) {
    return { ok: false, error: "Status text sent, but delivery status could not be updated.", details: stamp.error };
  }

  await logOrderActivity(env, {
    orderNumber,
    eventType: "status_text_resent",
    eventLabel: "Status text resent",
    eventDetail: statusDisplay
  });

  return {
    ok: true,
    order: mapOrderFromDb(stamp.data[0])
  };
}

async function uploadOrderPhotoAction(env, body) {
  const orderNumber = cleanText(body.orderNumber);
  const filename = cleanText(body.filename);
  const contentType = cleanText(body.contentType) || "image/jpeg";
  const dataUrl = cleanText(body.dataUrl);

  if (!orderNumber || !filename || !dataUrl) {
    return { ok: false, error: "Missing order number, filename or image data." };
  }

  if (!contentType.startsWith("image/")) {
    return { ok: false, error: "Only image uploads are allowed." };
  }

  const existing = await fetchOrderByNumber(env, orderNumber);
  if (!existing.ok) {
    return { ok: false, error: "Failed to load order.", details: existing.error };
  }
  if (!existing.data) {
    return { ok: false, error: "Order not found." };
  }

  const uploaded = await uploadOrderPhoto(env, {
    orderNumber,
    filename,
    contentType,
    dataUrl
  });

  if (!uploaded.ok) {
    return {
      ok: false,
      error: "Order photo upload failed.",
      details: uploaded.error
    };
  }

  const photos = uniquePhotoUrls([
    ...parseDbPhotoList(existing.data.glove_photos),
    uploaded.url
  ]);
  const updated = await updateOrderPhotos(env, orderNumber, photos);

  if (!updated.ok) {
    return {
      ok: false,
      error: "Photo uploaded but order update failed.",
      details: updated.error
    };
  }

  await logOrderActivity(env, {
    orderNumber,
    eventType: "order_photo_added",
    eventLabel: "Order photo added",
    eventDetail: "1 photo added",
    metadata: {
      path: uploaded.path
    }
  });

  return {
    ok: true,
    url: uploaded.url,
    path: uploaded.path,
    photos,
    order: mapOrderFromDb(updated.data)
  };
}

async function removeOrderPhotoAction(env, body) {
  const orderNumber = cleanText(body.orderNumber);
  const url = cleanText(body.url || body.photoUrl);

  if (!orderNumber || !url) {
    return { ok: false, error: "Missing order number or photo URL." };
  }

  const existing = await fetchOrderByNumber(env, orderNumber);
  if (!existing.ok) {
    return { ok: false, error: "Failed to load order.", details: existing.error };
  }
  if (!existing.data) {
    return { ok: false, error: "Order not found." };
  }

  const existingPhotos = parseDbPhotoList(existing.data.glove_photos);
  const photos = existingPhotos.filter(photo => String(photo) !== String(url));

  if (photos.length === existingPhotos.length) {
    return { ok: false, error: "Photo was not found on this order." };
  }

  const updated = await updateOrderPhotos(env, orderNumber, photos);

  if (!updated.ok) {
    return {
      ok: false,
      error: "Failed to remove photo from order.",
      details: updated.error
    };
  }

  await logOrderActivity(env, {
    orderNumber,
    eventType: "order_photo_removed",
    eventLabel: "Order photo removed",
    eventDetail: "Photo removed"
  });

  return {
    ok: true,
    removed: true,
    photos,
    order: mapOrderFromDb(updated.data)
  };
}

async function updateOrderPhotos(env, orderNumber, photos) {
  const result = await supabaseFetch(
    env,
    `/rest/v1/orders?order_number=eq.${encodeURIComponent(orderNumber)}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        glove_photos: photos
      })
    }
  );

  if (!result.ok) return result;

  return {
    ok: true,
    data: Array.isArray(result.data) ? (result.data[0] || null) : null
  };
}

function parseDbPhotoList(value) {
  if (Array.isArray(value)) return uniquePhotoUrls(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? uniquePhotoUrls(parsed) : [];
    } catch {
      return /^https?:\/\//i.test(trimmed) ? uniquePhotoUrls([trimmed]) : [];
    }
  }
  return [];
}

function uniquePhotoUrls(photos) {
  const seen = new Set();
  const out = [];

  (Array.isArray(photos) ? photos : []).forEach(photo => {
    const url = cleanText(photo);
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push(url);
  });

  return out;
}

async function fetchInventoryRows(env) {
  const resp = await supabaseFetch(env, "/rest/v1/lace_inventory?select=*&order=color.asc");
  if (!resp.ok) return resp;
  return {
    ok: true,
    data: Array.isArray(resp.data) ? resp.data : []
  };
}

async function createInventoryItem(env, body) {
  const color = cleanText(body.color);
  if (!color) return { ok: false, error: "Missing lace color." };

  const existing = await fetchInventoryRows(env);
  if (!existing.ok) {
    return { ok: false, error: "Failed to check lace inventory.", details: existing.error };
  }

  if (inventoryColorExists(existing.data, color)) {
    return { ok: false, error: "That lace color already exists." };
  }

  const columnHints = getInventoryColumnHints(existing.data);
  let payload;
  try {
    payload = buildInventoryPayload({
      color,
      quantityOnHand: body.quantityOnHand,
      reorderAt: body.reorderAt,
      reorderAlertEnabled: body.reorderAlertEnabled,
      active: body.active
    }, columnHints, { creating: true });
  } catch (err) {
    return { ok: false, error: err.message || "Invalid lace inventory values." };
  }

  const result = await supabaseFetch(
    env,
    "/rest/v1/lace_inventory",
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload)
    }
  );

  if (!result.ok) {
    return { ok: false, error: "Failed to create lace color.", details: result.error };
  }

  return { ok: true, item: result.data?.[0] || null };
}

async function updateInventoryItem(env, body) {
  const color = cleanText(body.color);
  if (!color) return { ok: false, error: "Missing lace color." };

  const existing = await fetchInventoryRows(env);
  if (!existing.ok) {
    return { ok: false, error: "Failed to load lace inventory.", details: existing.error };
  }

  const row = existing.data.find(item => normalizeInventoryName(item.color) === normalizeInventoryName(color));
  if (!row) return { ok: false, error: "Lace color not found." };

  const updates = body.updates || {};
  const nextColor = cleanText(updates.color);
  if (nextColor && inventoryColorExists(existing.data, nextColor, row.color)) {
    return { ok: false, error: "That lace color already exists." };
  }

  let payload;
  try {
    payload = buildInventoryPayload(updates, getInventoryColumnHints(existing.data, row), { creating: false });
  } catch (err) {
    return { ok: false, error: err.message || "Invalid lace inventory values." };
  }
  if (!Object.keys(payload).length) return { ok: true, item: row };

  const result = await supabaseFetch(
    env,
    `/rest/v1/lace_inventory?color=eq.${encodeURIComponent(row.color)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload)
    }
  );

  if (!result.ok) {
    return { ok: false, error: "Failed to update lace inventory.", details: result.error };
  }

  return { ok: true, item: result.data?.[0] || null };
}

function buildInventoryPayload(input, columns, options = {}) {
  const payload = {};
  const creating = options.creating === true;

  if (creating || "color" in input) {
    payload.color = cleanText(input.color);
  }

  if (creating || "quantityOnHand" in input || "quantity_on_hand" in input) {
    const parsed = parseInventoryInteger(input.quantityOnHand ?? input.quantity_on_hand, "quantity");
    if (!parsed.ok) throw new Error(parsed.error);
    payload.quantity_on_hand = parsed.value;
  }

  if (creating || "reorderAt" in input || "reorder_at" in input || "reorderThreshold" in input) {
    const parsed = parseInventoryInteger(input.reorderAt ?? input.reorder_at ?? input.reorderThreshold, "reorder at");
    if (!parsed.ok) throw new Error(parsed.error);
    if (columns.has("reorder_at")) payload.reorder_at = parsed.value;
    if (columns.has("reorder_threshold")) payload.reorder_threshold = parsed.value;
  }

  if (creating || "reorderAlertEnabled" in input || "reorder_alert_enabled" in input) {
    if (columns.has("reorder_alert_enabled")) {
      payload.reorder_alert_enabled = (input.reorderAlertEnabled ?? input.reorder_alert_enabled) !== false;
    }
  }

  if (creating || "active" in input) {
    if (columns.has("active")) payload.active = input.active !== false;
  }

  return payload;
}

function getInventoryColumnHints(rows, preferredRow = null) {
  const row = preferredRow || rows.find(item => item && typeof item === "object") || {};
  const keys = new Set(Object.keys(row));
  if (!keys.size) {
    ["color", "quantity_on_hand", "reorder_at", "reorder_alert_enabled", "active"].forEach(key => keys.add(key));
  }
  keys.add("reorder_alert_enabled");
  if (!keys.has("reorder_at") && !keys.has("reorder_threshold")) keys.add("reorder_at");
  return keys;
}

function parseInventoryInteger(value, label, options = {}) {
  if ((value === null || value === undefined || value === "") && options.allowNull) {
    return { ok: true, value: null };
  }

  if (value === null || value === undefined || value === "") {
    return { ok: false, error: `Invalid ${label}.` };
  }

  const number = Number(value);
  const min = Number.isFinite(options.min) ? options.min : 0;
  if (!Number.isInteger(number) || number < min) {
    return { ok: false, error: `Invalid ${label}.` };
  }

  return { ok: true, value: number };
}

function inventoryColorExists(rows, color, currentColor = "") {
  const next = normalizeInventoryName(color);
  const current = normalizeInventoryName(currentColor);
  return rows.some(row => {
    const rowColor = normalizeInventoryName(row.color);
    return rowColor && rowColor === next && rowColor !== current;
  });
}

function normalizeInventoryName(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/* =========================
   TOKEN HELPERS
========================= */
async function createSignedToken(payload, secret) {
  const payloadBase64 = toBase64Url(JSON.stringify(payload));
  const signature = await signString(payloadBase64, secret);
  return `${payloadBase64}.${signature}`;
}

async function validateTokenFromBody(body, secret) {
  const token = String(body._token || "").trim();

  if (!token) {
    return {
      ok: false,
      error: "Missing session token."
    };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return {
      ok: false,
      error: "Invalid session token."
    };
  }

  const [payloadBase64, signature] = parts;
  const expectedSignature = await signString(payloadBase64, secret);

  if (signature !== expectedSignature) {
    return {
      ok: false,
      error: "Invalid session token."
    };
  }

  let payload;
  try {
    payload = JSON.parse(fromBase64Url(payloadBase64));
  } catch {
    return {
      ok: false,
      error: "Invalid session token payload."
    };
  }

  if (!payload.exp || Date.now() > Number(payload.exp)) {
    return {
      ok: false,
      error: "Session expired."
    };
  }

  return { ok: true, payload };
}

async function signString(input, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(input));
  return arrayBufferToBase64Url(sig);
}

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/* =========================
   WEBAUTHN / PASSKEYS

   Dependency-free passkey auth on top of the existing signed-token session.
   The challenge is stateless: it's HMAC-signed with ADMIN_SESSION_SECRET
   (same primitive as createSignedToken) and echoed back, so there's no
   challenge table to store or clean up. Only ES256 (P-256) is supported,
   which covers Apple Face ID / Touch ID and platform passkeys on Android
   and Chrome. Attestation is not chain-verified — for a single-operator
   admin tool the security that matters is verifying the login assertion
   signature against the stored public key, which is done in full.
========================= */
function getWebauthnConfig(env) {
  /* The admin is served on both the apex and www, so accept either origin.
     RP ID stays the apex (murphsmitts.com) — a passkey bound to it is valid
     on the apex and any subdomain, so one passkey works across both hosts.
     WEBAUTHN_ORIGIN may override with a comma-separated allowlist. */
  const origins = String(env.WEBAUTHN_ORIGIN || "https://murphsmitts.com,https://www.murphsmitts.com")
    .split(",")
    .map(o => o.trim())
    .filter(Boolean);

  return {
    rpId: String(env.WEBAUTHN_RP_ID || "murphsmitts.com").trim(),
    rpName: "Murph's Mitt Maintenance",
    origins,
    userId: "murph-admin",
    userName: "murphsmitts",
    userDisplayName: "Murph's Mitts Admin"
  };
}

function base64UrlToBytes(str) {
  const input = String(str || "");
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomChallengeB64Url() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return arrayBufferToBase64Url(bytes);
}

async function createChallengeToken(kind, challengeB64, secret) {
  return createSignedToken(
    { k: kind, c: challengeB64, exp: Date.now() + 5 * 60 * 1000 },
    secret
  );
}

async function verifyChallengeToken(token, kind, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return { ok: false, error: "Invalid passkey challenge." };

  const [payloadB64, signature] = parts;
  const expected = await signString(payloadB64, secret);
  if (signature !== expected) return { ok: false, error: "Invalid passkey challenge." };

  let payload;
  try {
    payload = JSON.parse(fromBase64Url(payloadB64));
  } catch {
    return { ok: false, error: "Invalid passkey challenge." };
  }

  if (payload.k !== kind) return { ok: false, error: "Passkey challenge type mismatch." };
  if (!payload.exp || Date.now() > Number(payload.exp)) return { ok: false, error: "Passkey challenge expired." };

  return { ok: true, challenge: payload.c };
}

async function sha256Bytes(input) {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : input;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}

function bytesEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* Minimal CBOR reader — supports the subset WebAuthn emits (unsigned/negative
   ints, byte/text strings, arrays, maps, and simple booleans/null). */
function cborRead(bytes, offset) {
  const first = bytes[offset];
  const major = first >> 5;
  const info = first & 0x1f;
  offset += 1;

  let length = info;
  if (info === 24) { length = bytes[offset]; offset += 1; }
  else if (info === 25) { length = (bytes[offset] << 8) | bytes[offset + 1]; offset += 2; }
  else if (info === 26) {
    length = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
    offset += 4;
  } else if (info === 27) {
    const hi = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
    const lo = ((bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7]) >>> 0;
    length = hi * 4294967296 + lo;
    offset += 8;
  } else if (info === 31) {
    throw new Error("Unsupported CBOR (indefinite length).");
  }

  switch (major) {
    case 0:
      return { value: length, offset };
    case 1:
      return { value: -1 - length, offset };
    case 2: {
      const value = bytes.slice(offset, offset + length);
      return { value, offset: offset + length };
    }
    case 3: {
      const value = new TextDecoder().decode(bytes.slice(offset, offset + length));
      return { value, offset: offset + length };
    }
    case 4: {
      const arr = [];
      let off = offset;
      for (let i = 0; i < length; i++) {
        const item = cborRead(bytes, off);
        arr.push(item.value);
        off = item.offset;
      }
      return { value: arr, offset: off };
    }
    case 5: {
      const map = new Map();
      let off = offset;
      for (let i = 0; i < length; i++) {
        const k = cborRead(bytes, off);
        off = k.offset;
        const v = cborRead(bytes, off);
        off = v.offset;
        map.set(k.value, v.value);
      }
      return { value: map, offset: off };
    }
    case 7: {
      if (info === 20) return { value: false, offset };
      if (info === 21) return { value: true, offset };
      if (info === 22) return { value: null, offset };
      return { value: null, offset };
    }
    default:
      throw new Error("Unsupported CBOR type.");
  }
}

function cborDecodeFirst(bytes) {
  return cborRead(bytes, 0).value;
}

function parseAuthData(authData) {
  const bytes = authData instanceof Uint8Array ? authData : new Uint8Array(authData);
  const rpIdHash = bytes.slice(0, 32);
  const flags = bytes[32];
  const signCount = ((bytes[33] << 24) | (bytes[34] << 16) | (bytes[35] << 8) | bytes[36]) >>> 0;
  const up = !!(flags & 0x01);
  const uv = !!(flags & 0x04);
  const at = !!(flags & 0x40);
  const ed = !!(flags & 0x80);

  let credentialId = null;
  let credentialPublicKey = null;

  if (at) {
    let offset = 37 + 16; // skip aaguid
    const credIdLen = (bytes[offset] << 8) | bytes[offset + 1];
    offset += 2;
    credentialId = bytes.slice(offset, offset + credIdLen);
    offset += credIdLen;
    credentialPublicKey = cborRead(bytes.slice(offset), 0).value;
  }

  return { rpIdHash, flags, signCount, up, uv, at, ed, credentialId, credentialPublicKey };
}

function coseToKeyInfo(coseMap) {
  const kty = coseMap.get(1);
  const alg = coseMap.get(3);
  if (kty !== 2) throw new Error("Only EC2 passkeys are supported.");
  if (alg !== -7) throw new Error("Only ES256 passkeys are supported.");
  const crv = coseMap.get(-1);
  if (crv !== 1) throw new Error("Only P-256 passkeys are supported.");
  const x = coseMap.get(-2);
  const y = coseMap.get(-3);
  if (!x || !y) throw new Error("Passkey public key was incomplete.");
  return { alg, x: arrayBufferToBase64Url(x), y: arrayBufferToBase64Url(y) };
}

async function importEs256Key(keyInfo) {
  return crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x: keyInfo.x, y: keyInfo.y, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
}

/* WebAuthn signs with DER-encoded ECDSA; WebCrypto verifies raw r||s. */
function derToRawEcdsaSignature(der) {
  let offset = 0;
  if (der[offset++] !== 0x30) throw new Error("Bad signature encoding.");
  let seqLen = der[offset++];
  if (seqLen & 0x80) {
    const n = seqLen & 0x7f;
    seqLen = 0;
    for (let i = 0; i < n; i++) seqLen = (seqLen << 8) | der[offset++];
  }

  const readInt = () => {
    if (der[offset++] !== 0x02) throw new Error("Bad signature encoding.");
    const len = der[offset++];
    let val = der.slice(offset, offset + len);
    offset += len;
    while (val.length > 0 && val[0] === 0x00) val = val.slice(1);
    if (val.length > 32) throw new Error("Bad signature integer.");
    const out = new Uint8Array(32);
    out.set(val, 32 - val.length);
    return out;
  };

  const r = readInt();
  const s = readInt();
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

async function verifyAssertionSignature(keyInfo, authDataBytes, clientDataJSONBytes, derSignature) {
  const key = await importEs256Key(keyInfo);
  const clientHash = await sha256Bytes(clientDataJSONBytes);
  const signedData = new Uint8Array(authDataBytes.length + clientHash.length);
  signedData.set(authDataBytes, 0);
  signedData.set(clientHash, authDataBytes.length);
  const rawSig = derToRawEcdsaSignature(derSignature);
  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, rawSig, signedData);
}

async function listWebauthnCredentials(env) {
  const resp = await supabaseFetch(env, `/rest/v1/webauthn_credentials?select=*`);
  if (!resp.ok) return resp;
  return { ok: true, credentials: Array.isArray(resp.data) ? resp.data : [] };
}

async function getWebauthnCredential(env, credentialId) {
  const resp = await supabaseFetch(
    env,
    `/rest/v1/webauthn_credentials?select=*&credential_id=eq.${encodeURIComponent(credentialId)}&limit=1`
  );
  if (!resp.ok) return resp;
  return { ok: true, credential: Array.isArray(resp.data) && resp.data[0] ? resp.data[0] : null };
}

async function insertWebauthnCredential(env, row) {
  const resp = await supabaseFetch(env, `/rest/v1/webauthn_credentials`, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(row)
  });
  if (!resp.ok) return resp;
  return { ok: true };
}

async function touchWebauthnCredential(env, credentialId, signCount) {
  const resp = await supabaseFetch(
    env,
    `/rest/v1/webauthn_credentials?credential_id=eq.${encodeURIComponent(credentialId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ sign_count: signCount, last_used_at: new Date().toISOString() })
    }
  );
  if (!resp.ok) return resp;
  return { ok: true };
}

/* =========================
   ACCOUNTS / PASSWORDS / ROLES

   Multi-user accounts with hashed passwords (PBKDF2-HMAC-SHA256, per-user
   salt, dependency-free via WebCrypto). The signed session token carries the
   user id (sub) and role. Roles: "admin" (full access) and "demo"
   (interactive sandbox, blocked from real data — enforced in the dispatch).
========================= */
// Cloudflare Workers' WebCrypto caps PBKDF2 at 100000 iterations.
const PASSWORD_ITERATIONS = 100000;

async function hashPassword(password, saltInput = null, iterations = PASSWORD_ITERATIONS) {
  const salt = saltInput ? base64UrlToBytes(saltInput) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(password)),
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
    hash: arrayBufferToBase64Url(bits),
    salt: arrayBufferToBase64Url(salt),
    iterations
  };
}

async function verifyPassword(password, stored) {
  if (!stored?.hash || !stored?.salt) return false;
  const { hash } = await hashPassword(password, stored.salt, Number(stored.iterations) || PASSWORD_ITERATIONS);
  return constantTimeEqual(hash, stored.hash);
}

function constantTimeEqual(a, b) {
  const sa = String(a);
  const sb = String(b);
  if (sa.length !== sb.length) return false;
  let diff = 0;
  for (let i = 0; i < sa.length; i++) diff |= sa.charCodeAt(i) ^ sb.charCodeAt(i);
  return diff === 0;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function mapUserFromDb(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    active: row.active !== false,
    hasPassword: !!row.password_hash,
    invitePending: !!row.invite_token,
    inviteExpiresAt: row.invite_expires_at,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at
  };
}

async function getUserByEmail(env, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: true, user: null };
  const resp = await supabaseFetch(
    env,
    `/rest/v1/admin_users?select=*&email=eq.${encodeURIComponent(normalized)}&limit=1`
  );
  if (!resp.ok) return resp;
  return { ok: true, user: Array.isArray(resp.data) && resp.data[0] ? resp.data[0] : null };
}

async function getUserByInviteToken(env, token) {
  const clean = cleanText(token);
  if (!clean) return { ok: true, user: null };
  const resp = await supabaseFetch(
    env,
    `/rest/v1/admin_users?select=*&invite_token=eq.${encodeURIComponent(clean)}&limit=1`
  );
  if (!resp.ok) return resp;
  return { ok: true, user: Array.isArray(resp.data) && resp.data[0] ? resp.data[0] : null };
}

async function touchUserLogin(env, userId) {
  await supabaseFetch(
    env,
    `/rest/v1/admin_users?id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_login_at: new Date().toISOString() })
    }
  );
}

/* Returns the resolved role for a validated token: the account's current
   role (so a role change or deactivation takes effect immediately), or the
   token's role for the owner/passkey escape hatches (sub === "owner"). */
async function resolveAuthRole(env, payload) {
  if (!payload) return null;
  if (payload.sub === "owner") return "admin";
  if (!payload.sub) return payload.role || null;

  const found = await getUserByEmail(env, payload.email || "");
  const user = found.ok ? found.user : null;
  if (!user || user.active === false) return null;
  return user.role || null;
}

/* Gate for admin-only actions: valid token AND resolved role === "admin". */
async function requireAdmin(env, body) {
  const auth = await validateTokenFromBody(body, env.ADMIN_SESSION_SECRET);
  if (!auth.ok) return { ok: false, error: auth.error };
  const role = await resolveAuthRole(env, auth.payload);
  if (role !== "admin") return { ok: false, error: "Admins only." };
  return { ok: true, payload: auth.payload, role };
}

function getInviteBaseUrl(env) {
  return String(env.WEBAUTHN_ORIGIN || "https://murphsmitts.com")
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");
}

/* =========================
   ORDER MAPPING
========================= */
function mapOrderFromDb(row) {
  return {
    id: row.id,

    timestampSubmitted: row.timestamp_submitted,
    customerName: row.customer_name,
    phoneNumber: row.phone_number,
    emailAddress: row.email_address,

    brandModel: row.brand_model,
    gloveType: row.glove_type,
    webType: row.web_type,
    servicesRequested: row.services_requested,

    primaryLaceColor: row.primary_lace_color,
    lacePrimary: row.primary_lace_color,
    secondaryLaceColor: row.secondary_lace_color,
    laceAccent: row.secondary_lace_color,
    customColorRequest: row.custom_color_request,
    customLaceNotes: row.custom_color_request,
    
    primaryLaceUsed: row.primary_lace_used,
    secondaryLaceUsed: row.secondary_lace_used,

    dropOffMethod: row.drop_off_method,
    dropoffMethod: row.drop_off_method,
    deliveryMethod: row.drop_off_method,
    shippingMethod: row.drop_off_method,
    streetAddress: row.street_address,
    address: row.street_address,
    city: row.city,
    state: row.state,
    zipCode: row.zip_code,
    zip: row.zip_code,

    gloveNotes: row.glove_notes,
    customerNotes: row.customer_notes || row.glove_notes,
    socialTag: row.social_tag,
    turnaroundAcknowledged: row.turnaround_acknowledged,
    referralSource: row.referral_source,
    glovePhotos: parseDbPhotoList(row.glove_photos),

    orderNumber: row.order_number,
    status: row.status,
    dateReceived: row.date_received,
    estimatedCompletion: row.estimated_completion,
    priceQuoted: row.price_quoted,
    lacePiecesUsed: row.lace_pieces_used != null ? Number(row.lace_pieces_used) : null,
    shippingCost: row.shipping_cost,
    paid: row.paid,
    allowShipWithoutPayment: row.allow_ship_without_payment,
    trackingNumber: row.tracking_number,
    tracking: row.tracking_number,
    carrier: row.carrier,
    dateCompleted: row.date_completed,
    internalNotes: row.internal_notes,
    lastStatusEmailed: row.last_status_emailed,
    smsOptIn: row.sms_opt_in === true,
    lastStatusTexted: row.last_status_texted,
    lastStatusTextedAt: row.last_status_texted_at,
    mapLat: row.map_lat,
    mapLng: row.map_lng,
    mapGeocodedAddress: row.map_geocoded_address,
    mapGeocodeSource: row.map_geocode_source,
    mapGeocodeStatus: row.map_geocode_status,
    mapGeocodeQuality: row.map_geocode_quality,
    mapGeocodeError: row.map_geocode_error,
    mapAddressHash: row.map_address_hash,
    mapGeocodedAt: row.map_geocoded_at,

    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSaleGloveFromDb(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.short_description,
    description: row.description,
    price: row.price,
    brand: row.brand,
    model: row.model,
    gloveSize: row.glove_size,
    position: row.position,
    web: row.web,
    throwHand: row.throw_hand,
    condition: row.condition,
    status: row.status,
    featuredImageUrl: row.featured_image_url,
    hoverImageUrl: row.hover_image_url,
    purchaseUrl: row.purchase_url,
    featured: row.featured === true,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapUpdatesToDb(updates) {
  const out = {};

  if ("status" in updates) out.status = cleanText(updates.status);
  if ("customerName" in updates) out.customer_name = cleanText(updates.customerName);
  if ("phoneNumber" in updates) out.phone_number = cleanText(updates.phoneNumber);
  if ("emailAddress" in updates) out.email_address = cleanText(updates.emailAddress);
  if ("socialTag" in updates) out.social_tag = cleanText(updates.socialTag);
  if ("brandModel" in updates) out.brand_model = cleanText(updates.brandModel);
  if ("gloveType" in updates) out.glove_type = cleanText(updates.gloveType);
  if ("webType" in updates) out.web_type = cleanText(updates.webType);
  if ("servicesRequested" in updates) out.services_requested = cleanText(updates.servicesRequested);

  if ("primaryLaceColor" in updates) out.primary_lace_color = cleanText(updates.primaryLaceColor);
  if ("lacePrimary" in updates && !("primaryLaceColor" in updates)) out.primary_lace_color = cleanText(updates.lacePrimary);

  if ("secondaryLaceColor" in updates) out.secondary_lace_color = cleanText(updates.secondaryLaceColor);
  if ("laceAccent" in updates && !("secondaryLaceColor" in updates)) out.secondary_lace_color = cleanText(updates.laceAccent);

  if ("customColorRequest" in updates) out.custom_color_request = cleanText(updates.customColorRequest);
  if ("customLaceNotes" in updates) out.custom_color_request = cleanText(updates.customLaceNotes);
  if ("primaryLaceUsed" in updates) out.primary_lace_used = cleanNumeric(updates.primaryLaceUsed);
  if ("secondaryLaceUsed" in updates) out.secondary_lace_used = cleanNumeric(updates.secondaryLaceUsed);

  if ("dropOffMethod" in updates) out.drop_off_method = cleanText(updates.dropOffMethod);

  if ("streetAddress" in updates) out.street_address = cleanText(updates.streetAddress);
  if ("address" in updates && !("streetAddress" in updates)) out.street_address = cleanText(updates.address);

  if ("city" in updates) out.city = cleanText(updates.city);
  if ("state" in updates) out.state = cleanText(updates.state);

  if ("zipCode" in updates) out.zip_code = cleanText(updates.zipCode);
  if ("zip" in updates && !("zipCode" in updates)) out.zip_code = cleanText(updates.zip);

  if ("gloveNotes" in updates) out.glove_notes = cleanText(updates.gloveNotes);
  if ("customerNotes" in updates) out.customer_notes = cleanText(updates.customerNotes);
  if ("socialTag" in updates) out.social_tag = cleanText(updates.socialTag);
  if ("turnaroundAcknowledged" in updates) out.turnaround_acknowledged = cleanText(updates.turnaroundAcknowledged);
  if ("referralSource" in updates) out.referral_source = cleanText(updates.referralSource);

  if ("priceQuoted" in updates) out.price_quoted = cleanNumeric(updates.priceQuoted);
  if ("lacePiecesUsed" in updates) {
    const lacePieces = cleanNumeric(updates.lacePiecesUsed);
    out.lace_pieces_used = lacePieces === null ? null : Math.round(lacePieces);
  }
  if ("shippingCost" in updates) out.shipping_cost = cleanNumeric(updates.shippingCost);
  if ("paid" in updates) out.paid = cleanText(updates.paid);

  if ("smsOptIn" in updates) out.sms_opt_in = toBoolean(updates.smsOptIn);
  if ("allowShipWithoutPayment" in updates) out.allow_ship_without_payment = toBoolean(updates.allowShipWithoutPayment);

  if ("trackingNumber" in updates) out.tracking_number = cleanText(updates.trackingNumber);
  if ("tracking" in updates && !("trackingNumber" in updates)) out.tracking_number = cleanText(updates.tracking);

  if ("carrier" in updates) out.carrier = cleanText(updates.carrier);

  if ("dateReceived" in updates) out.date_received = cleanDate(updates.dateReceived);
  if ("estimatedCompletion" in updates) out.estimated_completion = cleanDate(updates.estimatedCompletion);
  if ("dateCompleted" in updates) out.date_completed = cleanDate(updates.dateCompleted);

  if ("internalNotes" in updates) out.internal_notes = cleanText(updates.internalNotes);
  if ("lastStatusEmailed" in updates) out.last_status_emailed = cleanText(updates.lastStatusEmailed);
  if ("mapLat" in updates) out.map_lat = cleanNumeric(updates.mapLat);
  if ("mapLng" in updates) out.map_lng = cleanNumeric(updates.mapLng);
  if ("mapGeocodedAddress" in updates) out.map_geocoded_address = cleanText(updates.mapGeocodedAddress);
  if ("mapGeocodeSource" in updates) out.map_geocode_source = cleanText(updates.mapGeocodeSource);
  if ("mapGeocodeStatus" in updates) out.map_geocode_status = cleanText(updates.mapGeocodeStatus);
  if ("mapGeocodeQuality" in updates) out.map_geocode_quality = cleanText(updates.mapGeocodeQuality);
  if ("mapGeocodeError" in updates) out.map_geocode_error = cleanText(updates.mapGeocodeError);
  if ("mapAddressHash" in updates) out.map_address_hash = cleanText(updates.mapAddressHash);
  if ("mapGeocodedAt" in updates) out.map_geocoded_at = cleanText(updates.mapGeocodedAt);

  return out;
}

async function adjustLaceInventoryForOrderUpdate(env, usage) {
  const adjustments = new Map();

  addAdjustment(adjustments, usage.oldPrimaryColor, usage.oldPrimaryUsed);
  addAdjustment(adjustments, usage.oldSecondaryColor, usage.oldSecondaryUsed);

  addAdjustment(adjustments, usage.newPrimaryColor, -usage.newPrimaryUsed);
  addAdjustment(adjustments, usage.newSecondaryColor, -usage.newSecondaryUsed);

  for (const [color, delta] of adjustments.entries()) {
    if (!color || !delta) continue;

    const existing = await supabaseFetch(
      env,
      `/rest/v1/lace_inventory?select=quantity_on_hand&color=eq.${encodeURIComponent(color)}&limit=1`
    );

    if (!existing.ok || !Array.isArray(existing.data) || !existing.data[0]) {
      continue;
    }

    const currentQty = Number(existing.data[0].quantity_on_hand || 0);
    const nextQty = currentQty + delta;

    await supabaseFetch(
      env,
      `/rest/v1/lace_inventory?color=eq.${encodeURIComponent(color)}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          quantity_on_hand: nextQty
        })
      }
    );
  }
}

function addAdjustment(map, color, amount) {
  const cleanColor = cleanText(color);
  const qty = Number(amount || 0);

  if (!cleanColor || !qty) return;

  map.set(cleanColor, (map.get(cleanColor) || 0) + qty);
}

async function uploadGalleryPhoto(env, { section, filename, contentType, dataUrl }) {
  try {
    const base64 = String(dataUrl || "").split(",").pop();
    if (!base64) {
      return { ok: false, error: "Invalid image data." };
    }

    const bytes = base64ToUint8Array(base64);
    const ext = extensionFromContentType(contentType, filename);
    const cleanName = safeStorageName(filename).replace(/\.[a-z0-9]+$/i, "");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeSection = safeGallerySection(section);
    const path = `${safeSection}/${stamp}-${cleanName}.${ext}`;

    const uploadResp = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/gallery/${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": contentType,
          "x-upsert": "true"
        },
        body: bytes
      }
    );

    const uploadText = await uploadResp.text();

    if (!uploadResp.ok) {
      let error = uploadText;
      try {
        error = JSON.parse(uploadText);
      } catch {}

      return {
        ok: false,
        error
      };
    }

    return {
      ok: true,
      path,
      url: `${env.SUPABASE_URL}/storage/v1/object/public/gallery/${path}`
    };
  } catch (err) {
    return {
      ok: false,
      error: err && err.message ? err.message : String(err)
    };
  }
}

async function hideGalleryPhoto(env, photoPath) {
  const parsed = parseGalleryPhotoPath(photoPath);
  if (!parsed.ok || parsed.hidden) {
    return { ok: false, error: "Invalid visible gallery photo path." };
  }

  const destinationPath = `_hidden/${parsed.section}/${parsed.name}`;
  const moved = await moveGalleryStorageObject(env, parsed.path, destinationPath);
  if (!moved.ok) return moved;

  return {
    ok: true,
    photo: galleryPhotoFromPath(env, destinationPath, true)
  };
}

async function restoreGalleryPhoto(env, photoPath) {
  const parsed = parseGalleryPhotoPath(photoPath);
  if (!parsed.ok || !parsed.hidden) {
    return { ok: false, error: "Invalid hidden gallery photo path." };
  }

  const destinationPath = `${parsed.section}/${parsed.name}`;
  const moved = await moveGalleryStorageObject(env, parsed.path, destinationPath);
  if (!moved.ok) return moved;

  return {
    ok: true,
    photo: galleryPhotoFromPath(env, destinationPath, false)
  };
}

async function deleteGalleryPhoto(env, photoPath) {
  const parsed = parseGalleryPhotoPath(photoPath);
  if (!parsed.ok) {
    return { ok: false, error: "Invalid gallery photo path." };
  }

  const deleted = await deleteGalleryStorageObject(env, parsed.path);
  if (!deleted.ok) return deleted;

  return {
    ok: true,
    photo: galleryPhotoFromPath(env, parsed.path, parsed.hidden)
  };
}

async function moveGalleryStorageObject(env, sourcePath, destinationPath) {
  try {
    const resp = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/move`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          bucketId: "gallery",
          sourceKey: sourcePath,
          destinationKey: destinationPath
        })
      }
    );

    const text = await resp.text();
    if (!resp.ok) {
      let error = text;
      try {
        error = JSON.parse(text);
      } catch {}

      return {
        ok: false,
        error
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || String(err)
    };
  }
}

async function deleteGalleryStorageObject(env, photoPath) {
  try {
    const resp = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/gallery`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prefixes: [photoPath]
        })
      }
    );

    const text = await resp.text();
    if (!resp.ok) {
      let error = text;
      try {
        error = JSON.parse(text);
      } catch {}

      return {
        ok: false,
        error
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || String(err)
    };
  }
}

async function uploadSaleGlovePhoto(env, { slug, filename, contentType, dataUrl }) {
  try {
    const base64 = String(dataUrl || "").split(",").pop();

    if (!base64) {
      return {
        ok: false,
        error: "Invalid image data."
      };
    }

    const bytes = base64ToUint8Array(base64);
    const ext = extensionFromContentType(contentType, filename);

    const cleanName = safeStorageName(filename)
      .replace(/\.[a-z0-9]+$/i, "");

    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-");

    const safeSlug = String(slug || "glove")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "glove";

    const path = `${safeSlug}/${stamp}-${cleanName}.${ext}`;

    const uploadResp = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/gloves-for-sale/${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": contentType,
          "x-upsert": "true"
        },
        body: bytes
      }
    );

    const uploadText = await uploadResp.text();

    if (!uploadResp.ok) {
      let error = uploadText;
      try {
        error = JSON.parse(uploadText);
      } catch {}

      return {
        ok: false,
        error
      };
    }

    return {
      ok: true,
      path,
      url: `${env.SUPABASE_URL}/storage/v1/object/public/gloves-for-sale/${path}`
    };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || String(err)
    };
  }
}

async function uploadOrderPhoto(env, { orderNumber, filename, contentType, dataUrl }) {
  try {
    const base64 = String(dataUrl || "").split(",").pop();

    if (!base64) {
      return {
        ok: false,
        error: "Invalid image data."
      };
    }

    const bytes = base64ToUint8Array(base64);
    const maxBytes = 8 * 1024 * 1024;
    if (bytes.byteLength > maxBytes) {
      return {
        ok: false,
        error: "Image is too large. Please use a photo under 8 MB."
      };
    }

    const ext = extensionFromContentType(contentType, filename);
    const cleanName = safeStorageName(filename)
      .replace(/\.[a-z0-9]+$/i, "");
    const safeOrder = safeStorageName(orderNumber)
      .replace(/\.[a-z0-9]+$/i, "") || "order";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = `${safeOrder}/${stamp}-${cleanName}.${ext}`;

    const uploadResp = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/order-photos/${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": contentType,
          "x-upsert": "true"
        },
        body: bytes
      }
    );

    const uploadText = await uploadResp.text();

    if (!uploadResp.ok) {
      let error = uploadText;
      try {
        error = JSON.parse(uploadText);
      } catch {}

      return {
        ok: false,
        error
      };
    }

    return {
      ok: true,
      path,
      url: `${env.SUPABASE_URL}/storage/v1/object/public/order-photos/${path}`
    };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || String(err)
    };
  }
}

async function listGallerySection(env, section, options = {}) {
  try {
    const safeSection = safeGallerySection(section);
    const hidden = options.hidden === true;
    const prefix = hidden ? `_hidden/${safeSection}` : safeSection;

    const resp = await fetch(
      `${env.SUPABASE_URL}/storage/v1/object/list/gallery`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prefix,
          limit: 100,
          offset: 0,
          sortBy: {
            column: "name",
            order: "desc"
          }
        })
      }
    );

    const text = await resp.text();

    let data = [];
    try {
      data = text ? JSON.parse(text) : [];
    } catch {
      data = [];
    }

    if (!resp.ok) {
      return {
        ok: false,
        error: data || text || `Supabase storage list failed: ${resp.status}`
      };
    }

    const photos = (Array.isArray(data) ? data : [])
      .filter(item =>
        item &&
        item.name &&
        !item.name.endsWith("/") &&
        item.name !== ".emptyFolderPlaceholder"
      )
      .map(item => {
        const path = `${prefix}/${item.name}`;
        return galleryPhotoFromPath(env, path, hidden);
      });

    return {
      ok: true,
      photos
    };
  } catch (err) {
    return {
      ok: false,
      error: err && err.message ? err.message : String(err)
    };
  }
}

function galleryPhotoFromPath(env, path, hidden = false) {
  const parsed = parseGalleryPhotoPath(path);
  const name = parsed.name || String(path || "").split("/").pop() || "";
  const section = parsed.section || "";

  return {
    name,
    path,
    section,
    hidden,
    url: `${env.SUPABASE_URL}/storage/v1/object/public/gallery/${path}`
  };
}

function parseGalleryPhotoPath(path) {
  const clean = String(path || "").trim().replace(/^\/+/, "");
  if (!clean || clean.includes("..") || clean.includes("\\")) {
    return { ok: false };
  }

  const parts = clean.split("/").filter(Boolean);
  let hidden = false;
  let section = "";
  let name = "";

  if (parts.length === 2) {
    [section, name] = parts;
  } else if (parts.length === 3 && parts[0] === "_hidden") {
    hidden = true;
    section = parts[1];
    name = parts[2];
  } else {
    return { ok: false };
  }

  const safeSection = safeGallerySection(section);
  if (safeSection !== section || !name || name === ".emptyFolderPlaceholder" || name.includes("/")) {
    return { ok: false };
  }

  if (name.startsWith(".") || /[\\/\u0000-\u001f]/.test(name)) {
    return { ok: false };
  }

  return {
    ok: true,
    hidden,
    section,
    name,
    path: hidden ? `_hidden/${section}/${name}` : `${section}/${name}`
  };
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function extensionFromContentType(contentType, filename) {
  const type = String(contentType || "").toLowerCase();

  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  if (type.includes("heic")) return "heic";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";

  const match = String(filename || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "jpg";
}

function safeStorageName(filename) {
  return String(filename || "gallery-photo")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 80) || "gallery-photo";
}

function safeGallerySection(section) {
  const allowed = new Set([
    "fielding-gloves",
    "catchers-mitts",
    "first-base-mitts",
    "custom-color-relaces",
    "vintage"
  ]);

  const clean = String(section || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  return allowed.has(clean) ? clean : "fielding-gloves";
}

/* =========================
   EMAIL LOGIC
========================= */
const BRAND_NAME = "Murph's Mitt Maintenance";
const THANKS_LINE = "Thanks again for choosing Murph's Mitts!";
const REVIEW_URL = "https://g.page/r/CRL9ZI21aIheEBM/review";

const PAYMENT = {
  venmoUser: "murphsmitts",
  paypalMe: "kbrettmurphy",
  zelle: "214-356-1233"
};

function moneyNumber(value) {
  const n = Number(
    String(value ?? "").replace(/[^\d.-]/g, "")
  );

  return Number.isNaN(n) ? 0 : n;
}

function buildPaymentLinks(order) {
  const service = moneyNumber(order.priceQuoted);
  const shipping = moneyNumber(order.shippingCost);

  const total = service + shipping;
  const amount = total.toFixed(2);
  const shortAmount = String(Number(amount));

  const note = encodeURIComponent(
    `Murph's Mitts Order #${order.orderNumber || ""}`
  );

  return {
    service,
    shipping,
    total,
    amount,
    shortAmount,

    venmo:
      `venmo://paycharge?txn=pay&recipients=${PAYMENT.venmoUser}&amount=${amount}&note=${note}`,

    venmoText:
      PAYMENT.venmoUser,

    paypal:
      `https://paypal.me/${PAYMENT.paypalMe}/${amount}`,

    paypalText:
      `paypal.me/${PAYMENT.paypalMe}/${shortAmount}`,

    zelle:
      PAYMENT.zelle
  };
}

async function sendStatusEmail(env, row, statusDisplay) {
  const order = mapOrderFromDb(row);
  const email = String(order.emailAddress || "").trim();
  if (!email) {
    return { ok: true, skipped: true, reason: "No email address on order." };
  }

  const status = normalizeStatus(statusDisplay);
  if (!status) {
    return { ok: true, skipped: true, reason: "Blank status." };
  }

  if (isInternalOnlyStatus(status)) {
    return { ok: true, skipped: true, reason: `${statusDisplay} is internal-only.` };
  }

  const orderNum = String(order.orderNumber || "").trim() || "(unknown)";
  const firstName = getFirstName(order.customerName);
  const subject = `${BRAND_NAME} – Update for Order #${orderNum}: ${statusDisplay}`;
  const msg = statusMessageSmart(order, statusDisplay);

  const isCompleted = status === "completed";

  const beforeThanks =
`Hey${firstName ? " " + firstName : ""},

Quick update on your glove service.

Order #: ${orderNum}
New Status: ${statusDisplay}

${msg}`.trimEnd();

  const afterThanks =
`${THANKS_LINE}

-Brett`;

  const plainBody = isCompleted
    ? `${beforeThanks}\n\n${reviewText()}\n\n${afterThanks}`
    : `${beforeThanks}\n\n${afterThanks}`;

  const htmlBody = status === "ready to go"
  ? wrapReadyToGoEmailHtml(order, {
      firstName,
      orderNum,
      statusDisplay
    })
  : isCompleted
    ? wrapEmailHtmlSplit(beforeThanks, afterThanks, true)
    : wrapEmailHtmlSplit(beforeThanks, afterThanks, false);

  return await sendBrandedEmail(env, {
    to: email,
    subject,
    plainBody,
    htmlBody
  });
}

function statusMessageSmart(order, statusDisplay) {
  const s = normalizeStatus(statusDisplay);

  if (s === "received") {
    return "Your glove is checked in and queued up.";
  }

  if (s === "estimate sent") {
    const services = cleanDisplay(order.servicesRequested);
    const lace1 = cleanDisplay(order.primaryLaceColor || order.lacePrimary);
    const lace2 = cleanDisplay(order.secondaryLaceColor || order.laceAccent);
    const laceNotes = cleanDisplay(order.customLaceNotes || order.customColorRequest);
    const formattedPrice = formatCurrency(order.priceQuoted);

    return `Here is your estimate and request summary:

Services Requested:
${services || "Not specified"}

Lace Colors:
Primary: ${lace1 || "Not specified"}
Accent: ${lace2 || "None"}
${laceNotes ? "Color Notes: " + laceNotes : ""}

Estimated Total:
${formattedPrice || "Pending"}

Reply YES to approve and coordinate drop-off/shipping so that I can begin the work.
Reply NO to cancel this request.

If I don't hear back within 48 hours, the order will be placed on hold.`;
  }

  if (s === "in progress") {
    const formattedDate = formatLongDate(order.estimatedCompletion);

    return `Work has begun on your glove!${formattedDate ? "\n\nEstimated completion: " + formattedDate : ""}

I'll keep you updated if anything changes.`;
  }

  if (s === "waiting on lace/parts") {
    return "Your glove is temporarily on hold while I wait on materials needed to complete the work.\n\nAs soon as the lace/parts arrive, I'll be able to start the work and send another update.";
  }

  if (s === "ready to go") {
    const ship = looksLikeShipMethod(order.dropOffMethod);
    const paid = normalizePaidValue(order.paid);
    const pay = buildPaymentLinks(order);
  
    if (ship) {
      if (paid === "paid") {
        return `Your glove is finished and ready to ship!
  
  I'll get it packaged up and send tracking once it's on the way.`;
      }
  
      return `Your glove is finished and ready to ship!
  
  Amount Due
  
  Service:   ${formatCurrency(pay.service)}
  Shipping:  ${formatCurrency(pay.shipping)}
  ----------------------
  Total:     ${formatCurrency(pay.total)}
  
  Payment Options
  
  Venmo: ${pay.venmo}
  PayPal: ${pay.paypal}
  Zelle: ${pay.zelle}
  
Once payment is received, I'll ship your glove and send your tracking information.`;
    }
  
    if (paid === "paid") {
      return `Your glove is finished and ready for pickup!
  
  I'll call/text shortly to coordinate a pickup time.`;
    }
  
    return `Your glove is finished and ready for pickup!
  
  Amount Due
  
  Total: ${formatCurrency(pay.total)}
  
  Payment Options
  
  Venmo: ${pay.venmo}
  PayPal: ${pay.paypal}
  Zelle: ${pay.zelle}
  
  Once payment is received, I'll coordinate pickup with you unless you are paying cash.`;
  }
  
  if (s === "completed") {
    const ship = looksLikeShipMethod(order.dropOffMethod);
    const paid = normalizePaidValue(order.paid);

    if (ship) {
      const carrier = cleanDisplay(order.carrier);
      const tracking = cleanDisplay(order.trackingNumber || order.tracking);
      const link = buildTrackingLink(carrier, tracking);

      const trackingLine = tracking
        ? `\nCarrier: ${carrier || "Not specified"}\nTracking Number: ${tracking}${link ? "\nTracking Link: " + link : ""}`
        : "";

      if (paid !== "paid") {
        return `All finished up. Your glove is on the way!${trackingLine}

Quick note: this one went out under the “ship before payment” exception.
If you've already handled payment, you're all set.
If not, please take care of it when you can.`;
      }

      return `All finished up. Your glove is on the way!${trackingLine}

I really appreciate the support. Hope it feels great when it hits your mailbox.`;
    }

    if (paid !== "paid") {
      return `Your glove is all finished up.

I just need to get payment taken care of before we fully close this one out.
Whenever you're ready, shoot me a message and we'll settle up.

Appreciate you trusting me with it.`;
    }

    return `Your glove is officially finished and good to go!

I really appreciate you trusting me with your glove and hope it treats you well on the field.

If you ever need another glove cleaned up, relaced, or tuned up, you know where to find me!`;
  }

if (s === "on hold") {
  return `Your order has been placed on hold for now.

When you're ready to move forward with servicing your glove, just reply to this email and I’ll be happy to pick things back up from there.`;
}

  return "Status has been updated.";
}

async function sendBrandedEmail(env, { to, subject, plainBody, htmlBody }) {
  const from = env.RESEND_FROM || `${BRAND_NAME} <orders@murphsmitts.com>`;
  const replyTo = env.RESEND_REPLY_TO || undefined;

  const payload = {
    from,
    to: [to],
    bcc: ["murphsmitts@gmail.com"],
    subject,
    text: plainBody,
    html: htmlBody
  };

  if (replyTo) payload.reply_to = replyTo;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await resp.text();

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!resp.ok) {
    return {
      ok: false,
      error: data || `HTTP ${resp.status}`
    };
  }

  return {
    ok: true,
    data
  };
}

function mapSmsMessage(row) {
  return {
    id: row.id,
    direction: row.direction || "in",
    phoneNumber: row.phone_number,
    customerName: row.customer_name,
    orderNumber: row.order_number,
    body: row.body,
    mediaUrls: Array.isArray(row.media_urls) ? row.media_urls : [],
    read: row.read === true,
    createdAt: row.created_at
  };
}

async function sendTwilioSms(env, to, body, mediaUrl = null) {
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const form = new URLSearchParams();
  form.set("To", to);
  form.set("MessagingServiceSid", env.TWILIO_MESSAGING_SERVICE_SID);
  if (body) form.set("Body", body);
  if (mediaUrl) form.set("MediaUrl", mediaUrl);

  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${accountSid}:${env.TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    }
  );

  const text = await resp.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!resp.ok) return { ok: false, error: data };
  return { ok: true, sid: data && data.sid };
}

async function sendStatusText(env, row, statusDisplay) {
  const order = mapOrderFromDb(row);

  if (!order.smsOptIn) {
    return { ok: true, skipped: true, reason: "Customer did not opt in to SMS." };
  }

  const to = toE164US(order.phoneNumber);
  if (!to) {
    return { ok: true, skipped: true, reason: "Invalid or missing phone number." };
  }

  const status = normalizeStatus(statusDisplay);
  const orderNum = String(order.orderNumber || "").trim() || "(unknown)";

  const body = `Murph's Mitts: Order #${orderNum} update - ${statusDisplay}. ${smsMessageSmart(order, status)}`;

  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID;

  const form = new URLSearchParams();
  form.set("To", to);
  form.set("MessagingServiceSid", messagingServiceSid);
  form.set("Body", body);

  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    }
  );

  const text = await resp.text();

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!resp.ok) {
    return { ok: false, error: data || `Twilio HTTP ${resp.status}` };
  }

  /* Mirror every status text into the Messages inbox. Best-effort. */
  try {
    await supabaseFetch(env, `/rest/v1/sms_messages`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        direction: "out",
        phone_number: to,
        customer_name: order.customerName || null,
        order_number: orderNum,
        body,
        twilio_sid: (data && data.sid) || null,
        read: true
      })
    });
  } catch { /* never block the status text on inbox logging */ }

  return { ok: true, data };
}

function smsMessageSmart(order, status) {
  if (status === "estimate sent") {
    const estimate = formatCurrency(order.priceQuoted);
  
    return `Your estimate has been sent to your email.
  
  Estimated Total: ${estimate}
  
  Reply YES to approve or NO to place the request on hold.`;
  }

  if (status === "in progress") {
    const d = formatLongDate(order.estimatedCompletion);
    return `Work has begun on your glove.${d ? " Estimated completion: " + d + "." : ""}`;
  }

  if (status === "ready to go") {
  const ship = looksLikeShipMethod(order.dropOffMethod);
  const paid = normalizePaidValue(order.paid);
  const pay = buildPaymentLinks(order);

  if (paid === "paid") {
    return ship
      ? "Your glove is finished and ready to ship! I’ll send tracking once it’s on the way."
      : "Your glove is finished and ready for pickup! I’ll contact you shortly to coordinate pickup.";
  }

  if (ship) {
    return `Your glove is finished and ready to ship!

Service: ${formatCurrency(pay.service)}
Shipping: ${formatCurrency(pay.shipping)}
Total Due: ${formatCurrency(pay.total)}

Pay:
Venmo: ${pay.venmo}
PayPal: ${pay.paypalText}
Zelle: ${pay.zelle}

Your glove will ship once payment is received.`;
  }

  return `Your glove is finished and ready for pickup!

Total Due: ${formatCurrency(pay.total)}

Pay:
Venmo: ${pay.venmo}
PayPal: ${pay.paypalText}
Zelle: ${pay.zelle}

I'll coordinate pickup once payment is received.`;
}

  if (status === "completed") {
    const tracking = cleanDisplay(order.trackingNumber || order.tracking);
    return tracking
      ? `Your glove is complete and has shipped. Tracking: ${tracking}`
      : "Your glove service is complete. Thanks again for choosing Murph's Mitts!";
  }

  return "Your order status has been updated.";
}

function toE164US(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  return "";
}

function shouldSendTextForStatus(status) {
  return (
    status === "estimate sent" ||
    status === "in progress" ||
    status === "ready to go" ||
    status === "completed"
  );
}

function reviewText() {
  return `If I earned it, would you mind leaving me a review?
${REVIEW_URL}
It helps my small business show up in Google search results.`;
}

function reviewHtml() {
  return `
  <div style="margin:12px 0;">
    If I earned it, would you mind
    <a href="${escapeHtml(REVIEW_URL)}" target="_blank" style="text-decoration:underline;">leaving me a review</a>?
    <br>
    It helps my small business show up in Google search results.
  </div>`;
}

function wrapEmailHtmlSplit(beforeThanks, afterThanks, includeReview) {
  return `
  <div style="font-family: Arial, sans-serif; max-width: 640px; line-height: 1.45; text-align:left;">
    <div style="white-space:pre-wrap; margin:0;">${escapeHtml(beforeThanks)}</div>
    ${includeReview ? reviewHtml() : ""}
    <div style="white-space:pre-wrap; margin:0;">${escapeHtml(afterThanks)}</div>
  </div>`;
}

function wrapReadyToGoEmailHtml(order, { firstName, orderNum, statusDisplay }) {
  const ship = looksLikeShipMethod(order.dropOffMethod);
  const paid = normalizePaidValue(order.paid);
  const pay = buildPaymentLinks(order);

  const intro = ship
    ? "Your glove is finished and ready to ship."
    : "Your glove is finished and ready for pickup.";

  const closing = ship
    ? "Once payment is received, I'll ship your glove and send your tracking information."
    : "Once payment is received, I'll coordinate pickup with you unless you are paying cash.";

  const amountHtml = ship
    ? `
      <p style="margin:18px 0 8px;"><strong>Amount Due</strong></p>
      <table style="border-collapse:collapse; margin:0 0 14px;">
        <tr>
          <td style="padding:2px 20px 2px 0;">Service:</td>
          <td style="padding:2px 0;">${escapeHtml(formatCurrency(pay.service))}</td>
        </tr>
        <tr>
          <td style="padding:2px 20px 2px 0;">Shipping:</td>
          <td style="padding:2px 0;">${escapeHtml(formatCurrency(pay.shipping))}</td>
        </tr>
        <tr>
          <td colspan="2" style="border-top:1px solid #999; padding-top:6px;"></td>
        </tr>
        <tr>
          <td style="padding:2px 20px 2px 0;"><strong>Total:</strong></td>
          <td style="padding:2px 0;"><strong>${escapeHtml(formatCurrency(pay.total))}</strong></td>
        </tr>
      </table>
    `
    : `
      <p style="margin:18px 0 8px;"><strong>Amount Due</strong></p>
      <p style="margin:0 0 14px;"><strong>Total:</strong> ${escapeHtml(formatCurrency(pay.total))}</p>
    `;

  const paymentHtml = paid === "paid"
    ? ""
    : `
      ${amountHtml}

      <p style="margin:18px 0 8px;"><strong>Payment Options</strong></p>

      <p style="margin:0 0 6px;">
        <a href="${escapeHtml(pay.venmo)}" target="_blank" style="color:#0645ad; text-decoration:underline;">Venmo</a>
      </p>

      <p style="margin:0 0 6px;">
        <a href="${escapeHtml(pay.paypal)}" target="_blank" style="color:#0645ad; text-decoration:underline;">PayPal</a>
      </p>

      <p style="margin:0 0 18px;">
        Zelle: ${escapeHtml(pay.zelle)}
      </p>

      <p style="margin:0 0 18px;">${escapeHtml(closing)}</p>
    `;

  return `
  <div style="font-family: Arial, sans-serif; max-width: 640px; line-height: 1.45; text-align:left;">
    <p>Hey${firstName ? " " + escapeHtml(firstName) : ""},</p>

    <p>Quick update on your glove service.</p>

    <p>
      Order #: ${escapeHtml(orderNum)}<br>
      New Status: ${escapeHtml(statusDisplay)}
    </p>

    <p>${escapeHtml(intro)}</p>

    ${paymentHtml}

    <p>${escapeHtml(THANKS_LINE)}</p>

    <p>-Brett</p>
  </div>`;
}

async function geocodeAddresses(rawItems) {
  const items = rawItems
    .map(parseGeocodeItem)
    .filter(Boolean)
    .slice(0, 250);
  const results = [];

  for (const item of items) {
    const result = await geocodeCandidateAddresses(item);
    results.push(result);

    if (result.source === "nominatim") {
      await delayMs(1000);
    }
  }

  return results;
}

async function geocodeMissingOrderAddresses(env, rawItems) {
  const items = rawItems
    .map(parseMissingOrderGeocodeItem)
    .filter(Boolean)
    .slice(0, 250);
  const results = {};

  for (const item of items) {
    const existing = await fetchOrderByNumber(env, item.orderNumber);
    if (!existing.ok || !existing.data) {
      results[item.orderNumber] = {
        ok: false,
        error: "Order not found."
      };
      continue;
    }

    if (hasMatchingStoredMapLocation(existing.data, item.addressHash)) {
      const order = mapOrderFromDb(existing.data);
      results[item.orderNumber] = {
        ok: true,
        skipped: true,
        order,
        lat: Number(order.mapLat),
        lng: Number(order.mapLng),
        address: order.mapGeocodedAddress,
        source: order.mapGeocodeSource,
        status: order.mapGeocodeStatus,
        quality: getStoredMapGeocodeQuality(existing.data)
      };
      continue;
    }

    const geocode = await geocodeCandidateAddresses({
      key: item.orderNumber,
      candidates: item.candidates
    });
    const geocodedAt = new Date().toISOString();
    const patchBody = geocode.ok
      ? {
          map_lat: geocode.lat,
          map_lng: geocode.lng,
          map_geocoded_address: geocode.address || item.candidates[0],
          map_geocode_source: geocode.source || null,
          map_geocode_status: "ok",
          map_geocode_quality: geocode.quality || "exact",
          map_geocode_error: null,
          map_address_hash: item.addressHash || null,
          map_geocoded_at: geocodedAt
        }
      : {
          map_lat: null,
          map_lng: null,
          map_geocoded_address: null,
          map_geocode_source: null,
          map_geocode_status: "failed",
          map_geocode_quality: "failed",
          map_geocode_error: geocode.reason || "No coordinates found.",
          map_address_hash: item.addressHash || null,
          map_geocoded_at: geocodedAt
        };

    const patch = await supabaseFetch(
      env,
      `/rest/v1/orders?order_number=eq.${encodeURIComponent(item.orderNumber)}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation"
        },
        body: JSON.stringify(patchBody)
      }
    );

    if (!patch.ok) {
      results[item.orderNumber] = {
        ok: false,
        error: "Failed to store geocode result.",
        details: patch.error
      };
      continue;
    }

    const updated = Array.isArray(patch.data) ? patch.data[0] : null;
    const order = updated ? mapOrderFromDb(updated) : null;
    results[item.orderNumber] = {
      ok: !!geocode.ok,
      order,
      lat: geocode.ok ? geocode.lat : null,
      lng: geocode.ok ? geocode.lng : null,
      address: geocode.ok ? (geocode.address || item.candidates[0]) : null,
      source: geocode.ok ? (geocode.source || null) : null,
      status: geocode.ok ? "ok" : "failed",
      quality: geocode.ok ? (geocode.quality || "exact") : "failed",
      error: geocode.ok ? null : (geocode.reason || "No coordinates found.")
    };
  }

  return results;
}

function parseGeocodeItem(input) {
  const key = cleanDisplay(input?.key || input?.orderNumber);
  const candidates = Array.isArray(input?.candidates)
    ? input.candidates.map(cleanDisplay).filter(Boolean).slice(0, 8)
    : [];

  if (!key || !candidates.length) return null;

  return {
    key,
    candidates: uniqueTextValues(candidates)
  };
}

function parseMissingOrderGeocodeItem(input) {
  const orderNumber = cleanDisplay(input?.orderNumber);
  const addressHash = cleanDisplay(input?.addressHash);
  const candidates = Array.isArray(input?.candidates)
    ? input.candidates.map(cleanDisplay).filter(Boolean).slice(0, 8)
    : [];

  if (!orderNumber || !candidates.length) return null;

  return {
    orderNumber,
    addressHash,
    candidates: uniqueTextValues(candidates)
  };
}

function hasMatchingStoredMapLocation(row, addressHash) {
  const lat = Number(row?.map_lat);
  const lng = Number(row?.map_lng);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    cleanDisplay(row?.map_address_hash) === cleanDisplay(addressHash)
  );
}

function hasStreetInAddress(address) {
  const value = String(address || "").trim();
  if (!value) return false;
  if (/^\d+\s+\S/.test(value)) return true;
  return /\b(st|street|ave|avenue|rd|road|dr|drive|ln|lane|way|blvd|boulevard|ct|court|pl|place|cir|circle|hwy|highway|pkwy|parkway|trl|trail|pike|run|pass|cove|loop)\b/i.test(value);
}

function nominatimHasStreetLevel(addressObj) {
  if (!addressObj || typeof addressObj !== "object") return false;
  return !!(
    addressObj.house_number ||
    addressObj.house_name ||
    addressObj.road ||
    addressObj.street ||
    addressObj.pedestrian ||
    addressObj.residential ||
    addressObj.footway
  );
}

function extractStreetTokens(streetAddress) {
  const cleaned = String(streetAddress || "")
    .replace(/\b(?:apt|apartment|unit|ste|suite|bldg|building|fl|floor|#)\s*[\w-]+.*$/i, "")
    .replace(/[.,;]+/g, " ")
    .trim()
    .toLowerCase();

  if (!cleaned) return [];

  const tokens = cleaned
    .split(/\s+/)
    .filter(token => token && !/^\d+$/.test(token) && token.length > 2);

  return tokens.slice(0, 3);
}

function streetAppearsInGeocodedText(streetAddress, geocodedText) {
  const tokens = extractStreetTokens(streetAddress);
  if (!tokens.length) return true;

  const haystack = String(geocodedText || "").toLowerCase();
  return tokens.some(token => haystack.includes(token));
}

function isCityStateZipOnlyAddress(address) {
  const value = String(address || "").trim();
  if (!value) return false;
  return /^[^,]+,\s*[A-Za-z]{2}\s+\d{5}(?:-\d{4})?$/.test(value);
}

function classifyCensusGeocodeQuality(submittedAddress, matchedAddress) {
  const expectsStreet = hasStreetInAddress(submittedAddress);
  const matched = String(matchedAddress || submittedAddress || "").trim();

  if (!expectsStreet) {
    return isCityStateZipOnlyAddress(matched) ? "approximate" : "exact";
  }

  if (!streetAppearsInGeocodedText(submittedAddress, matched)) {
    return "approximate";
  }

  return "exact";
}

function classifyNominatimGeocodeQuality(submittedAddress, result) {
  const expectsStreet = hasStreetInAddress(submittedAddress);
  const addressObj = result?.addressDetails || {};
  const hasStreetLevel = nominatimHasStreetLevel(addressObj);
  const displayAddress = String(result?.address || submittedAddress || "").trim();
  const lowPrecisionTypes = new Set([
    "postcode",
    "administrative",
    "city",
    "town",
    "village",
    "hamlet",
    "county",
    "state",
    "region"
  ]);
  const isLowPrecision =
    lowPrecisionTypes.has(String(result?.type || "").trim()) ||
    (String(result?.class || "").trim() === "place" && !hasStreetLevel);

  if (isCityStateZipOnlyAddress(displayAddress) || (isCityStateZipOnlyAddress(submittedAddress) && isLowPrecision)) {
    return "approximate";
  }

  if (expectsStreet && (!hasStreetLevel || isLowPrecision)) {
    return "approximate";
  }

  if (expectsStreet && !streetAppearsInGeocodedText(submittedAddress, displayAddress)) {
    return "approximate";
  }

  if (!expectsStreet && !hasStreetLevel) {
    return "approximate";
  }

  return "exact";
}

function deriveMapGeocodeQualityFromRow(row) {
  const stored = cleanDisplay(row?.map_geocode_quality)?.toLowerCase();
  if (stored === "exact" || stored === "approximate" || stored === "failed") {
    return stored;
  }

  if (cleanDisplay(row?.map_geocode_status) === "failed") {
    return "failed";
  }

  const lat = Number(row?.map_lat);
  const lng = Number(row?.map_lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return "failed";
  }

  const street = cleanDisplay(row?.street_address);
  const geocoded = cleanDisplay(row?.map_geocoded_address);
  const source = cleanDisplay(row?.map_geocode_source);

  if (geocoded && isCityStateZipOnlyAddress(geocoded)) {
    return "approximate";
  }

  if (street && hasStreetInAddress(street) && geocoded && !streetAppearsInGeocodedText(street, geocoded)) {
    return "approximate";
  }

  if (source === "nominatim" && street && hasStreetInAddress(street) && geocoded) {
    return streetAppearsInGeocodedText(street, geocoded) ? "exact" : "approximate";
  }

  return "exact";
}

function getStoredMapGeocodeQuality(row) {
  return deriveMapGeocodeQualityFromRow(row);
}

async function geocodeCandidateAddresses(item) {
  let lastReason = "No coordinates found.";

  for (let i = 0; i < item.candidates.length; i += 1) {
    const address = item.candidates[i];
    const census = await geocodeWithCensus(address);
    if (census.ok) {
      return {
        key: item.key,
        ok: true,
        address: census.address || address,
        lat: census.lat,
        lng: census.lng,
        source: "census",
        quality: classifyCensusGeocodeQuality(address, census.address || address)
      };
    }
    lastReason = census.reason || lastReason;

    const nominatim = await geocodeWithNominatim(address);
    if (nominatim.ok) {
      return {
        key: item.key,
        ok: true,
        address: nominatim.address || address,
        lat: nominatim.lat,
        lng: nominatim.lng,
        source: "nominatim",
        quality: classifyNominatimGeocodeQuality(address, nominatim)
      };
    }
    lastReason = nominatim.reason || lastReason;

    if (i < item.candidates.length - 1) {
      await delayMs(1000);
    }
  }

  return {
    key: item.key,
    ok: false,
    reason: lastReason,
    quality: "failed"
  };
}

async function geocodeWithCensus(address) {
  const url =
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress" +
    `?benchmark=Public_AR_Current&format=json&address=${encodeURIComponent(address)}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json"
      }
    });
    const data = await safeJson(res);

    if (!res.ok) {
      return { ok: false, reason: `Census geocoding failed: ${res.status}` };
    }

    const match = data?.result?.addressMatches?.[0];
    const lat = Number(match?.coordinates?.y);
    const lng = Number(match?.coordinates?.x);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ok: false, reason: "No Census coordinates found." };
    }

    return {
      ok: true,
      address: cleanDisplay(match.matchedAddress),
      lat,
      lng,
      matchedAddress: cleanDisplay(match.matchedAddress)
    };
  } catch (err) {
    return {
      ok: false,
      reason: err?.message || "Census geocoding failed."
    };
  }
}

async function geocodeWithNominatim(address) {
  const url =
    "https://nominatim.openstreetmap.org/search" +
    `?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(address)}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MurphsMittsAdmin/1.0"
      }
    });
    const data = await safeJson(res);

    if (!res.ok) {
      return { ok: false, reason: `OpenStreetMap geocoding failed: ${res.status}` };
    }

    const first = Array.isArray(data) ? data[0] : null;
    const lat = Number(first?.lat);
    const lng = Number(first?.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ok: false, reason: "No OpenStreetMap coordinates found." };
    }

    return {
      ok: true,
      lat,
      lng,
      address: cleanDisplay(first?.display_name) || cleanDisplay(address),
      addressDetails: first?.address || {},
      type: cleanDisplay(first?.type),
      class: cleanDisplay(first?.class)
    };
  } catch (err) {
    return {
      ok: false,
      reason: err?.message || "OpenStreetMap geocoding failed."
    };
  }
}

function uniqueTextValues(values) {
  const seen = new Set();
  const out = [];

  values.forEach(value => {
    const key = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(value);
  });

  return out;
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function delayMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* =========================
   SMALL HELPERS
========================= */
function cleanText(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function cleanNumeric(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isNaN(n) ? null : n;
}

function cleanDate(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function toBoolean(value) {
  if (value === true) return true;
  const v = String(value || "").trim().toLowerCase();
  return v === "true" || v === "yes" || v === "1" || v === "checked";
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDisplayStatus(value) {
  return String(value || "").trim();
}

function normalizePaidValue(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "paid" || v === "yes" || v === "true") return "paid";
  return "unpaid";
}

function looksLikeShipMethod(value) {
  return String(value || "").trim().toLowerCase().includes("ship");
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isNaN(n) ? String(value) : `$${n.toFixed(2)}`;
}

function formatLongDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function todayIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getFirstName(fullName) {
  const s = String(fullName || "").trim();
  return s ? s.split(/\s+/)[0] : "";
}

function cleanDisplay(value) {
  return String(value || "").trim();
}

function buildTrackingLink(carrierRaw, trackingNumberRaw) {
  const carrier = String(carrierRaw || "").trim().toLowerCase();
  const tracking = String(trackingNumberRaw || "").trim();
  if (!tracking) return "";

  const enc = encodeURIComponent(tracking);
  if (carrier.includes("usps")) return "https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=" + enc;
  if (carrier.includes("ups")) return "https://www.ups.com/track?loc=en_US&tracknum=" + enc;
  if (carrier.includes("fedex") || carrier.includes("fed ex")) return "https://www.fedex.com/fedextrack/?trknbr=" + enc;
  return "";
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isInternalOnlyStatus(value) {
  const status = normalizeStatus(value);
  return (
    status === "picked up" ||
    status === "pending response" ||
    status === "in transit to me" ||
    status === "customer approved"
  );
}
