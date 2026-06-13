/**
 * Prospecção local — sem dados fictícios.
 */
import { isFictitiousCompany } from '../core/purge-fictitious.js';

const ENRICH_KEY = 'afs_prospect_enrichment';
const SEG_KEY = 'afs_prospect_segmentacoes';

const NATUREZAS = [
  '206-2 - Sociedade Empresária Limitada',
  '203-8 - Sociedade Empresária Limitada',
  '204-6 - Sociedade Anônima Aberta',
  '205-4 - Sociedade Anônima Fechada',
  '213-5 - Empresário Individual',
  '230-5 - Cooperativa',
];

const MUNICIPIOS = [
  ['SP', 'São Paulo'], ['SP', 'Campinas'], ['RJ', 'Rio de Janeiro'],
  ['MG', 'Belo Horizonte'], ['PR', 'Curitiba'], ['RS', 'Porto Alegre'],
];

let _cnaeSetores = null;

export function purgeDemoProspectStorage() {
  try {
    localStorage.removeItem(ENRICH_KEY);
    localStorage.removeItem(SEG_KEY);
  } catch (_) {}
}

function loadEnrichment() {
  try {
    return JSON.parse(localStorage.getItem(ENRICH_KEY) || '{}');
  } catch (_) {
    return {};
  }
}

function saveEnrichment(data) {
  try {
    localStorage.setItem(ENRICH_KEY, JSON.stringify(data));
  } catch (_) {}
}

function staticBase() {
  const bp = (window.__AFS_BASE_PATH__ || '').replace(/\/$/, '');
  return bp || '.';
}

export function getCatalog() {
  return [];
}

export function catalogHasDemoData() {
  return false;
}

function applyEnrichment(row) {
  const enr = loadEnrichment()[row.cnpj_basico];
  const emails = enr?.emails || row.email_matriz || '';
  const tel = enr?.telefone || row.telefone_matriz || '';
  const hasContact = Boolean(emails || tel || enr?.contatos?.length);
  const nCont = enr?.contatos?.length || (emails ? emails.split(';').filter(Boolean).length : 0) + (tel ? 1 : 0);
  return {
    ...row,
    cluster: row.cluster || row.cluster_estrategico,
    enriquecida: hasContact,
    emails_encontrados: emails,
    telefone_matriz: tel || row.telefone_matriz,
    contatos_label: hasContact ? nCont + ' contato(s)' : 'Revelar contatos',
    enriquecimento_status: hasContact ? 'ok' : undefined,
    contatos_coletados: nCont,
  };
}

function allRows() {
  return getCatalog().map(applyEnrichment);
}

function porteMatch(rowPorte, filtros) {
  if (!filtros.portes?.length) return true;
  const p = String(rowPorte || '').padStart(2, '0');
  const aliases = { '1': '01', '3': '03', '5': '05', '0': '00' };
  const norm = aliases[p] || p;
  return filtros.portes.some(function (fp) {
    const f = String(fp).padStart(2, '0');
    return f === norm || aliases[f] === norm || fp === rowPorte;
  });
}

function clusterMatch(row, filtros) {
  if (!filtros.clusters?.length) return true;
  return filtros.clusters.includes(row.cluster || row.cluster_estrategico);
}

function cnaeMatch(row, filtros) {
  const cnae = String(row.cnae || '');
  if (filtros.cnaes?.length) {
    return filtros.cnaes.some(function (c) {
      const cc = c.replace(/\D/g, '');
      return cnae.startsWith(cc) || cnae.startsWith(c);
    });
  }
  if (filtros.cnae_divisoes?.length) {
    return filtros.cnae_divisoes.some(function (d) {
      return cnae.startsWith(String(d).padStart(2, '0'));
    });
  }
  return true;
}

