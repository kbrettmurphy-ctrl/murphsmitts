export async function onRequestGet(context) {
  const { env } = context;

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return json({ ok: false, error: "Missing Supabase environment variables." }, 500, headers);
    }

    const glovesResp = await supabaseFetch(
      env,
      `/rest/v1/gloves_for_sale?select=*&status=neq.hidden&order=sort_order.asc,created_at.desc`
    );

    if (!glovesResp.ok) {
      return json({
        ok: false,
        error: "Failed to load gloves.",
        details: glovesResp.error
      }, 500, headers);
    }

    const gloves = Array.isArray(glovesResp.data) ? glovesResp.data : [];
    const ids = gloves.map(g => g.id).filter(Boolean);

    let photos = [];

    if (ids.length) {
      const photoResp = await supabaseFetch(
        env,
        `/rest/v1/glove_sale_photos?select=*&glove_id=in.(${ids.map(encodeURIComponent).join(",")})&order=sort_order.asc,id.asc`
      );

      if (photoResp.ok && Array.isArray(photoResp.data)) {
        photos = photoResp.data;
      }
    }

    const glovesWithPhotos = gloves.map(glove => {
      const glovePhotos = photos.filter(p => String(p.glove_id) === String(glove.id));

      const primary =
        glovePhotos.find(p => p.is_primary) ||
        glovePhotos[0] ||
        null;

      const hover =
        glovePhotos.find(p => p.is_hover) ||
        glovePhotos.find(p => primary && p.id !== primary.id) ||
        primary ||
        null;

      return {
        id: glove.id,
        slug: glove.slug,
        title: glove.title,
        shortDescription: glove.short_description,
        description: glove.description,
        price: glove.price,
        brand: glove.brand,
        model: glove.model,
        gloveSize: glove.glove_size,
        position: glove.position,
        web: glove.web,
        throwHand: glove.throw_hand,
        condition: glove.condition,
        status: glove.status,
        purchaseUrl: glove.purchase_url,
        featured: glove.featured,
        primaryPhoto: primary ? primary.url : "",
        hoverPhoto: hover ? hover.url : "",
        photos: glovePhotos.map(p => ({
          id: p.id,
          url: p.url,
          isPrimary: p.is_primary,
          isHover: p.is_hover,
          sortOrder: p.sort_order
        }))
      };
    });

    return json({
      ok: true,
      gloves: glovesWithPhotos
    }, 200, headers);

  } catch (err) {
    return json({
      ok: false,
      error: err?.message || String(err)
    }, 500, headers);
  }
}

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers
  });
}

async function supabaseFetch(env, path, options = {}) {
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
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
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