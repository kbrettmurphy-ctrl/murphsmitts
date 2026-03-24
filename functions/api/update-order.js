export async function onRequest(context) {
  const { request, env } = context;

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

  const body = await request.json();
  const { order_number, updates } = body;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?order_number=eq.${order_number}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(updates)
    }
  );

  const data = await res.json();

  return new Response(JSON.stringify({ ok: true, order: data[0] }), {
    headers: { "Content-Type": "application/json" }
  });
}
