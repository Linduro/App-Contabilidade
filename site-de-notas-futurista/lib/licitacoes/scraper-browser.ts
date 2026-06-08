/** Item coletado do Licitita (browser). */
export interface LicititaItem {
  titulo: string
  descricao: string | null
  valor: string | null
  cidade: string | null
  deadline: string | null
  url: string
  tipo: string
  area: string
  fonte: string
}

const BASE_URL = "https://www.licitita.com.br"
const LIST_URL = `${BASE_URL}/licitacoes?tipo=licitacao&area=direito`
const PROXY_PREFIX = "https://corsproxy.io/?"

function cleanText(text: string | null | undefined): string | null {
  if (!text) return null
  const normalized = text.replace(/\s+/g, " ").trim()
  return normalized.length > 0 ? normalized : null
}

function resolveUrl(href: string | null, baseUrl: string): string | null {
  if (!href || href.startsWith("#") || href.startsWith("javascript:")) return null
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return null
  }
}

function parseCardElement(
  el: Element,
  baseUrl: string,
): LicititaItem | null {
  const tipo =
    cleanText(el.getAttribute("data-tipo")?.toLowerCase()) ?? "licitacao"
  const area = cleanText(el.getAttribute("data-area")?.toLowerCase()) ?? "direito"

  if (tipo !== "licitacao" || area !== "direito") return null

  const link =
    el.querySelector('a[href*="/licitac"]') ?? el.querySelector("a[href]")
  const url = resolveUrl(link?.getAttribute("href") ?? null, baseUrl)
  if (!url) return null

  const titulo = cleanText(
    el.getAttribute("data-titulo") ??
      el.querySelector("[data-titulo]")?.getAttribute("data-titulo") ??
      el.querySelector("h1,h2,h3,h4,.titulo,.title")?.textContent ??
      link?.textContent,
  )
  if (!titulo) return null

  const descricao = cleanText(
    el.getAttribute("data-descricao") ??
      el.querySelector("[data-descricao]")?.getAttribute("data-descricao") ??
      el.querySelector(".descricao,.description,.resumo,p")?.textContent,
  )

  const valor = cleanText(
    el.getAttribute("data-valor") ??
      el.querySelector("[data-valor]")?.getAttribute("data-valor") ??
      el.querySelector(".valor,.price,.valor-estimado")?.textContent ??
      el.textContent?.match(/R\$\s*[\d.,]+/)?.[0],
  )

  const cidade = cleanText(
    el.getAttribute("data-cidade") ??
      el.querySelector("[data-cidade]")?.getAttribute("data-cidade") ??
      el.querySelector(".cidade,.municipio,.localidade,.local")?.textContent,
  )

  const deadline = cleanText(
    el.getAttribute("data-deadline") ??
      el.querySelector("[data-deadline]")?.getAttribute("data-deadline") ??
      el.querySelector("time[datetime]")?.getAttribute("datetime") ??
      el.querySelector(".deadline,.prazo,.encerramento,.data-limite")?.textContent,
  )

  return {
    titulo,
    descricao,
    valor,
    cidade,
    deadline,
    url,
    tipo,
    area,
    fonte: "licitita",
  }
}

export function parseLicititaHtml(html: string, baseUrl = BASE_URL): LicititaItem[] {
  const doc = new DOMParser().parseFromString(html, "text/html")
  const items: LicititaItem[] = []
  const seen = new Set<string>()

  const selectors = [
    '[data-tipo="licitacao"][data-area="direito"]',
    '[data-tipo="licitacao"]',
    ".licitacao-card",
    ".licitacao-item",
    "article.licitacao",
    "article[data-tipo]",
    ".licitacoes-list > li",
    ".licitacoes-list > article",
  ]

  for (const selector of selectors) {
    doc.querySelectorAll(selector).forEach((el) => {
      const parsed = parseCardElement(el, baseUrl)
      if (parsed && !seen.has(parsed.url)) {
        seen.add(parsed.url)
        items.push(parsed)
      }
    })
  }

  if (items.length === 0) {
    doc.querySelectorAll('a[href*="/licitac"]').forEach((anchor) => {
      const container =
        anchor.closest("article, li, tr, .card, [class*='licit']") ??
        anchor.parentElement
      if (!container) return
      const parsed = parseCardElement(container, baseUrl)
      if (parsed && !seen.has(parsed.url)) {
        seen.add(parsed.url)
        items.push(parsed)
      }
    })
  }

  return items
}

async function fetchHtml(url: string): Promise<string> {
  const tryFetch = async (target: string) => {
    const response = await fetch(target, {
      headers: { Accept: "text/html" },
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return response.text()
  }

  try {
    return await tryFetch(url)
  } catch {
    return await tryFetch(`${PROXY_PREFIX}${encodeURIComponent(url)}`)
  }
}

export async function scrapeLicititaBrowser(): Promise<LicititaItem[]> {
  const html = await fetchHtml(LIST_URL)
  const items = parseLicititaHtml(html, BASE_URL)
  if (items.length === 0) {
    throw new Error(
      "Nenhuma licitação encontrada no Licitita. O site pode ter mudado o layout ou estar indisponível.",
    )
  }
  return items
}

export function parseValorEstimado(valorStr: string | null): number | null {
  if (!valorStr) return null
  const digits = valorStr
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
  const parsed = parseFloat(digits)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseCidade(cidadeStr: string | null): {
  municipio: string | null
  uf: string | null
} {
  if (!cidadeStr) return { municipio: null, uf: null }
  const match = cidadeStr.match(/^(.+?)\s*-\s*([A-Z]{2})$/i)
  if (match) {
    return { municipio: match[1].trim(), uf: match[2].toUpperCase() }
  }
  return { municipio: cidadeStr.trim(), uf: null }
}

export function mapScrapedToLicitacao(item: LicititaItem) {
  const { municipio, uf } = parseCidade(item.cidade)
  return {
    orgao: "Não informado",
    titulo: item.titulo,
    descricao: item.descricao,
    objeto: item.descricao,
    valor_estimado: parseValorEstimado(item.valor),
    data_encerramento: item.deadline
      ? new Date(item.deadline).toISOString()
      : null,
    url_fonte: item.url,
    fonte: item.fonte,
    municipio,
    uf,
    status: "aberta",
    hash_conteudo: item.url,
    dados_brutos: item,
  }
}
