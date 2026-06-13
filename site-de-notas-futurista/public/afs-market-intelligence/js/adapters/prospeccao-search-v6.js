/**
 * API Prospecção em Massa v6 — modo local SEMPRE vazio (sem catálogo demo).
 */
import { getHttpApiBase, httpMarketGet, httpMarketPost, pingHttpBackend } from './http-market-api.js';
import { isFictitiousCompany, purgeAllProspectDemoStorage } from '../core/purge-fictitious.js';

export { pingHttpBackend };

const EMPTY_COUNT = { todas: 0, nao_enriquecidas: 0, enriquecidas: 0, novas: 0 };
const EMPTY_SEARCH = { total: 0, page: 1, page_size: 25, rows: [] };

function useBackend() {
  if (window.__AFS_USE_RF_BACKEND__ === false) return false;
  return Boolean(getHttpApiBase());
}

/** Sem backend RF = sem busca (removemos o catálogo demo fictício). */
function localBlocked() {
  return !useBackend();
}

function stripDemo(result) {
  if (!result?.rows) return result;
  const rows = result.rows.filter(function (r) { return !isFictitiousCompany(r); });
  if (rows.length !== result.rows.length) purgeAllProspectDemoStorage();
  return { ...result, rows: rows, total: rows.length };
}

async function auxStore() {
  const v = window.__AFS_BUILD__ || Date.now();
  return import('./prospeccao-browser-store.js?b=' + encodeURIComponent(String(v)) + '&t=' + Date.now());
}

export async function prospeccaoCount(filtros) {
  if (localBlocked() || !useBackend()) return EMPTY_COUNT;
  return httpMarketPost('/prospeccao/count', { filtros });
}

export async function prospeccaoSearch(opts) {
  if (localBlocked() || !useBackend()) {
    purgeAllProspectDemoStorage();
    return { ...EMPTY_SEARCH, page: opts?.page || 1, page_size: opts?.page_size || 25 };
  }
  return stripDemo(await httpMarketPost('/prospeccao/search', opts));
}

export async function fetchCnaes(q) {
  if (!useBackend()) return [];
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  return httpMarketGet('/cnaes?' + params.toString());
}

export async function fetchCnaeSetores(q, secao) {
  if (!useBackend()) return (await auxStore()).loadCnaeSetoresLocal(q, secao);
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (secao) params.set('secao', secao);
  return httpMarketGet('/cnae/setores?' + params.toString());
}

export async function fetchMunicipios(q, uf) {
  if (!useBackend()) return (await auxStore()).localFetchMunicipios(q, uf);
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (uf) params.set('uf', uf);
  return httpMarketGet('/municipios?' + params.toString());
}

export async function fetchNaturezas(q) {
  if (!useBackend()) return (await auxStore()).localFetchNaturezas(q);
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  const qs = params.toString();
  return httpMarketGet('/naturezas-juridicas' + (qs ? '?' + qs : ''));
}

export async function enriquecerCnpjs(cnpjs) {
  if (localBlocked() || !useBackend()) return { status: 'ok', enfileirados: 0, processamento: { processados: 0, erros: 0 }, total: 0 };
  return httpMarketPost('/prospeccao/enriquecer', { cnpjs, processar: true });
}

export async function enriquecerCnpjUnitario(cnpj) {
  if (localBlocked() || !useBackend()) return { status: 'ok', total: 0, contatos: [] };
  const cnpj14 = String(cnpj).replace(/\D/g, '').padStart(14, '0');
  return httpMarketPost('/enriquecer/' + cnpj14, {});
}

export async function fetchContatos(cnpjBasico) {
  if (localBlocked() || !useBackend()) return [];
  return httpMarketGet('/contatos/' + encodeURIComponent(cnpjBasico));
}

export async function runScrapingQueue() {
  if (!useBackend()) return { status: 'ok', processados: 0, erros: 0 };
  return httpMarketPost('/scraping/run', { limite: 10 });
}

export async function fetchScrapingQueueStatus() {
  if (!useBackend()) return { fila: {} };
  return httpMarketGet('/scraping/queue');
}

export async function socialScrape(opts) {
  if (!useBackend()) return { status: 'queued', job_id: 'mock' };
  return httpMarketPost('/social/scrape', opts);
}

export async function fetchSocialConfig() {
  if (!useBackend()) return { linkedin_configured: false, linkedin_session_saved: false };
  return httpMarketGet('/social/config');
}

export async function fetchSocialLeads(limit) {
  if (!useBackend()) return [];
  return httpMarketGet('/social/leads?limit=' + (limit || 50));
}

export async function fetchSegmentacoes() {
  if (!useBackend()) {
    try { return JSON.parse(localStorage.getItem('afs_prospect_segmentacoes') || '[]'); } catch (_) { return []; }
  }
  return httpMarketGet('/segmentacoes');
}

export async function saveSegmentacao(nome, filtros) {
  if (!useBackend()) return (await auxStore()).localSaveSegmentacao(nome, filtros);
  return httpMarketPost('/segmentacoes/draft', { nome, filtros });
}

export async function fetchOpsStatus() {
  if (localBlocked() || !useBackend()) {
    return { prospectos: 0, contatos: 0, social_leads: 0, fila_enriquecimento: {}, jobs_recentes: [], modo: 'local' };
  }
  return httpMarketGet('/ops/status');
}

export async function fetchJobs(limite) {
  if (!useBackend()) return { jobs: [] };
  return httpMarketGet('/jobs?limite=' + (limite || 20));
}

export async function startPipeline(opts) {
  if (!useBackend()) return { status: 'ok', job_id: 'mock' };
  return httpMarketPost('/pipeline/start', opts || {});
}

export async function enqueueFiltros(opts) {
  if (localBlocked() || !useBackend()) return { status: 'ok', enfileirados: 0 };
  return httpMarketPost('/prospeccao/enqueue-filtros', opts);
}

export async function executarProspeccao(opts) {
  if (localBlocked() || !useBackend()) {
    purgeAllProspectDemoStorage();
    return {
      status: 'ok',
      message: 'Backend RF offline. Inicie python app.py e rode a ingestão RF em Base de dados.',
      processados: 0, enriquecidos_ok: 0, contatos_coletados: 0, empresas: [],
      counts: EMPTY_COUNT,
    };
  }
  return httpMarketPost('/prospeccao/executar', opts);
}
