import type { LicititaItem } from "@/lib/licitacoes/scraper-browser"
import { isOnOrAfterToday } from "@/lib/licitacoes/date-filter"
import { isLegitimateLegalTender } from "@/lib/licitacoes/legal-relevance"
import { buildPncpUrlFromSearchItem } from "@/lib/licitacoes/pncp-url"

const PNCP_SEARCH = "https://pncp.gov.br/api/search/"

/**
 * Termos usados na API de busca do PNCP (full-text no catálogo nacional).
 * Cobre municípios, estados e federal que publicam no portal.
 */
const SEARCH_TERMS = [
  "advocacia",
  "serviços advocatícios",
  "assessoria jurídica",
  "consultoria jurídica",
  "honorários advocatícios",
  "escritório de advocacia",
  "procuradoria",
  "defensoria pública",
  "contencioso",
  "parecer jurídico",
  "representação judicial",
  "credenciamento advogados",
]

interface PncpSearchItem {
  title: string
  description: string
  item_url: string
  numero_controle_pncp: string
  orgao_cnpj?: string
  ano?: string
  numero_sequencial?: string
  orgao_nome: string
  unidade_nome?: string
  municipio_nome?: string
  uf?: string
  valor_global?: number | null
  data_fim_vigencia?: string | null
  data_publicacao_pncp?: string | null
  cancelado?: boolean
  modalidade_licitacao_nome?: string
}

interface PncpSearchResponse {
  items: PncpSearchItem[]
  total: number
}

function isWithinDateWindow(row: PncpSearchItem): boolean {
  // Prazo de encerramento: só hoje ou futuro (nunca edital já encerrado).
  if (row.data_fim_vigencia && !isOnOrAfterToday(row.data_fim_vigencia)) {
    return false
  }
  // Publicação: só dia atual ou posterior (descarta editais antigos na busca).
  if (row.data_publicacao_pncp && !isOnOrAfterToday(row.data_publicacao_pncp)) {
    return false
  }
  return true
}

function buildSearchText(row: PncpSearchItem): string {
  return [row.title, row.description, row.orgao_nome, row.unidade_nome]
    .filter(Boolean)
    .join(" ")
}

function mapSearchItem(item: PncpSearchItem): LicititaItem {
  const municipio = item.municipio_nome
  const uf = item.uf
  const cidade =
    municipio && uf ? `${municipio} - ${uf}` : municipio ?? uf ?? null

  const valor =
    item.valor_global != null
      ? item.valor_global.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })
      : null

  const descricao = buildSearchText(item)

  return {
    titulo: item.title.slice(0, 300),
    descricao,
    valor,
    cidade,
    deadline: item.data_fim_vigencia?.slice(0, 10) ?? null,
    publicadoEm: item.data_publicacao_pncp?.slice(0, 10) ?? null,
    url: buildPncpUrlFromSearchItem(item),
    tipo: "licitacao",
    area: "direito",
    fonte: "pncp-search",
    pncp: {
      numero_controle_pncp: item.numero_controle_pncp,
      orgao_cnpj: item.orgao_cnpj,
      ano: item.ano,
      numero_sequencial: item.numero_sequencial,
      item_url: item.item_url,
    },
  }
}

async function fetchSearchPage(
  termo: string,
  pagina: number,
  tamPagina: number,
): Promise<PncpSearchResponse> {
  const params = new URLSearchParams({
    q: termo,
    tipos_documento: "edital",
    ordenacao: "-data",
    pagina: String(pagina),
    tam_pagina: String(tamPagina),
  })

  const response = await fetch(`${PNCP_SEARCH}?${params}`, {
    headers: { Accept: "application/json" },
  })

  if (!response.ok) {
    throw new Error(`PNCP busca HTTP ${response.status} (${termo})`)
  }

  return response.json() as Promise<PncpSearchResponse>
}

export interface PncpFetchOptions {
  /** Páginas por termo de busca (padrão 2). */
  maxPagesPerTerm?: number
  /** Itens por página (padrão 30). */
  pageSize?: number
}

/** Busca licitações jurídicas via API de busca full-text do PNCP. */
export async function fetchPncpLicitacoesJuridicas(
  options: PncpFetchOptions = {},
): Promise<LicititaItem[]> {
  const maxPagesPerTerm = options.maxPagesPerTerm ?? 2
  const pageSize = options.pageSize ?? 30

  const byUrl = new Map<string, LicititaItem>()

  for (const termo of SEARCH_TERMS) {
    for (let pagina = 1; pagina <= maxPagesPerTerm; pagina += 1) {
      let payload: PncpSearchResponse
      try {
        payload = await fetchSearchPage(termo, pagina, pageSize)
      } catch {
        break
      }

      const rows = payload.items ?? []
      if (rows.length === 0) break

      for (const row of rows) {
        if (row.cancelado) continue
        if (!isWithinDateWindow(row)) continue

        const texto = buildSearchText(row)
        if (!isLegitimateLegalTender(texto)) continue

        const mapped = mapSearchItem(row)
        if (!byUrl.has(mapped.url)) {
          byUrl.set(mapped.url, mapped)
        }
      }

      if (rows.length < pageSize) break
      if (payload.total != null && pagina * pageSize >= payload.total) break
    }
  }

  const items = [...byUrl.values()]
  if (items.length === 0) {
    throw new Error(
      "Nenhuma licitação jurídica encontrada no PNCP. Tente novamente mais tarde.",
    )
  }

  return items
}

/** @deprecated Use isLegitimateLegalTender de legal-relevance.ts */
export function isRelevantContratacao(texto: string): boolean {
  return isLegitimateLegalTender(texto)
}
