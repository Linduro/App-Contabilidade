/**
 * Proxy Datajud — contorna CORS no browser (GitHub Pages).
 */
const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br"
const API_KEY =
  "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=="

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || ""
  let allow = "https://linduro.github.io"
  if (origin) {
    if (
      origin.endsWith(".github.io") ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1") ||
      origin.includes("firebaseapp.com") ||
      origin.includes("web.app")
    ) {
      allow = origin
    }
  }
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
  }
}

function isValidEndpoint(endpoint) {
  return typeof endpoint === "string" && /^api_publica_[a-z0-9]+$/i.test(endpoint)
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request)

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers })
    }

    if (request.method === "GET") {
      return Response.json(
        { ok: true, service: "datajud-proxy", version: 2 },
        { headers },
      )
    }

    if (request.method !== "POST") {
      return Response.json({ error: "Use POST" }, { status: 405, headers })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: "JSON inválido" }, { status: 400, headers })
    }

    const endpoint = body?.endpoint
    const query = body?.query
    if (!isValidEndpoint(endpoint) || !query || typeof query !== "object") {
      return Response.json(
        { error: "Corpo: { endpoint: 'api_publica_trt15', query: {...} }" },
        { status: 400, headers },
      )
    }

    const apiKey = env.DATAJUD_API_KEY || API_KEY
    const url = `${DATAJUD_BASE}/${endpoint}/_search`

    try {
      const upstream = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `APIKey ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(query),
      })

      const text = await upstream.text()
      return new Response(text, {
        status: upstream.status,
        headers: {
          ...headers,
          "Content-Type": upstream.headers.get("content-type") || "application/json",
        },
      })
    } catch (err) {
      return Response.json(
        { error: err.message || "Falha upstream" },
        { status: 502, headers },
      )
    }
  },
}
