export async function onRequestPost(context) {
  try {
    const body = await context.request.text();

    const gasUrl = "https://script.google.com/macros/s/AKfycbxP6u0LhKFt0E9iyZqq0lOjK0S2ZQcfB386sf_fQWYL2abm2CvhLl9wNm1qaxW5oZTcBg/exec";

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
