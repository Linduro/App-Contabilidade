import scrapeLicitita from "../scrapers/licitita.js";
import { classifyText } from "../lib/classifyText.js";
import {
  hashExists,
  loadEspecialidadesBySlug,
  getAdvogadosByEspecialidade,
  insertLicitacao,
  createMatch,
  getUnnotifiedMatches,
  markMatchesNotified,
  isLicitacoesStoreConfigured,
} from "../lib/licitacoesStore.js";
import { sendMatchNotificationEmail } from "../services/email.js";

/**
 * @typedef {Object} JobStats
 * @property {number} licitacoesColetadas
 * @property {number} licitacoesNovas
 * @property {number} matchesCriados
 * @property {number} emailsEnviados
 * @property {number} erros
 */

/**
 * @param {string|null|undefined} valorStr
 * @returns {number|null}
 */
function parseValorEstimado(valorStr) {
  if (!valorStr) return null;

  const digits = valorStr
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = parseFloat(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * @param {string|null|undefined} cidadeStr
 * @returns {{ municipio: string|null, uf: string|null }}
 */
function parseCidade(cidadeStr) {
  if (!cidadeStr) return { municipio: null, uf: null };

  const match = cidadeStr.match(/^(.+?)\s*-\s*([A-Z]{2})$/i);
  if (match) {
    return { municipio: match[1].trim(), uf: match[2].toUpperCase() };
  }

  return { municipio: cidadeStr.trim(), uf: null };
}

/**
 * @param {import('../scrapers/licitita.js').LicititaItem} item
 * @returns {Record<string, unknown>}
 */
function mapScrapedToLicitacao(item) {
  const { municipio, uf } = parseCidade(item.cidade);

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
    fonte: item.fonte ?? "licitita",
    municipio,
    uf,
    status: "aberta",
    hash_conteudo: item.hash,
    dados_brutos: item,
  };
}

/**
 * @param {Array<Record<string, unknown>>} matches
 * @returns {Map<string, { advogado: Record<string, unknown>, matches: Array<Record<string, unknown>> }>}
 */
function groupMatchesByAdvogado(matches) {
  /** @type {Map<string, { advogado: Record<string, unknown>, matches: Array<Record<string, unknown>> }>} */
  const grouped = new Map();

  for (const match of matches) {
    const advogado = match.advogado;
    if (!advogado?.id || !advogado.ativo) continue;

    if (!grouped.has(advogado.id)) {
      grouped.set(advogado.id, { advogado, matches: [] });
    }

    grouped.get(advogado.id).matches.push(match);
  }

  return grouped;
}

/**
 * @param {Record<string, unknown>} match
 * @returns {Record<string, unknown>}
 */
function mapMatchForEmail(match) {
  const licitacao = match.licitacao ?? {};
  const dadosBrutos = licitacao.dados_brutos ?? {};

  const valor =
    dadosBrutos.valor ??
    (licitacao.valor_estimado != null
      ? `R$ ${Number(licitacao.valor_estimado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
      : null);

  const cidade =
    dadosBrutos.cidade ??
    ([licitacao.municipio, licitacao.uf].filter(Boolean).join(" - ") || null);

  const deadline =
    dadosBrutos.deadline ?? licitacao.data_encerramento ?? null;

  return {
    titulo: licitacao.titulo,
    valor,
    cidade,
    deadline,
    relevancia_score: match.relevancia_score,
    url_fonte: licitacao.url_fonte,
    especialidade_nome: match.especialidade?.nome ?? null,
  };
}

async function classifyAndMatchLicitacao(item, licitacaoId, especialidadesBySlug) {
  const texto = [item.titulo, item.descricao].filter(Boolean).join(" ");

  const classificacoes = await classifyText(texto);
  let created = 0;

  for (const classificacao of classificacoes) {
    const especialidadeId = especialidadesBySlug.get(classificacao.especialidade);
    if (!especialidadeId) {
      console.warn(
        `[job] Especialidade "${classificacao.especialidade}" não mapeada no banco.`,
      );
      continue;
    }

    const advogados = await getAdvogadosByEspecialidade(especialidadeId);

    for (const advogado of advogados) {
      const inserted = await createMatch({
        licitacaoId,
        advogadoId: advogado.id,
        especialidadeId,
        relevanciaScore: classificacao.score,
        motivo: `NLP: ${classificacao.especialidade} (${classificacao.score})`,
      });

      if (inserted) created += 1;
    }
  }

  return created;
}

export async function runNotifications() {
  /** @type {{ emailsEnviados: number, erros: number }} */
  const stats = { emailsEnviados: 0, erros: 0 };

  const pendingMatches = await getUnnotifiedMatches();
  const grouped = groupMatchesByAdvogado(pendingMatches);

  for (const { advogado, matches } of grouped.values()) {
    try {
      const emailPayload = matches.map(mapMatchForEmail);

      await sendMatchNotificationEmail({
        to: advogado.email,
        advogadoNome: advogado.nome,
        matches: emailPayload,
      });

      await markMatchesNotified(matches.map((m) => m.id));
      stats.emailsEnviados += 1;
    } catch (error) {
      stats.erros += 1;
      console.error(
        `[job:collectAndMatch] Erro ao notificar ${advogado.email}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return stats;
}

/**
 * @param {import('../scrapers/licitita.js').LicititaItem} item
 * @param {string} licitacaoId
 * @param {Map<string, string>} especialidadesBySlug
 * @returns {Promise<number>}
 */
export async function runMatchingForLicitacao(
  item,
  licitacaoId,
  especialidadesBySlug,
) {
  return classifyAndMatchLicitacao(item, licitacaoId, especialidadesBySlug);
}

/**
 * Executa o fluxo completo: scrape → classificar → match → e-mail.
 *
 * @returns {Promise<JobStats>}
 */
export async function runCollectAndMatch() {
  /** @type {JobStats} */
  const stats = {
    licitacoesColetadas: 0,
    licitacoesNovas: 0,
    matchesCriados: 0,
    emailsEnviados: 0,
    erros: 0,
  };

  if (!isLicitacoesStoreConfigured()) {
    throw new Error(
      "Firestore Admin não configurado. Defina GOOGLE_APPLICATION_CREDENTIALS ou FIREBASE_SERVICE_ACCOUNT_PATH.",
    );
  }

  console.log("[job:collectAndMatch] Iniciando...");

  const especialidadesBySlug = await loadEspecialidadesBySlug();

  // 1. Scraper Licitita
  let scraped = [];
  try {
    scraped = await scrapeLicitita();
    stats.licitacoesColetadas = scraped.length;
  } catch (error) {
    stats.erros += 1;
    console.error(
      "[job:collectAndMatch] Scraper falhou:",
      error instanceof Error ? error.message : error,
    );
  }

  // 2. Novas licitações → classificar → matches
  for (const item of scraped) {
    try {
      const exists = await hashExists(item.hash);
      if (exists) continue;

      const licitacao = await insertLicitacao(mapScrapedToLicitacao(item));
      stats.licitacoesNovas += 1;

      const matches = await classifyAndMatchLicitacao(
        item,
        licitacao.id,
        especialidadesBySlug,
      );
      stats.matchesCriados += matches;
    } catch (error) {
      stats.erros += 1;
      console.error(
        `[job:collectAndMatch] Erro ao processar "${item.titulo}":`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // 3–5. Notificações por advogado
  try {
    const notificationStats = await runNotifications();
    stats.emailsEnviados += notificationStats.emailsEnviados;
    stats.erros += notificationStats.erros;
  } catch (error) {
    stats.erros += 1;
    console.error(
      "[job:collectAndMatch] Erro na etapa de notificações:",
      error instanceof Error ? error.message : error,
    );
  }

  console.log(
    `[job:collectAndMatch] Concluído — coletadas: ${stats.licitacoesColetadas}, novas: ${stats.licitacoesNovas}, matches: ${stats.matchesCriados}, emails: ${stats.emailsEnviados}, erros: ${stats.erros}`,
  );

  return stats;
}

export default runCollectAndMatch;
