/**
 * API de busca reativa — Prospecção em Massa (Leads2b-style).
 */
import { getHttpApiBase, httpMarketGet, httpMarketPost, pingHttpBackend } from './http-market-api.js';

export { pingHttpBackend };

const MOCK_ROWS = [
  {
    cnpj_basico: '00000001', razao_social: 'Agro Exemplo LTDA', nome_fantasia: 'AgroEx',
    capital_social: 5200000, porte: '03', uf: 'SP', municipio: 'Ribeirão Preto',
    cnae: '0111301', cnae_descricao: 'Cultivo de arroz', cluster: 'agro',
    tipo: 'Matriz', enriquecida: false, contatos_label: 'Revelar contatos', score: 8.2,
  },
  {
    cnpj_basico: '00000002', razao_social: 'Indústria Modelo S.A.', nome_fantasia: null,
    capital_social: 18500000, porte: '05', uf: 'MG', municipio: 'Belo Horizonte',
    cnae: '2511000', cnae_descricao: 'Fabricação de estruturas metálicas', cluster: 'industria',
    tipo: 'Matriz + filiais', enriquecida: true, contatos_label: '2 contato(s)', score: 9.1,
  },
];

export async function prospeccaoCount(filtros) {
  if (!getHttpApiBase()) {
    return { todas: 132000, nao_enriquecidas: 98000, enriquecidas: 34000, novas: 1200 };
  }
  return httpMarketPost('/prospeccao/count', { filtros });
}

export async function prospeccaoSearch({ filtros, aba, page, page_size, sort }) {
  if (!getHttpApiBase()) {
    return { total: MOCK_ROWS.length, page: 1, page_size: page_size || 25, rows: MOCK_ROWS };
  }
  return httpMarketPost('/prospeccao/search', { filtros, aba, page, page_size, sort });
}

export async function fetchCnaes(q) {
  if (!getHttpApiBase()) return [];
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  return httpMarketGet('/cnaes?' + params.toString());
}

export async function fetchCnaeSetores(q, secao) {
  if (!getHttpApiBase()) return { secoes: [], divisoes: [], total: 0 };
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (secao) params.set('secao', secao);
  return httpMarketGet('/cnae/setores?' + params.toString());
}

export async function fetchMunicipios(q, uf) {
  if (!getHttpApiBase()) return [];
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (uf) params.set('uf', uf);
  return httpMarketGet('/municipios?' + params.toString());
}

export async function fetchNaturezas(q) {
  if (!getHttpApiBase()) return [];
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  const qs = params.toString();
  return httpMarketGet('/naturezas-juridicas' + (qs ? '?' + qs : ''));
}

/** Enfileira CNPJs e opcionalmente processa cascata de contatos (processar=true). */
export async function enriquecerCnpjs(cnpjs, processar = true) {
  if (!getHttpApiBase()) {
    return { status: 'ok', enfileirados: cnpjs.length, processamento: { processados: cnpjs.length, erros: 0 } };
  }
  return httpMarketPost('/prospeccao/enriquecer', { cnpjs, processar });
}

/** Cascata imediata A→E para um CNPJ. */
export async function enriquecerCnpjUnitario(cnpj) {
  if (!getHttpApiBase()) {
    return { status: 'ok', total: 1, contatos: [{ tipo: 'email', valor: 'contato@exemplo.com.br', fonte: 'mock' }] };
  }
  const cnpj14 = String(cnpj).replace(/\D/g, '').padStart(14, '0');
  return httpMarketPost('/enriquecer/' + cnpj14, {});
}

export async function fetchContatos(cnpjBasico) {
  if (!getHttpApiBase()) return [];
  return httpMarketGet('/contatos/' + encodeURIComponent(cnpjBasico));
}

export async function runScrapingQueue(limite = 10) {
  if (!getHttpApiBase()) return { status: 'ok', processados: 0, erros: 0 };
  return httpMarketPost('/scraping/run', { limite });
}

export async function fetchScrapingQueueStatus() {
  if (!getHttpApiBase()) return { fila: {} };
  return httpMarketGet('/scraping/queue');
}

export async function socialScrape({ linkedin_urls, instagram_users, headless = true }) {
  if (!getHttpApiBase()) return { status: 'queued', job_id: 'mock' };
  return httpMarketPost('/social/scrape', { linkedin_urls, instagram_users, headless });
}

export async function fetchSocialConfig() {
  if (!getHttpApiBase()) return { linkedin_configured: false, linkedin_session_saved: false };
  return httpMarketGet('/social/config');
}

export async function fetchSocialLeads(limit = 50) {
  if (!getHttpApiBase()) return [];
  return httpMarketGet('/social/leads?limit=' + limit);
}

export async function fetchSegmentacoes() {
  if (!getHttpApiBase()) return [];
  return httpMarketGet('/segmentacoes');
}

export async function saveSegmentacao(nome, filtros) {
  if (!getHttpApiBase()) return { id: 'local', nome, filtros };
  return httpMarketPost('/segmentacoes/draft', { nome, filtros });
}

export async function fetchOpsStatus() {
  if (!getHttpApiBase()) {
    return { prospectos: 132000, contatos: 0, social_leads: 0, fila_enriquecimento: {}, jobs_recentes: [] };
  }
  return httpMarketGet('/ops/status');
}

export async function fetchJobs(limite = 20) {
  if (!getHttpApiBase()) return { jobs: [] };
  return httpMarketGet('/jobs?limite=' + limite);
}

export async function startPipeline(opts = {}) {
  if (!getHttpApiBase()) return { status: 'ok', job_id: 'mock' };
  return httpMarketPost('/pipeline/start', opts);
}

export async function enqueueFiltros({ filtros, aba, limite, processar }) {
  if (!getHttpApiBase()) return { status: 'ok', enfileirados: limite || 100 };
  return httpMarketPost('/prospeccao/enqueue-filtros', { filtros, aba, limite, processar });
}

/** Fluxo único: busca empresas pelos filtros + enriquece contatos (job ou sync). */
export async function executarProspeccao({ filtros, aba, limite, sync }) {
  if (!getHttpApiBase()) {
    return {
      status: 'ok',
      processados: 2,
      enriquecidos_ok: 2,
      contatos_coletados: 3,
      empresas: MOCK_ROWS,
    };
  }
  return httpMarketPost('/prospeccao/executar', { filtros, aba, limite, sync });
}

export async function pollJob(jobId, onTick) {
  if (!getHttpApiBase()) return null;
  return new Promise(function (resolve, reject) {
    const iv = setInterval(async function () {
      try {
        const job = await httpMarketGet('/jobs/' + jobId);
        onTick?.(job);
        if (job.status === 'done') { clearInterval(iv); resolve(job); }
        if (job.status === 'error') { clearInterval(iv); reject(new Error(job.error || job.message || 'Job falhou')); }
      } catch (e) {
        clearInterval(iv);
        reject(e);
      }
    }, 3000);
  });
}
