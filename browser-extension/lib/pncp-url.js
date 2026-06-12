/** PNCP: API devolve item_url /compras/... mas a rota Angular é /editais/:cnpj/:ano/:seq */
const PNCP_APP = "https://pncp.gov.br/app"

function normalizeSeq(seq) {
  const n = String(seq || "").replace(/\D/g, "")
  if (!n) return ""
  return String(parseInt(n, 10))
}

function buildFromControle(numeroControle) {
  const m = String(numeroControle || "").match(/^(\d{14})-1-0*(\d+)\/(\d{4})$/)
  if (!m) return null
  return `${PNCP_APP}/editais/${m[1]}/${m[3]}/${normalizeSeq(m[2])}`
}

function buildFromParts(cnpj, ano, sequencial) {
  const c = String(cnpj || "").replace(/\D/g, "")
  const a = String(ano || "").replace(/\D/g, "")
  const s = normalizeSeq(sequencial)
  if (c.length !== 14 || !a || !s) return null
  return `${PNCP_APP}/editais/${c}/${a}/${s}`
}

function normalizePncpPortalUrl(raw) {
  if (!raw) return PNCP_APP + "/editais"
  let url = String(raw).trim()
  if (!url.startsWith("http")) {
    url = url.startsWith("/app/") ? `https://pncp.gov.br${url}` : `${PNCP_APP}${url.startsWith("/") ? url : `/${url}`}`
  }
  try {
    const u = new URL(url)
    u.pathname = u.pathname
      .replace(/^\/app\/app\//, "/app/")
      .replace(/^\/app\/compras\//, "/app/editais/")
      .replace(/^\/compras\//, "/editais/")
    return u.toString()
  } catch {
    return url.replace("/app/compras/", "/app/editais/").replace("/compras/", "/editais/")
  }
}

function itemUrlFromSearchApi(itemUrl) {
  if (!itemUrl) return null
  if (itemUrl.startsWith("http")) return normalizePncpPortalUrl(itemUrl)
  const path = itemUrl.startsWith("/compras/")
    ? itemUrl.replace(/^\/compras\//, "/editais/")
    : itemUrl.replace(/^\/app\/compras\//, "/editais/")
  return normalizePncpPortalUrl(path)
}

if (typeof globalThis !== "undefined") {
  globalThis.PncpUrl = {
    normalizePncpPortalUrl,
    itemUrlFromSearchApi,
    buildFromControle,
    buildFromParts,
    PNCP_APP,
  }
}
