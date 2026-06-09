import { DATAJUD_PROXY_URL } from "@/lib/datajud/config"
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

async function datajudFetch(endpointPath: string, body: unknown): Promise<Response> {
  let lastError = "sem resposta"

  try {
    const res = await fetch(DATAJUD_PROXY_URL, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ endpoint: endpointPath, query: body }),
    })

    if (res.ok) return res

    const text = await res.text()
    lastError = `Proxy HTTP ${res.status}: ${text.slice(0, 160)}`
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err)
  }

  throw new Error(
    `Falha ao consultar Datajud via proxy (${DATAJUD_PROXY_URL}): ${lastError}. ` +
      "Faça Ctrl+F5 para recarregar o site. Se persistir, a coleta automática (GitHub Actions) continua ativa.",
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

  const payload = (await response.json()) as {
    hits?: { hits?: Array<{ _source?: Record<string, unknown> }> }
  }
  return (payload.hits?.hits ?? []).map((h) => h._source ?? {})
}
