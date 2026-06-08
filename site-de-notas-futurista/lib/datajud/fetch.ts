import { DATAJUD_BASE, DATAJUD_PUBLIC_API_KEY } from "@/lib/datajud/config"
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

const PROXY_PREFIXES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
]

async function datajudFetch(url: string, body: unknown): Promise<Response> {
  const headers = {
    Authorization: `APIKey ${DATAJUD_PUBLIC_API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  }
  const payload = JSON.stringify(body)

  try {
    const res = await fetch(url, { method: "POST", headers, body: payload })
    if (res.ok) return res
    if (res.status !== 0) {
      const text = await res.text()
      throw new Error(`Datajud HTTP ${res.status}: ${text.slice(0, 200)}`)
    }
  } catch (err) {
    const isNetwork =
      err instanceof TypeError ||
      (err instanceof Error && /failed to fetch|cors|network/i.test(err.message))
    if (!isNetwork) throw err
  }

  let lastError = "Falha de rede ao acessar o Datajud."
  for (const toProxy of PROXY_PREFIXES) {
    try {
      const res = await fetch(toProxy(url), { method: "POST", headers, body: payload })
      if (res.ok) return res
      lastError = `Proxy HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`
    } catch (err) {
      lastError = err instanceof Error ? err.message : lastError
    }
  }

  throw new Error(
    `${lastError} Tente novamente ou use a coleta automática (GitHub Actions).`,
  )
}

/** Query ampla: últimos N dias (compacto) + processos públicos. Triagem no app. */
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
  const url = `${DATAJUD_BASE}/${endpointPath}/_search`
  const response = await datajudFetch(url, buildSearchBody(params))

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Datajud HTTP ${response.status}: ${text.slice(0, 180)}`)
  }

  const payload = (await response.json()) as {
    hits?: { hits?: Array<{ _source?: Record<string, unknown> }> }
  }
  return (payload.hits?.hits ?? []).map((h) => h._source ?? {})
}
