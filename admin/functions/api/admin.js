export async function onRequest(context) {
  if (context.request.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        message: "admin-api is alive"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        }
      }
    );
  }

  if (context.request.method !== "POST") {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Method not allowed: ${context.request.method}`
      }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        }
      }
    );
  }

  try {
    const body = await context.request.text();

    const gasUrl = "https://script.google.com/macros/s/AKfycbxP6u0LhKFt0E9iyZqq0lOjK0S2ZQcfB386sf_fQWYL2abm2CvhLl9wNm1qaxW5oZTcBg/exec";

    const resp = await fetch(gasUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
        "Accept": "application/json,text/plain,*/*"
      },
      body,
      redirect: "follow"
    });

    const text = await resp.text();
    const contentType = resp.headers.get("content-type") || "";

    // If Google actually gave us JSON, pass it through cleanly.
    if (text && contentType.toLowerCase().includes("application/json")) {
      return new Response(text, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        }
      });
    }

    // If Google gave us text that happens to be JSON, pass it through.
    if (text) {
      try {
        JSON.parse(text);
        return new Response(text, {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store"
          }
        });
      } catch (_) {
        // fall through to debug response
      }
    }

    // Return a JSON debug envelope so the browser stops saying "Non-JSON response".
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Upstream Apps Script did not return JSON.",
        upstreamStatus: resp.status,
        upstreamContentType: contentType || "[none]",
        upstreamBodyPreview: text ? text.slice(0, 500) : "[empty response]"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err && err.message ? err.message : String(err)
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
