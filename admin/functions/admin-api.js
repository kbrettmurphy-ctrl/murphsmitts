export async function onRequestPost(context) {
  try {
    const body = await context.request.text();

    const gasUrl = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";

    const resp = await fetch(gasUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body,
      redirect: "follow"
    });

    const text = await resp.text();
    const contentType = resp.headers.get("content-type") || "";

    return new Response(text, {
      status: resp.status,
      headers: {
        "Content-Type": contentType.includes("application/json")
          ? "application/json; charset=utf-8"
          : "text/plain; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err.message || String(err)
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
