import type { LicititaItem } from "@/lib/licitacoes/scraper-browser"

const PNCP_BASE = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao"

/** Modalidades comuns no PNCP (pregão, concorrência, dispensa…). */
const MODALIDADES = [4, 5, 6, 7, 8, 9]

const JURIDICO_RE =
  /jur[ií]d|advocac|assessoria jur|parecer jur|consultoria jur|contencioso|servi[cç]os jur[ií]d|due diligence|media[cç][aã]o|arbitragem/i

interface PncpContratacao {
  numeroControlePNCP: string
  objetoCompra: string
  informacaoComplementar?: string | null
  valorTotalEstimado?: number | null
  dataEncerramentoProposta?: string | null
  linkProcessoEletronico?: string | null
  linkSistemaOrigem?: string | null
  orgaoEntidade?: { razaoSocial?: string }
  unidadeOrgao?: {
    municipioNome?: string
    ufSigla?: string
    nomeUnidade?: string
  }
  modalidadeNome?: string
}

interface PncpResponse {
  data: PncpContratacao[]
  totalPaginas?: number
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}${m}${day}`
}

function isJuridico(texto: string): boolean {
  return JURIDICO_RE.test(texto.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
}

function buildPncpUrl(item: PncpContratacao): string {
  if (item.linkProcessoEletronico) return item.linkProcessoEletronico
  if (item.linkSistemaOrigem) return item.linkSistemaOrigem
  const id = item.numeroControlePNCP.replace("/", "-")
  return `https://pncp.gov.br/app/editais/${id}`
}

function mapPncpItem(item: PncpContratacao): LicititaItem {
  const municipio = item.unidadeOrgao?.municipioNome
  const uf = item.unidadeOrgao?.ufSigla
  const cidade =
    municipio && uf ? `${municipio} - ${uf}` : municipio ?? uf ?? null

  const valor =
    item.valorTotalEstimado != null
      ? item.valorTotalEstimado.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })
      : null

  const descricao = [
    item.objetoCompra,
    item.informacaoComplementar,
    item.orgaoEntidade?.razaoSocial,
    item.modalidadeNome,
  ]
    .filter(Boolean)
    .join(" — ")

  return {
    titulo: item.objetoCompra.slice(0, 300),
    descricao,
    valor,
    cidade,
    deadline: item.dataEncerramentoProposta?.slice(0, 10) ?? null,
    url: buildPncpUrl(item),
    tipo: "licitacao",
    area: "direito",
    fonte: "pncp",
  }
}

async function fetchPncpPage(
  dataInicial: string,
  dataFinal: string,
  modalidade: number,
  pagina: number,
): Promise<PncpResponse> {
  const params = new URLSearchParams({
    dataInicial,
    dataFinal,
    codigoModalidadeContratacao: String(modalidade),
    pagina: String(pagina),
  })

  const response = await fetch(`${PNCP_BASE}?${params}`, {
    headers: { Accept: "application/json" },
  })

  if (!response.ok) {
    throw new Error(`PNCP HTTP ${response.status}`)
  }

  return response.json() as Promise<PncpResponse>
}

/** Busca licitações jurídicas no PNCP (API gov.br, funciona no browser). */
export async function fetchPncpLicitacoesJuridicas(
  daysBack = 30,
  maxPagesPerModality = 3,
): Promise<LicititaItem[]> {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - daysBack)

  const dataInicial = formatDate(start)
  const dataFinal = formatDate(end)

  const byUrl = new Map<string, LicititaItem>()

  for (const modalidade of MODALIDADES) {
    for (let pagina = 1; pagina <= maxPagesPerModality; pagina += 1) {
      let payload: PncpResponse
      try {
        payload = await fetchPncpPage(dataInicial, dataFinal, modalidade, pagina)
      } catch (error) {
        if (pagina === 1) {
          console.warn(`[pncp] Modalidade ${modalidade} indisponível:`, error)
        }
        break
      }

      const rows = payload.data ?? []
      if (rows.length === 0) break

      for (const row of rows) {
        const texto = [row.objetoCompra, row.informacaoComplementar]
          .filter(Boolean)
          .join(" ")
        if (!isJuridico(texto)) continue

        const mapped = mapPncpItem(row)
        if (!byUrl.has(mapped.url)) {
          byUrl.set(mapped.url, mapped)
        }
      }

      if (payload.totalPaginas != null && pagina >= payload.totalPaginas) break
    }
  }

  const items = [...byUrl.values()]
  if (items.length === 0) {
    throw new Error(
      "Nenhuma licitação jurídica encontrada no PNCP nos últimos 30 dias. Tente de novo mais tarde.",
    )
  }

  return items
}
