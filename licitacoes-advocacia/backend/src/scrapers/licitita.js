import crypto from "node:crypto";
import * as cheerio from "cheerio";

const BASE_URL = "https://www.licitita.com.br";
const LIST_PATH = "/licitacoes";
const DEFAULT_FILTERS = { tipo: "licitacao", area: "direito" };
const DEFAULT_TIMEOUT_MS = 30_000;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * @typedef {Object} LicititaScrapeOptions
 * @property {{ tipo?: string, area?: string }} [filters]
 * @property {number} [timeoutMs]
 * @property {Record<string, string>} [headers]
 */

/**
 * @typedef {Object} LicititaItem
 * @property {string} titulo
 * @property {string|null} descricao
 * @property {string|null} valor
 * @property {string|null} cidade
 * @property {string|null} deadline
 * @property {string} url
 * @property {string} hash
 * @property {string} tipo
 * @property {string} area
 * @property {string} fonte
 */

export class LicititaScraperError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, status?: number, cause?: unknown }} [meta]
   */
  constructor(message, meta = {}) {
    super(message);
    this.name = "LicititaScraperError";
    this.code = meta.code ?? "SCRAPER_ERROR";
    this.status = meta.status;
    if (meta.cause) {
      this.cause = meta.cause;
    }
  }
}

/**
 * @param {string} url
 * @returns {string}
 */
function hashUrl(url) {
  return crypto.createHash("md5").update(url, "utf8").digest("hex");
}

/**
 * @param {{ tipo?: string, area?: string }} filters
 * @returns {string}
 */
function buildListUrl(filters) {
  const url = new URL(LIST_PATH, BASE_URL);
  if (filters.tipo) url.searchParams.set("tipo", filters.tipo);
  if (filters.area) url.searchParams.set("area", filters.area);
  return url.toString();
}

/**
 * @param {string|null|undefined} text
 * @returns {string|null}
 */
function cleanText(text) {
  if (!text) return null;
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

/**
 * @param {string|null|undefined} href
 * @param {string} baseUrl
 * @returns {string|null}
 */
function resolveUrl(href, baseUrl) {
  if (!href || href.startsWith("#") || href.startsWith("javascript:")) {
    return null;
  }

  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, unknown>} raw
 * @param {{ tipo: string, area: string }} filters
 * @param {string} baseUrl
 * @returns {LicititaItem|null}
 */
function mapRawItem(raw, filters, baseUrl) {
  const tipo = cleanText(
    String(raw.tipo ?? raw.type ?? raw.categoria_tipo ?? filters.tipo),
  )?.toLowerCase();
  const area = cleanText(
    String(raw.area ?? raw.categoria ?? raw.segmento ?? filters.area),
  )?.toLowerCase();

  if (tipo !== filters.tipo || area !== filters.area) {
    return null;
  }

  const url = resolveUrl(
    String(raw.url ?? raw.link ?? raw.href ?? raw.slug ?? ""),
    baseUrl,
  );
  if (!url) return null;

  const titulo = cleanText(
    String(raw.titulo ?? raw.title ?? raw.nome ?? raw.objeto ?? ""),
  );
  if (!titulo) return null;

  return {
    titulo,
    descricao: cleanText(
      String(raw.descricao ?? raw.description ?? raw.resumo ?? raw.objeto ?? ""),
    ),
    valor: cleanText(
      String(raw.valor ?? raw.valor_estimado ?? raw.preco ?? raw.price ?? ""),
    ),
    cidade: cleanText(
      String(raw.cidade ?? raw.municipio ?? raw.localidade ?? raw.uf_cidade ?? ""),
    ),
    deadline: cleanText(
      String(
        raw.deadline ??
          raw.prazo ??
          raw.data_encerramento ??
          raw.encerramento ??
          raw.data_limite ??
          "",
      ),
    ),
    url,
    hash: hashUrl(url),
    tipo: filters.tipo,
    area: filters.area,
    fonte: "licitita",
  };
}

/**
 * @param {unknown} data
 * @param {{ tipo: string, area: string }} filters
 * @param {string} baseUrl
 * @returns {LicititaItem[]}
 */
function extractFromJson(data, filters, baseUrl) {
  /** @type {LicititaItem[]} */
  const items = [];

  /**
   * @param {unknown} node
   */
  function walk(node) {
    if (!node) return;

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    if (typeof node !== "object") return;

    const record = /** @type {Record<string, unknown>} */ (node);

    const looksLikeLicitacao =
      ("titulo" in record || "title" in record || "objeto" in record) &&
      ("url" in record || "link" in record || "href" in record || "slug" in record);

    if (looksLikeLicitacao) {
      const mapped = mapRawItem(record, filters, baseUrl);
      if (mapped) items.push(mapped);
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === "object") {
        walk(value);
      }
    }
  }

  walk(data);
  return items;
}

