import type { LicititaItem } from "@/lib/licitacoes/scraper-browser"

const PNCP_BASE = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao"

/** Modalidades PNCP (pregão, concorrência, dispensa, inexigibilidade, etc.). */
const MODALIDADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/** Match forte — objeto claramente jurídico. */
const JURIDICO_FORTE =
  /jur[ií]dic|advocac|defensoria|procuradoria|escrit[oó]rio de advocacia|oab\b|contencioso|due diligence|arbitragem|media[cç][aã]o|notifica[cç][aã]o extrajudicial|cobran[cç]a judicial|parecer jur|consultoria jur|assessoria jur|servi[cç]os jur[ií]d/i

/** Match amplo — serviços profissionais / compliance / áreas correlatas. */
const JURIDICO_AMPLo =
  /assessoria|consultoria|parecer|audit|compliance|cont[aá]bil|fiscal|tribut|previd|inss|per[ií]cia|regulat|contrato|licita|preg[aã]o|concorr[eê]ncia|dispensa|administrativ|contencios|legal\b|notarial|registro de im[oó]ve|cart[oó]rio|certid[aã]o|due.dilig|governan[cç]a|lgpd|prote[cç][aã]o de dados|seguro|sinistro|responsabil|indeniz|financeir|banc[aá]ri|cr[eé]dito|hipoteca|execu[cç][aã]o fiscal|d[ií]vida ativa|honor[aá]ri/i

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
  amparoLegal?: { descricao?: string; nome?: string }
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

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function buildSearchText(row: PncpContratacao): string {
  return [
    row.objetoCompra,
    row.informacaoComplementar,
    row.amparoLegal?.descricao,
    row.amparoLegal?.nome,
    row.orgaoEntidade?.razaoSocial,
    row.unidadeOrgao?.nomeUnidade,
    row.modalidadeNome,
  ]
    .filter(Boolean)
    .join(" ")
}

export function isRelevantContratacao(texto: string): boolean {
  const t = normalize(texto)
  return JURIDICO_FORTE.test(t) || JURIDICO_AMPLo.test(t)
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

  const descricao = buildSearchText(item)

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

export interface PncpFetchOptions {
  daysBack?: number
  maxPagesPerModality?: number
}

/** Busca licitações relevantes no PNCP (API gov.br). */
export async function fetchPncpLicitacoesJuridicas(
  daysBackOrOptions: number | PncpFetchOptions = 90,
  maxPagesLegacy = 8,
): Promise<LicititaItem[]> {
  const opts: PncpFetchOptions =
    typeof daysBackOrOptions === "number"
      ? { daysBack: daysBackOrOptions, maxPagesPerModality: maxPagesLegacy }
      : daysBackOrOptions

  const daysBack = opts.daysBack ?? 90
  const maxPagesPerModality = opts.maxPagesPerModality ?? 8

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
      } catch {
        break
      }

      const rows = payload.data ?? []
      if (rows.length === 0) break

      for (const row of rows) {
        const texto = buildSearchText(row)
        if (!isRelevantContratacao(texto)) continue

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
      `Nenhuma licitação relevante no PNCP nos últimos ${daysBack} dias. Tente de novo mais tarde.`,
    )
  }

  return items
}
