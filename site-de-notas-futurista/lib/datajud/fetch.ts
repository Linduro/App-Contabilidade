import { DATAJUD_BASE, DATAJUD_PUBLIC_API_KEY } from "@/lib/datajud/config"
import { buildAjuizamentoRange, type DatajudSearchRange } from "@/lib/datajud/date-range"

export interface DatajudSearchParams extends DatajudSearchRange {
  size?: number
  classCodes?: number[]
  minValorCausa?: number
}

async function datajudFetch(url: string, body: unknown): Promise<Response> {
  const headers = {
    Authorization: `APIKey ${DATAJUD_PUBLIC_API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  }

  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) })
    if (res.ok) return res
  } catch {
    // CORS — tenta proxy público
  }

  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`
  return fetch(proxyUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

export function buildSearchBody(params: DatajudSearchParams) {
  const must: object[] = [buildAjuizamentoRange(params)]

  if (params.classCodes?.length) {
    must.push({
      bool: {
        should: [
          { terms: { "classe.codigo": params.classCodes } },
          { terms: { "classeProcessual.codigo": params.classCodes } },
        ],
        minimum_should_match: 1,
      },
    })
  }

  if (params.minValorCausa != null && params.minValorCausa > 0) {
    must.push({ range: { valorCausa: { gte: params.minValorCausa } } })
  }

  return {
    size: params.size ?? 50,
    sort: [{ dataAjuizamento: { order: "desc" } }],
    query: { bool: { must } },
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
