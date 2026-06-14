/**
 * API de inteligência de mercado — mapas, CNAE, auditorias, carência.
 */
import { httpMarketGet, getHttpApiBase } from './http-market-api.js';

export async function fetchMapaProspectos(params = {}) {
  if (getHttpApiBase()) {
    const q = new URLSearchParams();
    q.set('limite', String(params.limite ?? 8000));
    if (params.uf) q.set('uf', params.uf);
    if (params.cluster) q.set('cluster', params.cluster);
    if (params.cnae) q.set('cnae', params.cnae);
    if (params.porte) q.set('porte', params.porte);
    if (params.municipio) q.set('municipio', params.municipio);
    if (params.capitalMin != null && params.capitalMin !== '') q.set('capital_min', String(params.capitalMin));
    if (params.capitalMax != null && params.capitalMax !== '') q.set('capital_max', String(params.capitalMax));
    if (params.excluirFrios) q.set('excluir_frios', 'true');
    if (params.apenasQuentes) q.set('apenas_quentes', 'true');
    if (params.cnaeStatus) q.set('cnae_status', params.cnaeStatus);
    try {
      return await httpMarketGet('/prospectos/mapa?' + q.toString());
    } catch (_) {}
  }
  return fallbackMapa();
}

export async function fetchCnaeSetores(params = {}) {
  if (getHttpApiBase()) {
    const q = new URLSearchParams();
    if (params.q) q.set('q', params.q);
    if (params.secao) q.set('secao', params.secao);
    if (params.classificacao) q.set('classificacao', params.classificacao);
    q.set('limite', String(params.limite ?? 100));
    q.set('offset', String(params.offset ?? 0));
    try { return await httpMarketGet('/cnae/setores?' + q.toString()); } catch (_) {}
  }
  const r = await fetch('./data/cnae_setores.json');
  const cls = await fetch('./data/cnae_classificacao.json').then(function (x) { return x.ok ? x.json() : {}; }).catch(function () { return {}; });
  if (r.ok) {
    const data = await r.json();
    let rows = data.divisoes || [];
    if (params.secao) rows = rows.filter(function (d) { return d.secao === params.secao; });
    if (params.q) {
      const ql = params.q.toLowerCase();
      rows = rows.filter(function (d) {
        return ql in d.codigo || d.divisao.toLowerCase().includes(ql);
      });
    }
    return { ...data, divisoes: rows, total: rows.length, classificacao: cls };
  }
  return { divisoes: [], secoes: [], total: 0 };
}

export async function fetchAuditorias(params = {}) {
  if (!getHttpApiBase()) return { firmas: [], total: 0 };
  const q = new URLSearchParams();
  if (params.uf) q.set('uf', params.uf);
  if (params.tier) q.set('tier', params.tier);
  return httpMarketGet('/intel/auditorias?' + q.toString());
}

export async function fetchPatrimonial(params = {}) {
  if (!getHttpApiBase()) return { prestadores: [], pontos_mapa: [], total: 0 };
  const q = new URLSearchParams();
  if (params.uf) q.set('uf', params.uf);
  return httpMarketGet('/intel/patrimonial?' + q.toString());
}

export async function fetchCarencia() {
  if (!getHttpApiBase()) return { regioes: [], top5_cold_mail: [] };
  try {
    return await httpMarketGet('/intel/carencia');
  } catch (_) {
    return { regioes: [], top5_cold_mail: [] };
  }
}

function fallbackMapa() {
  return {
    total_empresas: 230000,
    fonte: 'estimativa_lr',
    aggregado_uf: [
      { uf: 'SP', total: 92000, pct: 40 },
      { uf: 'RJ', total: 28000, pct: 12.2 },
      { uf: 'MG', total: 24000, pct: 10.4 },
    ],
    pontos: [],
  };
}
