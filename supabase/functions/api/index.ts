import "@supabase/functions-js/edge-runtime.d.ts"

const appUrl = Deno.env.get("APP_URL") ?? ""
const frontendOrigins = [
  appUrl,
  ...(Deno.env.get("CLIENT_URLS") ?? "").split(","),
  Deno.env.get("CLIENT_URL") ?? "",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].map((value) => value.trim()).filter(Boolean)

const allowedOrigins = new Set(frontendOrigins)
const knownRouteGroups = [
  "auth",
  "invites",
  "tasks",
  "logs",
  "power-pocket",
  "progress",
  "profile",
  "notifications",
  "apk",
  "uploads",
  "resume",
  "ai",
  "assessments",
  "coach",
]

function resolveCorsOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) {
    return appUrl || "*"
  }

  if (allowedOrigins.has(origin)) {
    return origin
  }

  try {
    const parsed = new URL(origin)
    if (parsed.hostname.endsWith(".vercel.app")) {
      return origin
    }
  } catch {
    return appUrl || "*"
  }

  return appUrl || "*"
}

function buildHeaders(request: Request, extras: HeadersInit = {}) {
  return {
    "content-type": "application/json",
    "access-control-allow-origin": resolveCorsOrigin(request),
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-placeprep-cron-secret",
    ...extras,
  }
}

function json(request: Request, status: number, payload: unknown, extras: HeadersInit = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: buildHeaders(request, extras),
  })
}

function notYetMigrated(request: Request, routeGroup: string, pathname: string) {
  return json(request, 501, {
    success: false,
    error: "Not migrated yet",
    data: {
      routeGroup,
      pathname,
      message: `The ${routeGroup} route group still needs to be ported from Express to Supabase Edge Functions.`,
    },
  })
}

function buildHealthPayload() {
  return {
    success: true,
    data: {
      status: "ok",
      service: "PlacePrep Supabase API",
      migrationState: "scaffolded",
      timestamp: new Date().toISOString(),
      appUrl: appUrl || null,
      cloudinaryEnabled: Boolean(Deno.env.get("CLOUDINARY_CLOUD_NAME")),
      resendEnabled: Boolean(Deno.env.get("RESEND_API_KEY")),
      openAiEnabled: Boolean(Deno.env.get("OPENAI_API_KEY")),
    },
  }
}

function normalizePath(pathname: string) {
  return pathname.replace(/^\/+/, "")
}

Deno.serve(async (request) => {
  const url = new URL(request.url)
  const pathname = url.pathname
  const normalized = normalizePath(pathname)

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: buildHeaders(request),
    })
  }

  if (
    request.method === "GET"
    && (pathname === "/" || pathname === "/healthz" || pathname === "/api/health")
  ) {
    return json(request, 200, buildHealthPayload())
  }

  const routeGroup = knownRouteGroups.find((group) =>
    normalized === group || normalized.startsWith(`${group}/`) || normalized === `api/${group}` || normalized.startsWith(`api/${group}/`)
  )

  if (routeGroup) {
    return notYetMigrated(request, routeGroup, pathname)
  }

  return json(request, 404, {
    success: false,
    error: "Route not found",
    data: {
      pathname,
      message: "This path is not defined in the Supabase backend scaffold yet.",
    },
  })
})
