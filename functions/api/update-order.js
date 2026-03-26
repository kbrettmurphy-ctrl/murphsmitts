export async function onRequest(context) {
  const { request, env } = context;

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

  const body = await request.json();
  const { order_number, updates, deleteOrder } = body;

  if (!order_number) {
    return new Response(JSON.stringify({
      ok: false,
      error: "Missing order_number"
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (deleteOrder) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?order_number=eq.${encodeURIComponent(order_number)}`,
      {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: "return=representation"
        }
      }
    );

    let data = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      return new Response(JSON.stringify({
        ok: false,
        error: data || `Delete failed (${res.status})`
      }), {
        status: res.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      deleted: true,
      order_number
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?order_number=eq.${encodeURIComponent(order_number)}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(updates || {})
    }
  );

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    return new Response(JSON.stringify({
      ok: false,
      error: data || `Update failed (${res.status})`
    }), {
      status: res.status,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    order: Array.isArray(data) ? data[0] : data
  }), {
    headers: { "Content-Type": "application/json" }
  });
}