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

export async function fetchMunicipios(q, uf) {
  if (!getHttpApiBase()) return [];
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (uf) params.set('uf', uf);
  return httpMarketGet('/municipios?' + params.toString());
}

export async function fetchNaturezas() {
  if (!getHttpApiBase()) return [];
  return httpMarketGet('/naturezas-juridicas');
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