/**
 * @param {string} html
 * @returns {LicititaItem[]}
 */
function extractFromEmbeddedJson(html) {
  /** @type {LicititaItem[]} */
  const all = [];

  const scriptPatterns = [
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/,
    /window\.__DATA__\s*=\s*(\{[\s\S]*?\});/,
    /"licitacoes"\s*:\s*(\[[\s\S]*?\])/,
  ];

  for (const pattern of scriptPatterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;

    try {
      const parsed = JSON.parse(match[1]);
      all.push(...extractFromJson(parsed, DEFAULT_FILTERS, BASE_URL));
    } catch {
      // ignora JSON inválido em scripts inline
    }
  }

  const nextDataMatch = html.match(
    /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (nextDataMatch?.[1]) {
    try {
      const parsed = JSON.parse(nextDataMatch[1]);
      all.push(...extractFromJson(parsed, DEFAULT_FILTERS, BASE_URL));
    } catch {
      // ignora
    }
  }

  return all;
}

/**
 * @param {import('cheerio').CheerioAPI} $
 * @param {import('cheerio').Element} element
 * @param {{ tipo: string, area: string }} filters
 * @param {string} baseUrl
 * @returns {LicititaItem|null}
 */
function parseCardElement($, element, filters, baseUrl) {
  const $el = $(element);

  const tipo = cleanText(
    $el.attr("data-tipo") ??
      $el.find("[data-tipo]").first().attr("data-tipo") ??
      $el.find(".tipo, .badge-tipo").first().text(),
  )?.toLowerCase();
  const area = cleanText(
    $el.attr("data-area") ??
      $el.find("[data-area]").first().attr("data-area") ??
      $el.find(".area, .badge-area").first().text(),
  )?.toLowerCase();

  const inferredTipo = tipo ?? filters.tipo;
  const inferredArea = area ?? filters.area;

  if (inferredTipo !== filters.tipo || inferredArea !== filters.area) {
    return null;
  }

  const linkEl =
    $el.find('a[href*="/licitac"]').first().length > 0
      ? $el.find('a[href*="/licitac"]').first()
      : $el.find("a[href]").first();

  const url = resolveUrl(linkEl.attr("href"), baseUrl);
  if (!url) return null;

  const titulo = cleanText(
    $el.attr("data-titulo") ??
      $el.find("[data-titulo]").attr("data-titulo") ??
      $el.find("h1, h2, h3, h4, .titulo, .title").first().text() ??
      linkEl.text(),
  );
  if (!titulo) return null;

  const descricao = cleanText(
    $el.attr("data-descricao") ??
      $el.find("[data-descricao]").attr("data-descricao") ??
      $el.find(".descricao, .description, .resumo, p").first().text(),
  );

  const valor = cleanText(
    $el.attr("data-valor") ??
      $el.find("[data-valor]").attr("data-valor") ??
      $el.find(".valor, .price, .valor-estimado").first().text() ??
      $el.text().match(/R\$\s*[\d.,]+/)?.[0],
  );

  const cidade = cleanText(
    $el.attr("data-cidade") ??
      $el.find("[data-cidade]").attr("data-cidade") ??
      $el.find(".cidade, .municipio, .localidade, .local").first().text(),
  );

  const deadline = cleanText(
    $el.attr("data-deadline") ??
      $el.find("[data-deadline]").attr("data-deadline") ??
      $el.find("time[datetime]").first().attr("datetime") ??
      $el.find(".deadline, .prazo, .encerramento, .data-limite").first().text(),
  );

  return {
    titulo,
    descricao,
    valor,
    cidade,
    deadline,
    url,
    hash: hashUrl(url),
    tipo: filters.tipo,
    area: filters.area,
    fonte: "licitita",
  };
}

/**
 * @param {LicititaItem[]} items
 * @returns {LicititaItem[]}
 */
function dedupeByHash(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.hash)) return false;
    seen.add(item.hash);
    return true;
  });
}

