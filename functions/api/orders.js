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

    if (action === "login") {
      const pin = String(body.pin || "").trim();

      if (!pin || pin !== String(env.ADMIN_PIN).trim()) {
        return json(
          {
            ok: false,
            error: "Invalid PIN."
          },
          200,
          jsonHeaders
        );
      }

      const token = await createSignedToken(
        {
          role: "admin",
          exp: Date.now() + 1000 * 60 * 60 * 24 * 14
        },
        env.ADMIN_SESSION_SECRET
      );

      return json(
        {
          ok: true,
          token
        },
        200,
        jsonHeaders
      );
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

    if (action === "listGalleryPhotos") {
      const sections = [
        "fielding-gloves",
        "catchers-mitts",
        "first-base-mitts",
        "custom-color-relaces",
        "vintage"
      ];

      const gallery = {};

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
      }

      return json(
        {
          ok: true,
          gallery
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
    glovePhotos: Array.isArray(row.glove_photos)
      ? row.glove_photos
      : row.glove_photos
        ? JSON.parse(row.glove_photos)
        : [],

    orderNumber: row.order_number,
    status: row.status,
    dateReceived: row.date_received,
    estimatedCompletion: row.estimated_completion,
    priceQuoted: row.price_quoted,
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
  if ("shippingCost" in updates) out.shipping_cost = cleanNumeric(updates.shippingCost);
  if ("paid" in updates) out.paid = cleanText(updates.paid);

  if ("allowShipWithoutPayment" in updates) out.allow_ship_without_payment = toBoolean(updates.allowShipWithoutPayment);

  if ("trackingNumber" in updates) out.tracking_number = cleanText(updates.trackingNumber);
  if ("tracking" in updates && !("trackingNumber" in updates)) out.tracking_number = cleanText(updates.tracking);

  if ("carrier" in updates) out.carrier = cleanText(updates.carrier);

  if ("dateReceived" in updates) out.date_received = cleanDate(updates.dateReceived);
  if ("estimatedCompletion" in updates) out.estimated_completion = cleanDate(updates.estimatedCompletion);
  if ("dateCompleted" in updates) out.date_completed = cleanDate(updates.dateCompleted);

  if ("internalNotes" in updates) out.internal_notes = cleanText(updates.internalNotes);
  if ("lastStatusEmailed" in updates) out.last_status_emailed = cleanText(updates.lastStatusEmailed);

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

async function listGallerySection(env, section) {
  try {
    const safeSection = safeGallerySection(section);

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
          prefix: safeSection,
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
        const path = `${safeSection}/${item.name}`;

        return {
          name: item.name,
          path,
          url: `${env.SUPABASE_URL}/storage/v1/object/public/gallery/${path}`
        };
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
      `https://account.venmo.com/pay?recipients=${PAYMENT.venmoUser}&amount=${amount}&note=${note}`,

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

  const htmlBody = isCompleted
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
        return `Your glove is finished and ready to ship.
  
  I'll get it packaged up and send tracking once it's on the way.`;
      }
  
      return `Your glove is finished and ready to ship.
  
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
      return `Your glove is finished and ready for pickup.
  
  I'll call/text shortly to coordinate a pickup time.`;
    }
  
    return `Your glove is finished and ready for pickup.
  
  Amount Due
  
  Total: ${formatCurrency(pay.total)}
  
  Payment Options
  
  Venmo: ${pay.venmo}
  PayPal: ${pay.paypal}
  Zelle: ${pay.zelle}
  
  Once payment is received, I'll coordinate pickup with you.`;
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

  return { ok: true, data };
}

function smsMessageSmart(order, status) {
  if (status === "estimate sent") {
    return "Your estimate has been sent to your email with a quote and service details. Reply YES to this text to approve, or NO to place the request on hold.";
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
      ? "Your glove is finished and ready to ship. I’ll send tracking once it’s on the way."
      : "Your glove is finished and ready for pickup. I’ll contact you shortly to coordinate pickup.";
  }

  if (ship) {
    return `Your glove is finished and ready to ship.

Service: ${formatCurrency(pay.service)}
Shipping: ${formatCurrency(pay.shipping)}
Total Due: ${formatCurrency(pay.total)}

Pay:
Venmo: @${pay.venmoText}
PayPal: ${pay.paypalText}
Zelle: ${pay.zelle}

Your glove will ship once payment is received.`;
  }

  return `Your glove is finished and ready for pickup.

Total Due: ${formatCurrency(pay.total)}

Pay:
Venmo: @${pay.venmoText}
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
