import {
  DATAJUD_BASE,
  DATAJUD_PUBLIC_API_KEY,
  DATAJUD_PROXY_URLS,
} from "@/lib/datajud/config"
import {
  buildAjuizamentoRange,
  type DatajudSearchRange,
} from "@/lib/datajud/date-range"

export interface DatajudSearchParams extends DatajudSearchRange {
  size?: number
}

const SOURCE_FIELDS = [
  "numeroProcesso",
  "tribunal",
  "grau",
  "classe",
  "classeProcessual",
  "dataAjuizamento",
  "dataHoraUltimaAtualizacao",
  "valorCausa",
  "valor",
  "orgaoJulgador",
  "assuntos",
  "movimentos",
  "partes",
  "nivelSigilo",
]

async function fetchViaProxy(
  proxyUrl: string,
  endpointPath: string,
  body: unknown,
): Promise<Response> {
  return fetch(proxyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ endpoint: endpointPath, query: body }),
  })
}

async function fetchViaCloudProxies(
  endpointPath: string,
  body: unknown,
): Promise<Response | null> {
  let lastStatus = 0
  for (const proxyUrl of DATAJUD_PROXY_URLS) {
    try {
      const res = await fetchViaProxy(proxyUrl, endpointPath, body)
      if (res.ok) return res
      lastStatus = res.status
      if (res.status === 404 || res.status === 503) continue
    } catch {
      continue
    }
  }
  if (lastStatus) return null
  return null
}

async function datajudFetchDirect(url: string, body: unknown): Promise<Response | null> {
  const headers = {
    Authorization: `APIKey ${DATAJUD_PUBLIC_API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })
    if (res.ok) return res
  } catch {
    /* CORS no browser */
  }
  return null
}

async function datajudFetch(endpointPath: string, body: unknown): Promise<Response> {
  const proxyRes = await fetchViaCloudProxies(endpointPath, body)
  if (proxyRes?.ok) return proxyRes

  const directUrl = `${DATAJUD_BASE}/${endpointPath}/_search`
  const directRes = await datajudFetchDirect(directUrl, body)
  if (directRes?.ok) return directRes

  throw new Error(
    "Não foi possível consultar o Datajud pelo navegador (bloqueio CORS). " +
      "Ative o proxy Cloudflare (secret CLOUDFLARE_API_TOKEN no GitHub) ou upgrade Firebase para Blaze " +
      "e rode: firebase deploy --only functions:datajudSearch. " +
      "A coleta automática via GitHub Actions continua funcionando.",
  )
}

/** Query ampla: últimos 2 meses (compacto) + processos públicos. Triagem no app. */
export function buildSearchBody(params: DatajudSearchParams) {
  return {
    size: params.size ?? 100,
    _source: SOURCE_FIELDS,
    sort: [{ dataAjuizamento: { order: "desc" } }],
    query: {
      bool: {
        must: [buildAjuizamentoRange(params)],
        filter: [{ term: { nivelSigilo: 0 } }],
      },
    },
  }
}

export async function searchDatajudEndpoint(
  endpointPath: string,
  params: DatajudSearchParams,
): Promise<Record<string, unknown>[]> {
  const body = buildSearchBody(params)
  const response = await datajudFetch(endpointPath, body)

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Datajud HTTP ${response.status}: ${text.slice(0, 180)}`)
  }

  const payload = (await response.json()) as {
    hits?: { hits?: Array<{ _source?: Record<string, unknown> }> }
  }
  return (payload.hits?.hits ?? []).map((h) => h._source ?? {})
}
