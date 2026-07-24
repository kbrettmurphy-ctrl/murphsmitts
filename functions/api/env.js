/* GET /api/env — non-sensitive environment signal for the preview badge.
   Returns only whether this deployment is a preview. No secrets, no data. Used
   by the public site and MurphOS admin to show a PREVIEW indicator. */

import { isPreviewEnvironment, getEnvironmentName } from "./_env.js";

export async function onRequestGet(context) {
  const { env } = context;
  return new Response(
    JSON.stringify({
      ok: true,
      preview: isPreviewEnvironment(env),
      environment: getEnvironmentName(env)
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
