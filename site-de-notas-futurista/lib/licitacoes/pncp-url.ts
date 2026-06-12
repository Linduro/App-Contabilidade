/** PNCP: item_url da API usa /compras/…; o portal Angular roteia em /editais/:cnpj/:ano/:seq */

const PNCP_APP = "https://pncp.gov.br/app"

function normalizeSeq(seq: string | number) {
  const n = String(seq).replace(/\D/g, "")
  if (!n) return ""
  return String(parseInt(n, 10))
}

export function buildPncpEditalUrl(cnpj: string, ano: string | number, sequencial: string | number) {
  const c = String(cnpj).replace(/\D/g, "")
  const a = String(ano).replace(/\D/g, "")
  const s = normalizeSeq(sequencial)
  if (c.length !== 14 || !a || !s) return null
  return `${PNCP_APP}/editais/${c}/${a}/${s}`
}

export function buildPncpUrlFromControle(numeroControle: string) {
  const m = String(numeroControle).match(/^(\d{14})-1-0*(\d+)\/(\d{4})$/)
  if (!m) return null
  return buildPncpEditalUrl(m[1], m[3], m[2])
}

export function normalizePncpPortalUrl(raw: string) {
  if (!raw) return `${PNCP_APP}/editais`
  let url = raw.trim()
  if (!url.startsWith("http")) {
    url = url.startsWith("/app/")
      ? `https://pncp.gov.br${url}`
      : `${PNCP_APP}${url.startsWith("/") ? url : `/${url}`}`
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

export function buildPncpUrlFromSearchItem(item: {
  item_url: string
  numero_controle_pncp?: string
  orgao_cnpj?: string
  ano?: string
  numero_sequencial?: string
}) {
  if (item.item_url?.startsWith("http")) {
    return normalizePncpPortalUrl(item.item_url)
  }
  if (item.item_url) {
    const path = item.item_url.startsWith("/compras/")
      ? item.item_url.replace(/^\/compras\//, "/editais/")
      : item.item_url.replace(/^\/app\/compras\//, "/editais/")
    return normalizePncpPortalUrl(path)
  }
  const fromCtrl = item.numero_controle_pncp
    ? buildPncpUrlFromControle(item.numero_controle_pncp)
    : null
  if (fromCtrl) return fromCtrl
  if (item.orgao_cnpj && item.ano && item.numero_sequencial) {
    return buildPncpEditalUrl(item.orgao_cnpj, item.ano, item.numero_sequencial)
  }
  return `${PNCP_APP}/editais`
}
