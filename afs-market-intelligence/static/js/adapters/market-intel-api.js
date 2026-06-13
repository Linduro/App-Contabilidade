/**
 * API de inteligência de mercado — mapas, CNAE, auditorias, carência.
 */

function api() {
  return window.AFSMarketAPI || null;
}

export async function fetchMapaProspectos(params = {}) {
  const A = api();
  if (!A) return fallbackMapa();
  const q = new URLSearchParams();
  q.set('limite', String(params.limite ?? 8000));
  if (params.uf) q.set('uf', params.uf);
  try {
    return await A.get('/prospectos/mapa?' + q.toString());
  } catch (_) {
    return fallbackMapa();
  }
}

export async function fetchCnaeSetores(params = {}) {
  const A = api();
  if (A) {
    const q = new URLSearchParams();
    if (params.q) q.set('q', params.q);
    if (params.secao) q.set('secao', params.secao);
    try { return await A.get('/cnae/setores?' + q.toString()); } catch (_) {}
  }
  const r = await fetch('/static/data/cnae_setores.json');
  if (r.ok) return r.json();
  return { divisoes: [], secoes: [], total: 0 };
}

export async function fetchAuditorias(params = {}) {
  const A = api();
  if (!A) return { firmas: [], total: 0 };
  const q = new URLSearchParams();
  if (params.uf) q.set('uf', params.uf);
  if (params.tier) q.set('tier', params.tier);
  return A.get('/intel/auditorias?' + q.toString());
}

export async function fetchPatrimonial(params = {}) {
  const A = api();
  if (!A) return { prestadores: [], pontos_mapa: [], total: 0 };
  const q = new URLSearchParams();
  if (params.uf) q.set('uf', params.uf);
  return A.get('/intel/patrimonial?' + q.toString());
}

export async function fetchCarencia() {
  const A = api();
  if (!A) return { regioes: [], top5_cold_mail: [] };
  try {
    return await A.get('/intel/carencia');
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
