/**
 * Prospecção 100% no navegador — sem backend nem ingestão RF.
 * Base demo + enriquecimento simulado persistido em localStorage.
 */

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
  ['SP', 'São Paulo'], ['SP', 'Campinas'], ['SP', 'Ribeirão Preto'], ['RJ', 'Rio de Janeiro'],
  ['MG', 'Belo Horizonte'], ['MG', 'Uberlândia'], ['PR', 'Curitiba'], ['RS', 'Porto Alegre'],
  ['SC', 'Florianópolis'], ['BA', 'Salvador'], ['PE', 'Recife'], ['GO', 'Goiânia'],
  ['DF', 'Brasília'], ['CE', 'Fortaleza'], ['PA', 'Belém'], ['AM', 'Manaus'],
];

const SEEDS = [
  { n: 'Agro Norte', c: 'agro', cnae: '0111301', d: 'Cultivo de arroz', cap: 5200000, p: '03' },
  { n: 'Indústria Modelo', c: 'industria', cnae: '2511000', d: 'Estruturas metálicas', cap: 18500000, p: '05' },
  { n: 'Supermercados Central', c: 'varejo', cnae: '4711302', d: 'Comércio varejista', cap: 8900000, p: '05' },
  { n: 'TechFlow Software', c: 'tecnologia', cnae: '6201501', d: 'Desenv. de software', cap: 3200000, p: '03' },
  { n: 'Construtora Horizonte', c: 'construcao', cnae: '4120400', d: 'Construção de edifícios', cap: 12000000, p: '05' },
  { n: 'LogTrans Cargas', c: 'transporte', cnae: '4930202', d: 'Transporte rodoviário', cap: 4500000, p: '03' },
  { n: 'Hospital Vida', c: 'saude', cnae: '8610101', d: 'Atividades hospitalares', cap: 22000000, p: '05' },
  { n: 'Banco Regional', c: 'financeiro', cnae: '6422100', d: 'Bancos múltiplos', cap: 50000000, p: '05' },
  { n: 'Hotel Praia', c: 'alimentacao', cnae: '5510801', d: 'Hotéis', cap: 2800000, p: '03' },
  { n: 'Energia Sul', c: 'energia', cnae: '3511501', d: 'Geração de energia', cap: 35000000, p: '05' },
  { n: 'Mineração Vale Verde', c: 'extrativas', cnae: '0710301', d: 'Extração de minério', cap: 80000000, p: '05' },
  { n: 'Consultoria Alpha', c: 'servicos', cnae: '7020400', d: 'Consultoria empresarial', cap: 2100000, p: '03' },
  { n: 'Metalúrgica Forte', c: 'industria', cnae: '2411300', d: 'Produção de ferro gusa', cap: 15000000, p: '05' },
  { n: 'Distribuidora ABC', c: 'varejo', cnae: '4639701', d: 'Comércio atacadista', cap: 6700000, p: '03' },
  { n: 'Farmácia Popular', c: 'varejo', cnae: '4771701', d: 'Comércio varejista farmácia', cap: 1900000, p: '03' },
  { n: 'Clínica Saúde+', c: 'saude', cnae: '8630503', d: 'Atividade médica', cap: 3400000, p: '03' },
  { n: 'Usina Agroíndustrial', c: 'agro', cnae: '0161001', d: 'Atividades de apoio à agropecuária', cap: 9800000, p: '05' },
  { n: 'Autopeças BR', c: 'industria', cnae: '2941700', d: 'Peças para veículos', cap: 11000000, p: '05' },
  { n: 'Seguros Protege', c: 'financeiro', cnae: '6511101', d: 'Seguros de vida', cap: 42000000, p: '05' },
  { n: 'Restaurante Sabor', c: 'alimentacao', cnae: '5611201', d: 'Restaurantes', cap: 850000, p: '01' },
];

let _catalog = null;
let _cnaeSetores = null;

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
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
  if (_catalog) return _catalog;
  const rows = [];
  let idx = 1;
  for (let r = 0; r < 6; r++) {
    SEEDS.forEach(function (s, si) {
      const m = MUNICIPIOS[(r + si) % MUNICIPIOS.length];
      const cnpj = String(10000000 + idx).padStart(8, '0');
      idx++;
      rows.push({
        cnpj_basico: cnpj,
        cnpj_matriz: cnpj + '0001' + String((idx % 90) + 10),
        razao_social: s.n + (r > 0 ? ' ' + (r + 1) : '') + ' LTDA',
        nome_fantasia: s.n.split(' ')[0] + (r > 0 ? r : ''),
        capital_social: Math.round(s.cap * (0.85 + (si % 5) * 0.05)),
        porte: s.p,
        uf: m[0],
        municipio: m[1],
        cnae: s.cnae,
        cnae_descricao: s.d,
        cluster: s.c,
        cluster_estrategico: s.c,
        natureza_juridica: NATUREZAS[si % NATUREZAS.length],
        tipo: si % 4 === 0 ? 'Matriz + filiais' : 'Matriz',
        qtd_filiais: si % 4 === 0 ? 2 + (si % 5) : 0,
        score: 6 + (si % 40) / 10,
        situacao: 'ativa',
        email_matriz: si % 3 === 0 ? 'contato@' + slug(s.n) + '.com.br' : null,
        telefone_matriz: si % 2 === 0 ? '(11) 3' + String(100 + si).slice(-3) + '-0000' : null,
        data_abertura: '202' + (2 + (si % 3)) + '-0' + (1 + (si % 8)) + '-15',
      });
    });
  }
  _catalog = rows;
  return rows;
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
  let rows = allRows();
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
  if (f.apenas_email) {
    rows = rows.filter(function (r) {
      return r.email_matriz || r.emails_encontrados;
    });
  }
  if (f.apenas_telefone) {
    rows = rows.filter(function (r) { return r.telefone_matriz; });
  }
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