function filterRows(filtros, aba) {
  let rows = allRows().filter(function (r) { return !isFictitiousCompany(r); });
  const f = filtros || {};

  if (f.q) {
    const q = f.q.toLowerCase();
    rows = rows.filter(function (r) {
      return (r.razao_social || '').toLowerCase().includes(q)
        || (r.nome_fantasia || '').toLowerCase().includes(q)
        || (r.cnpj_basico || '').includes(q.replace(/\D/g, ''));
    });
  }
  if (f.ufs?.length) rows = rows.filter(function (r) { return f.ufs.includes(r.uf); });
  if (f.municipios?.length) {
    rows = rows.filter(function (r) {
      return f.municipios.some(function (m) { return (r.municipio || '').toLowerCase().includes(m.toLowerCase()); });
    });
  }
  if (f.clusters?.length) rows = rows.filter(function (r) { return clusterMatch(r, f); });
  if (f.portes?.length) rows = rows.filter(function (r) { return porteMatch(r.porte, f); });
  if (f.cnaes?.length || f.cnae_divisoes?.length) rows = rows.filter(function (r) { return cnaeMatch(r, f); });
  if (f.naturezas?.length) {
    rows = rows.filter(function (r) { return f.naturezas.includes(r.natureza_juridica); });
  }
  if (f.capital_min != null) rows = rows.filter(function (r) { return (r.capital_social || 0) >= f.capital_min; });
  if (f.capital_max != null) rows = rows.filter(function (r) { return (r.capital_social || 0) <= f.capital_max; });
  if (f.apenas_email) rows = rows.filter(function (r) { return r.email_matriz || r.emails_encontrados; });
  if (f.apenas_telefone) rows = rows.filter(function (r) { return r.telefone_matriz; });
  if (f.excluir_enriquecidas) rows = rows.filter(function (r) { return !r.enriquecida; });
  if (f.excluir_cnpjs?.length) {
    rows = rows.filter(function (r) { return !f.excluir_cnpjs.includes(r.cnpj_basico); });
  }
  if (f.situacao_cadastral === 'ativa') rows = rows.filter(function (r) { return r.situacao === 'ativa'; });

  if (aba === 'nao_enriquecidas') rows = rows.filter(function (r) { return !r.enriquecida; });
  else if (aba === 'enriquecidas') rows = rows.filter(function (r) { return r.enriquecida; });
  else if (aba === 'novas') {
    rows = rows.filter(function (r) {
      const y = parseInt(String(r.data_abertura || '').slice(0, 4), 10);
      return y >= new Date().getFullYear() - 1;
    });
  }

  rows.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
  return rows;
}

export function localCount(filtros) {
  const base = filterRows(filtros, null);
  return {
    todas: base.length,
    nao_enriquecidas: base.filter(function (r) { return !r.enriquecida; }).length,
    enriquecidas: base.filter(function (r) { return r.enriquecida; }).length,
    novas: filterRows(filtros, 'novas').length,
  };
}

export function localSearch({ filtros, aba, page, page_size }) {
  const all = filterRows(filtros, aba === 'todas' ? null : aba);
  const ps = page_size || 25;
  const pg = Math.max(1, page || 1);
  const start = (pg - 1) * ps;
  return {
    total: all.length,
    page: pg,
    page_size: ps,
    rows: all.slice(start, start + ps),
  };
}

export function localEnrich(cnpjs) {
  return { status: 'ok', enfileirados: 0, processamento: { processados: 0, erros: 0 }, total: 0 };
}

export function localContatos(cnpjBasico) {
  const enr = loadEnrichment()[cnpjBasico];
  if (enr?.contatos) return enr.contatos;
  return [];
}

export async function localExecutar({ filtros, aba, limite, onProgress }) {
  onProgress?.('Nenhuma empresa na base local', 100);
  return {
    status: 'ok',
    message: 'Base vazia — importe empresas reais ou conecte o backend RF.',
    processados: 0,
    enriquecidos_ok: 0,
    contatos_coletados: 0,
    empresas: [],
    counts: localCount(filtros),
  };
}

export async function loadCnaeSetoresLocal(q, secao) {
  if (!_cnaeSetores) {
    const paths = [
      staticBase() + '/data/cnae_setores.json',
      staticBase() + '/static/data/cnae_setores.json',
    ];
    for (const p of paths) {
      try {
        const r = await fetch(p);
        if (r.ok) {
          _cnaeSetores = await r.json();
          break;
        }
      } catch (_) {}
    }
    if (!_cnaeSetores) _cnaeSetores = { secoes: [], divisoes: [] };
  }
  let rows = _cnaeSetores.divisoes || [];
  if (secao) rows = rows.filter(function (d) { return d.secao === secao; });
  if (q) {
    const ql = q.toLowerCase();
    rows = rows.filter(function (d) {
      return d.codigo.includes(ql) || (d.divisao || '').toLowerCase().includes(ql);
    });
  }
  return { meta: _cnaeSetores.meta, secoes: _cnaeSetores.secoes || [], divisoes: rows, total: rows.length };
}

export function localFetchCnaes() {
  return [];
}

export function localFetchMunicipios(q, uf) {
  let list = MUNICIPIOS.map(function (m) { return { nome: m[1], uf: m[0] }; });
  if (uf) list = list.filter(function (m) { return m.uf === uf; });
  if (q) {
    const ql = q.toLowerCase();
    list = list.filter(function (m) { return m.nome.toLowerCase().includes(ql); });
  }
  return list;
}

export function localFetchNaturezas(q) {
  let list = NATUREZAS;
  if (q) {
    const ql = q.toLowerCase();
    list = list.filter(function (n) { return n.toLowerCase().includes(ql); });
  }
  return list;
}

export function localSaveSegmentacao(nome, filtros) {
  let items = [];
  try { items = JSON.parse(localStorage.getItem(SEG_KEY) || '[]'); } catch (_) {}
  const entry = { id: 'local_' + Date.now(), nome, filtros, created_at: new Date().toISOString() };
  items.push(entry);
  localStorage.setItem(SEG_KEY, JSON.stringify(items));
  return entry;
}
