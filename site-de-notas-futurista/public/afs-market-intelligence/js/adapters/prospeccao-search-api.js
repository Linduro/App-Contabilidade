/**
 * API de busca reativa — Prospecção em Massa.
 * Modo padrão: 100% no navegador (sem backend nem ingestão RF).
 */
import { getHttpApiBase, httpMarketGet, httpMarketPost, pingHttpBackend } from './http-market-api.js';

export { pingHttpBackend };

let _localMod = null;

async function local() {
  if (!_localMod) {
    const v = window.__AFS_BUILD__ || Date.now();
    _localMod = await import('./prospeccao-local.js?b=' + encodeURIComponent(v));
  }
  return _localMod;
}

function useBackend() {
  return window.__AFS_USE_RF_BACKEND__ === true && Boolean(getHttpApiBase());
}

export async function prospeccaoCount(filtros) {
  if (!useBackend()) return (await local()).localCount(filtros);
  return httpMarketPost('/prospeccao/count', { filtros });
}

export async function prospeccaoSearch({ filtros, aba, page, page_size, sort }) {
  if (!useBackend()) return (await local()).localSearch({ filtros, aba, page, page_size, sort });
  return httpMarketPost('/prospeccao/search', { filtros, aba, page, page_size, sort });
}

export async function fetchCnaes(q) {
  if (!useBackend()) return (await local()).localFetchCnaes(q);
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  return httpMarketGet('/cnaes?' + params.toString());
}

export async function fetchCnaeSetores(q, secao) {
  if (!useBackend()) return (await local()).loadCnaeSetoresLocal(q, secao);
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (secao) params.set('secao', secao);
  return httpMarketGet('/cnae/setores?' + params.toString());
}

export async function fetchMunicipios(q, uf) {
  if (!useBackend()) return (await local()).localFetchMunicipios(q, uf);
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (uf) params.set('uf', uf);
  return httpMarketGet('/municipios?' + params.toString());
}

export async function fetchNaturezas(q) {
  if (!useBackend()) return (await local()).localFetchNaturezas(q);
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  const qs = params.toString();
  return httpMarketGet('/naturezas-juridicas' + (qs ? '?' + qs : ''));
}

export async function enriquecerCnpjs(cnpjs, processar = true) {
  if (!useBackend()) {
    const r = (await local()).localEnrich(cnpjs);
    return {
      status: 'ok',
      enfileirados: cnpjs.length,
      processamento: { processados: cnpjs.length, erros: 0 },
      total: r.total,
    };
  }
  return httpMarketPost('/prospeccao/enriquecer', { cnpjs, processar });
}

export async function enriquecerCnpjUnitario(cnpj) {
  const cnpjBasico = String(cnpj).replace(/\D/g, '').slice(0, 8);
  if (!useBackend()) {
    const L = await local();
    L.localEnrich([cnpjBasico]);
    const contatos = L.localContatos(cnpjBasico);
    return { status: 'ok', total: contatos.length, contatos };
  }
  const cnpj14 = String(cnpj).replace(/\D/g, '').padStart(14, '0');
  return httpMarketPost('/enriquecer/' + cnpj14, {});
}

export async function fetchContatos(cnpjBasico) {
  if (!useBackend()) return (await local()).localContatos(cnpjBasico);
  return httpMarketGet('/contatos/' + encodeURIComponent(cnpjBasico));
}

export async function runScrapingQueue(limite = 10) {
  if (!useBackend()) return { status: 'ok', processados: 0, erros: 0 };
  return httpMarketPost('/scraping/run', { limite });
}

export async function fetchScrapingQueueStatus() {
  if (!useBackend()) return { fila: {} };
  return httpMarketGet('/scraping/queue');
}

export async function socialScrape({ linkedin_urls, instagram_users, headless = true }) {
  if (!useBackend()) return { status: 'queued', job_id: 'mock' };
  return httpMarketPost('/social/scrape', { linkedin_urls, instagram_users, headless });
}

export async function fetchSocialConfig() {
  if (!useBackend()) return { linkedin_configured: false, linkedin_session_saved: false };
  return httpMarketGet('/social/config');
}

export async function fetchSocialLeads(limit = 50) {
  if (!useBackend()) return [];
  return httpMarketGet('/social/leads?limit=' + limit);
}

export async function fetchSegmentacoes() {
  if (!useBackend()) {
    try { return JSON.parse(localStorage.getItem('afs_prospect_segmentacoes') || '[]'); } catch (_) { return []; }
  }
  return httpMarketGet('/segmentacoes');
}

export async function saveSegmentacao(nome, filtros) {
  if (!useBackend()) return (await local()).localSaveSegmentacao(nome, filtros);
  return httpMarketPost('/segmentacoes/draft', { nome, filtros });
}

export async function fetchOpsStatus() {
  if (!useBackend()) {
    const c = (await local()).localCount({});
    return {
      prospectos: c.todas,
      contatos: Object.keys(JSON.parse(localStorage.getItem('afs_prospect_enrichment') || '{}')).length,
      social_leads: 0,
      fila_enriquecimento: {},
      jobs_recentes: [],
      modo: 'local',
    };
  }
  return httpMarketGet('/ops/status');
}

export async function fetchJobs(limite = 20) {
  if (!useBackend()) return { jobs: [] };
  return httpMarketGet('/jobs?limite=' + limite);
}

export async function startPipeline(opts = {}) {
  if (!useBackend()) return { status: 'ok', job_id: 'mock' };
  return httpMarketPost('/pipeline/start', opts);
}

export async function enqueueFiltros({ filtros, aba, limite, processar }) {
  if (!useBackend()) return { status: 'ok', enfileirados: limite || 100 };
  return httpMarketPost('/prospeccao/enqueue-filtros', { filtros, aba, limite, processar });
}

export async function executarProspeccao({ filtros, aba, limite, sync, onProgress }) {
  if (!useBackend()) {
    return (await local()).localExecutar({ filtros, aba, limite, onProgress });
  }
  return httpMarketPost('/prospeccao/executar', { filtros, aba, limite, sync });
}