function mockContacts(row) {
  const base = slug(row.nome_fantasia || row.razao_social);
  return [
    { tipo: 'email', valor: 'comercial@' + base + '.com.br', fonte: 'site', confianca: 'media' },
    { tipo: 'email', valor: 'contato@' + base + '.com.br', fonte: 'rf', confianca: 'alta' },
    { tipo: 'telefone', valor: '(11) 9' + String(1000 + parseInt(row.cnpj_basico.slice(-4), 10) % 9000).slice(-4) + '-0000', fonte: 'api', confianca: 'media' },
  ];
}

export function localEnrich(cnpjs) {
  const enr = loadEnrichment();
  let total = 0;
  cnpjs.forEach(function (cnpj) {
    const row = getCatalog().find(function (r) { return r.cnpj_basico === cnpj; });
    if (!row) return;
    const contatos = mockContacts(row);
    enr[cnpj] = {
      emails: contatos.filter(function (c) { return c.tipo === 'email'; }).map(function (c) { return c.valor; }).join(';'),
      telefone: contatos.find(function (c) { return c.tipo === 'telefone'; })?.valor,
      contatos: contatos,
      at: new Date().toISOString(),
    };
    total += contatos.length;
  });
  saveEnrichment(enr);
  return { status: 'ok', enfileirados: cnpjs.length, processamento: { processados: cnpjs.length, erros: 0 }, total };
}

export function localContatos(cnpjBasico) {
  const enr = loadEnrichment()[cnpjBasico];
  if (enr?.contatos) return enr.contatos;
  const row = getCatalog().find(function (r) { return r.cnpj_basico === cnpjBasico; });
  if (!row) return [];
  const out = [];
  if (row.email_matriz) out.push({ tipo: 'email', valor: row.email_matriz, fonte: 'rf', confianca: 'alta' });
  if (row.telefone_matriz) out.push({ tipo: 'telefone', valor: row.telefone_matriz, fonte: 'rf', confianca: 'media' });
  return out;
}

export async function localExecutar({ filtros, aba, limite, onProgress }) {
  onProgress?.('Buscando empresas…', 10);
  const abaUse = aba === 'nao_enriquecidas' ? 'nao_enriquecidas' : aba;
  let rows = filterRows(filtros, abaUse);
  if (!rows.length && abaUse === 'nao_enriquecidas') rows = filterRows(filtros, null);
  const slice = rows.slice(0, Math.min(limite || 100, 100));
  if (!slice.length) {
    return { status: 'ok', processados: 0, enriquecidos_ok: 0, contatos_coletados: 0, empresas: [], counts: localCount(filtros) };
  }

  const cnpjs = slice.map(function (r) { return r.cnpj_basico; });
  onProgress?.('Enriquecendo ' + cnpjs.length + ' empresa(s)…', 30);

  for (let i = 0; i < cnpjs.length; i++) {
    localEnrich([cnpjs[i]]);
    onProgress?.('Enriquecendo ' + (i + 1) + '/' + cnpjs.length + '…', 30 + Math.round((i / cnpjs.length) * 60));
    await new Promise(function (r) { setTimeout(r, 80); });
  }

  const empresas = slice.map(function (r) { return applyEnrichment(r); });
  const contatos = empresas.reduce(function (s, e) { return s + (e.contatos_coletados || 0); }, 0);
  onProgress?.('Concluído', 100);

  return {
    status: 'ok',
    processados: empresas.length,
    enriquecidos_ok: empresas.length,
    contatos_coletados: contatos,
    empresas: empresas,
    counts: localCount(filtros),
  };
}

export async function loadCnaeSetoresLocal(q, secao) {
  if (!_cnaeSetores) {
    const paths = [
      staticBase() + '/static/data/cnae_setores.json',
      staticBase() + '/data/cnae_setores.json',
      '/static/data/cnae_setores.json',
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

export function localFetchCnaes(q) {
  const ql = (q || '').toLowerCase();
  const seen = new Set();
  const out = [];
  getCatalog().forEach(function (r) {
    if (!r.cnae || seen.has(r.cnae)) return;
    if (ql && !r.cnae.includes(ql) && !(r.cnae_descricao || '').toLowerCase().includes(ql)) return;
    seen.add(r.cnae);
    out.push({ codigo: r.cnae, descricao: r.cnae_descricao });
  });
  SEEDS.forEach(function (s) {
    if (seen.has(s.cnae)) return;
    if (ql && !s.cnae.includes(ql) && !s.d.toLowerCase().includes(ql)) return;
    out.push({ codigo: s.cnae, descricao: s.d });
  });
  return out.slice(0, 20);
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

export function isLocalMode() {
  return true;
}
