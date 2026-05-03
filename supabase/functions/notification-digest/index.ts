import "@supabase/functions-js/edge-runtime.d.ts"

const cronSecret = Deno.env.get("NOTIFICATION_CRON_SECRET") ?? ""

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST,OPTIONS",
        "access-control-allow-headers": "content-type,x-placeprep-cron-secret",
      },
    })
  }

  if (request.method !== "POST") {
    return json(405, {
      success: false,
      error: "Method not allowed",
    })
  }

  if (cronSecret) {
    const providedSecret = request.headers.get("x-placeprep-cron-secret") ?? ""
    if (providedSecret !== cronSecret) {
      return json(401, {
        success: false,
        error: "Invalid cron secret",
      })
    }
  }

  const payload = await request.json().catch(() => ({}))

  return json(202, {
    success: true,
    data: {
      status: "accepted",
      migrationState: "scaffolded",
      message: "Notification digest scheduling should move here from the Node cron worker.",
      receivedAt: new Date().toISOString(),
      payload,
      nextWork: [
        "Port notification selection logic from notification.service.js",
        "Replace SMTP with Resend HTTP calls inside this function",
        "Invoke this function from pg_cron + pg_net on the desired schedule",
      ],
    },
  })
})
