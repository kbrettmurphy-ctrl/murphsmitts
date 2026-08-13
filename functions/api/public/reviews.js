function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function mapPublicReview(row, placement) {
  return {
    id: row.id,
    reviewerName: row.reviewer_name,
    reviewerLocation: row.reviewer_location || "",
    rating: Number(row.rating) || 5,
    text: placement === "homepage"
      ? (row.homepage_excerpt || row.review_text)
      : row.review_text,
    reviewDate: row.review_date || null,
    dateLabel: row.relative_date_label || "",
    source: "Google Review"
  };
}

export async function onRequestGet({ env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: "Reviews are unavailable." }, 503);
  }

  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
  };
  const select = "id,reviewer_name,reviewer_location,rating,review_text,review_date,relative_date_label,homepage_excerpt";
  const base = `${env.SUPABASE_URL}/rest/v1/customer_reviews?select=${select}&hidden=eq.false`;

  try {
    const [homeResp, servicesResp] = await Promise.all([
      fetch(`${base}&homepage_featured=eq.true&order=homepage_sort_order.asc,created_at.desc&limit=3`, { headers }),
      fetch(`${base}&services_featured=eq.true&order=services_sort_order.asc,created_at.desc&limit=6`, { headers })
    ]);
    if (!homeResp.ok || !servicesResp.ok) {
      return json({ ok: false, error: "Reviews could not be loaded." }, 502);
    }
    const [homeRows, servicesRows] = await Promise.all([homeResp.json(), servicesResp.json()]);
    return json({
      ok: true,
      homepage: (homeRows || []).map(row => mapPublicReview(row, "homepage")),
      services: (servicesRows || []).map(row => mapPublicReview(row, "services"))
    });
  } catch (error) {
    return json({ ok: false, error: "Reviews could not be loaded." }, 502);
  }
}
