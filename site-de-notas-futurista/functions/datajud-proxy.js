const functions = require("firebase-functions")

const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br"
const DEFAULT_API_KEY =
  "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=="

const ALLOWED_ORIGINS = new Set([
  "https://linduro.github.io",
  "https://contabilidade-ebed6.web.app",
  "https://contabilidade-ebed6.firebaseapp.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
])

function getApiKey() {
  return (
    process.env.DATAJUD_API_KEY ||
    functions.config().datajud?.api_key ||
    DEFAULT_API_KEY
  )
}

function applyCors(req, res) {
  const origin = req.get("Origin") || ""
  if (ALLOWED_ORIGINS.has(origin)) {
    res.set("Access-Control-Allow-Origin", origin)
  } else if (/^https:\/\/linduro\.github\.io$/i.test(origin)) {
    res.set("Access-Control-Allow-Origin", origin)
  } else {
    res.set("Access-Control-Allow-Origin", "https://linduro.github.io")
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS")
  res.set("Access-Control-Allow-Headers", "Content-Type")
  res.set("Access-Control-Max-Age", "3600")
}

function isValidEndpoint(endpoint) {
  return typeof endpoint === "string" && /^api_publica_[a-z0-9]+$/i.test(endpoint)
}

exports.datajudSearch = functions.https.onRequest(async (req, res) => {
  applyCors(req, res)

  if (req.method === "OPTIONS") {
    res.status(204).send("")
    return
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" })
    return
  }

  const endpoint = req.body?.endpoint
  const query = req.body?.query

  if (!isValidEndpoint(endpoint) || !query || typeof query !== "object") {
    res.status(400).json({ error: "Corpo inválido: { endpoint, query }" })
    return
  }

  const url = `${DATAJUD_BASE}/${endpoint}/_search`

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `APIKey ${getApiKey()}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(query),
    })

    const text = await upstream.text()
    res.status(upstream.status)
    res.set("Content-Type", upstream.headers.get("content-type") || "application/json")
    res.send(text)
  } catch (err) {
    console.error("[datajudSearch]", err)
    res.status(502).json({ error: err.message || "Falha ao consultar Datajud" })
  }
})
