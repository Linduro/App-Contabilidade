/**
 * Proxy Datajud — contorna CORS no browser (GitHub Pages).
 * Deploy: npx wrangler deploy (conta Cloudflare gratuita).
 */
const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br"
const API_KEY =
  "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=="

const ALLOWED = [
  "https://linduro.github.io",
  "https://contabilidade-ebed6.web.app",
  "https://contabilidade-ebed6.firebaseapp.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || ""
  const allow = ALLOWED.includes(origin) ? origin : ALLOWED[0]
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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