/**
 * @param {string} html
 * @param {{ baseUrl?: string, filters?: { tipo?: string, area?: string } }} [options]
 * @returns {LicititaItem[]}
 */
export function parseLicititaHtml(html, options = {}) {
  const filters = {
    tipo: options.filters?.tipo ?? DEFAULT_FILTERS.tipo,
    area: options.filters?.area ?? DEFAULT_FILTERS.area,
  };
  const baseUrl = options.baseUrl ?? BASE_URL;
  const $ = cheerio.load(html);

  /** @type {LicititaItem[]} */
  let items = extractFromEmbeddedJson(html);

  const cardSelectors = [
    '[data-tipo="licitacao"][data-area="direito"]',
    '[data-tipo="licitacao"]',
    ".licitacao-card",
    ".licitacao-item",
    ".card-licitacao",
    "article.licitacao",
    "article[data-tipo]",
    "li.licitacao",
    ".licitacoes-list > li",
    ".licitacoes-list > article",
    "table.licitacoes tbody tr",
  ];

  for (const selector of cardSelectors) {
    $(selector).each((_, element) => {
      const parsed = parseCardElement($, element, filters, baseUrl);
      if (parsed) items.push(parsed);
    });
  }

  // Fallback: links individuais de licitação com metadados no container pai
  if (items.length === 0) {
    $('a[href*="/licitac"]').each((_, anchor) => {
      const $anchor = $(anchor);
      const container =
        $anchor.closest("article, li, tr, .card, [class*='licit']").get(0) ??
        anchor.parent;
      if (!container) return;

      const parsed = parseCardElement($, container, filters, baseUrl);
      if (parsed) items.push(parsed);
    });
  }

  items = dedupeByHash(items);

  return items.filter(
    (item) => item.tipo === filters.tipo && item.area === filters.area,
  );
}

/**
 * @param {string} url
 * @param {number} timeoutMs
 * @param {Record<string, string>} [extraHeaders]
 * @returns {Promise<{ html: string, finalUrl: string, status: number }>}
 */
async function fetchPage(url, timeoutMs, extraHeaders = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        "User-Agent": USER_AGENT,
        ...extraHeaders,
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (response.status === 404) {
      throw new LicititaScraperError(
        `Página não encontrada (404): ${url}`,
        { code: "NOT_FOUND", status: 404 },
      );
    }

    if (!response.ok) {
      throw new LicititaScraperError(
        `Erro HTTP ${response.status} ao acessar ${url}`,
        { code: "HTTP_ERROR", status: response.status },
      );
    }

    const html = await response.text();

    if (!html || html.trim().length === 0) {
      throw new LicititaScraperError("Resposta HTML vazia.", {
        code: "EMPTY_RESPONSE",
        status: response.status,
      });
    }

    return {
      html,
      finalUrl: response.url || url,
      status: response.status,
    };
  } catch (error) {
    if (error instanceof LicititaScraperError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new LicititaScraperError(
        `Timeout após ${timeoutMs}ms ao acessar ${url}`,
        { code: "TIMEOUT", cause: error },
      );
    }

    const message =
      error instanceof Error ? error.message : "Erro desconhecido de rede";

    throw new LicititaScraperError(
      `Falha na requisição GET para ${url}: ${message}`,
      {
        code: "NETWORK_ERROR",
        cause: error,
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Coleta licitações do Licitita.com filtradas por tipo e área.
 *
 * @param {LicititaScrapeOptions} [options]
 * @returns {Promise<LicititaItem[]>}
 */
export async function scrapeLicitita(options = {}) {
  const filters = {
    tipo: options.filters?.tipo ?? DEFAULT_FILTERS.tipo,
    area: options.filters?.area ?? DEFAULT_FILTERS.area,
  };
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = buildListUrl(filters);

  const { html, finalUrl } = await fetchPage(
    url,
    timeoutMs,
    options.headers,
  );

  const results = parseLicititaHtml(html, {
    baseUrl: finalUrl,
    filters,
  });

  console.log(
    `[licitita] Encontradas ${results.length} licitações (tipo=${filters.tipo}, area=${filters.area})`,
  );

  return results;
}

export default scrapeLicitita;
