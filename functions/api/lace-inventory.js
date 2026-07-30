export async function onRequest(context) {
  const { env } = context;

  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing Supabase environment variables."
        }),
        { status: 500, headers }
      );
    }

    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/lace_inventory?select=color,quantity_on_hand,active,photo_url&active=eq.true`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );

    const text = await res.text();

    let data = null;
    try {
      data = text ? JSON.parse(text) : [];
    } catch {
      data = [];
    }

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: data || `Supabase error ${res.status}`
        }),
        { status: 500, headers }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        inventory: data
      }),
      { status: 200, headers }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err && err.message ? err.message : String(err)
      }),
      { status: 500, headers }
    );
  }
}
