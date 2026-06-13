/**
 * Prospecção em Massa — busca reativa estilo Leads2b.
 * Administração RF (ingestão/export) fica no drawer "Base de dados".
 */
import * as store from '../core/store.js';
import { openDrawer } from '../components/drawer.js';
import { formatCapital } from '../components/prospect-filters.js';
import {
  prospeccaoCount, prospeccaoSearch, fetchCnaes, fetchMunicipios,
  fetchNaturezas, enriquecerCnpjs, enriquecerCnpjUnitario, fetchContatos,
  runScrapingQueue, fetchScrapingQueueStatus, socialScrape, fetchSocialLeads,
  saveSegmentacao, fetchSegmentacoes, pingHttpBackend,
} from '../adapters/prospeccao-search-api.js';
import {
  fetchRfStatus, startRfIngest, pollJob, exportProspectosExcel,
  fetchProspectDefaults, mapProspectoToStore, backendConfigHint, getHttpApiBase,
} from '../adapters/rf-pipeline-api.js';
import { exportExcel } from '../components/export.js';
import { PROSPECT_EXPORT_COLS } from '../adapters/rf-pipeline-api.js';

const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
const CLUSTERS = ['agro', 'industria', 'varejo'];
const PORTES = [
  { v: '01', l: 'Micro (0–9)' },
  { v: '03', l: 'EPP (10–49)' },
  { v: '05', l: 'Demais (50+)' },
];
const CAPITAL_PRESETS = [
  { l: 'R$ 0–81k', min: 0, max: 81000 },
  { l: 'R$ 81k–360k', min: 81000, max: 360000 },
  { l: 'R$ 360k–1M', min: 360000, max: 1000000 },
  { l: 'R$ 1M–4,8M', min: 1000000, max: 4800000 },
  { l: 'R$ 2–10M ICP', min: 2000000, max: 10000000 },
  { l: '+4,8M', min: 4800000, max: null },
];

let mountEl = null;
let debounceTimer = null;
let state = {
  filtros: defaultFiltros(),
  aba: 'todas',
  page: 1,
  pageSize: 25,
  counts: { todas: 0, nao_enriquecidas: 0, enriquecidas: 0, novas: 0 },
  rows: [],
  total: 0,
  loading: false,
  searched: false,
  selected: new Set(),
  openGroups: new Set(['localizacao', 'capital']),
  backendOnline: false,
};

function defaultFiltros() {
  const cfg = window.__AFS_PROSPECT_DEFAULTS__ || {};
  return {
    capital_min: cfg.capital_min ?? 2000000,
    capital_max: cfg.capital_max ?? 10000000,
    ufs: [],
    clusters: [],
    cnaes: [],
    municipios: [],
    portes: [],
    naturezas: [],
    q: '',
    socio_nome: '',
    tipo_estabelecimento: 'todos',
    situacao_cadastral: 'todos',
    data_abertura_de: '',
    data_abertura_ate: '',
    apenas_email: false,
    apenas_telefone: false,
    excluir_enriquecidas: false,
    excluir_importados_crm: false,
    novas_dias: 90,
  };
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function formatCnpj(c) {
  const d = String(c || '').replace(/\D/g, '').padStart(8, '0');
  return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/0001-00';
}

function activeFilterCount() {
  const f = state.filtros;
  let n = 0;
  if (f.ufs?.length) n++;
  if (f.clusters?.length) n++;
  if (f.cnaes?.length) n++;
  if (f.municipios?.length) n++;
  if (f.portes?.length) n++;
  if (f.naturezas?.length) n++;
  if (f.socio_nome) n++;
  if (f.tipo_estabelecimento !== 'todos') n++;
  if (f.situacao_cadastral !== 'todos') n++;
  if (f.data_abertura_de || f.data_abertura_ate) n++;
  if (f.apenas_email || f.apenas_telefone || f.excluir_enriquecidas || f.excluir_importados_crm) n++;
  if (f.capital_min != null || f.capital_max != null) n++;
  if (f.q) n++;
  return n;
}

function filtrosFromDom(root) {
  const f = { ...state.filtros };
  f.q = root.querySelector('#ps-q')?.value.trim() || '';
  f.capital_min = root.querySelector('#ps-cap-min')?.value !== '' ? Number(root.querySelector('#ps-cap-min').value) : null;
  f.capital_max = root.querySelector('#ps-cap-max')?.value !== '' ? Number(root.querySelector('#ps-cap-max').value) : null;
  f.socio_nome = root.querySelector('#ps-socio')?.value.trim() || '';
  f.data_abertura_de = root.querySelector('#ps-abert-de')?.value || '';
  f.data_abertura_ate = root.querySelector('#ps-abert-ate')?.value || '';
  f.apenas_email = !!root.querySelector('#ps-opt-email')?.checked;
  f.apenas_telefone = !!root.querySelector('#ps-opt-tel')?.checked;
  f.excluir_enriquecidas = !!root.querySelector('#ps-opt-excl-enr')?.checked;
  f.excluir_importados_crm = !!root.querySelector('#ps-opt-excl-crm')?.checked;
  f.tipo_estabelecimento = root.querySelector('input[name=ps-tipo]:checked')?.value || 'todos';
  f.situacao_cadastral = root.querySelector('input[name=ps-situacao]:checked')?.value || 'todos';
  f.ufs = [...root.querySelectorAll('#ps-ufs input:checked')].map((el) => el.value);
  f.clusters = [...root.querySelectorAll('#ps-clusters input:checked')].map((el) => el.value);
  f.portes = [...root.querySelectorAll('#ps-portes input:checked')].map((el) => el.value);
  f.cnaes = (root.querySelector('#ps-cnaes-data')?.value || '').split('|').filter(Boolean);
  f.municipios = (root.querySelector('#ps-mun-data')?.value || '').split('|').filter(Boolean);
  f.naturezas = [...root.querySelectorAll('#ps-nat input:checked')].map((el) => el.value);
  return f;
}

function filtrosForApi(f) {
  const out = { ...f };
  if (f.excluir_importados_crm) {
    const cnpjs = store.list('leads').rows
      .map(function (l) { return l.cnpj_basico || String(l.cnpj || '').replace(/\D/g, '').slice(0, 8); })
      .filter(Boolean);
    out.excluir_cnpjs = [...new Set(cnpjs)];
  }
  return out;
}

function scheduleSearch(root) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(function () {
    state.filtros = filtrosFromDom(root);
    state.page = 1;
    void refreshResults(root);
  }, 400);
}

async function refreshResults(root) {
  state.loading = true;
  renderResultsArea(root);
  try {
    const [counts, search] = await Promise.all([
      prospeccaoCount(filtrosForApi(state.filtros)),
      prospeccaoSearch({
        filtros: filtrosForApi(state.filtros),
        aba: state.aba,
        page: state.page,
        page_size: state.pageSize,
      }),
    ]);
    state.counts = counts;
    state.rows = search.rows || [];
    state.total = search.total || 0;
    state.searched = true;
  } catch (e) {
    window.AFSToast?.error(e.message || 'Erro na busca');
  } finally {
    state.loading = false;
    renderResultsArea(root);
    updateTabCounts(root);
  }
}

function updateTabCounts(root) {
  const c = state.counts;
  root.querySelector('#ps-tab-todas') && (root.querySelector('#ps-tab-todas').textContent = 'Todas (' + (c.todas || 0).toLocaleString('pt-BR') + ')');
  root.querySelector('#ps-tab-nao') && (root.querySelector('#ps-tab-nao').textContent = 'Não enriquecidas (' + (c.nao_enriquecidas || 0).toLocaleString('pt-BR') + ')');
  root.querySelector('#ps-tab-enr') && (root.querySelector('#ps-tab-enr').textContent = 'Enriquecidas (' + (c.enriquecidas || 0).toLocaleString('pt-BR') + ')');
  root.querySelector('#ps-tab-novas') && (root.querySelector('#ps-tab-novas').textContent = 'Novas (' + (c.novas || 0).toLocaleString('pt-BR') + ')');
}

function accordionGroup(id, icon, label, bodyHtml, open) {
  const isOpen = open || state.openGroups.has(id);
  return (
    '<div class="ps-acc" data-acc="' + id + '">' +
      '<button type="button" class="ps-acc-head' + (isOpen ? ' open' : '') + '" data-toggle-acc="' + id + '">' +
        '<span class="ps-acc-icon">' + icon + '</span><span>' + label + '</span>' +
        '<span class="ps-acc-chev">›</span>' +
      '</button>' +
      '<div class="ps-acc-body' + (isOpen ? ' open' : '') + '">' + bodyHtml + '</div>' +
    '</div>'
  );
}

function renderSidebar() {
  const n = activeFilterCount();
  const f = state.filtros;
  const ufChecks = UFS.map(function (u) {
    return '<label><input type="checkbox" value="' + u + '"' + (f.ufs.includes(u) ? ' checked' : '') + '> ' + u + '</label>';
  }).join('');
  const clusterChecks = CLUSTERS.map(function (c) {
    return '<label><input type="checkbox" value="' + c + '"' + (f.clusters.includes(c) ? ' checked' : '') + '> ' + c + '</label>';
  }).join('');
  const porteChecks = PORTES.map(function (p) {
    return '<label><input type="checkbox" value="' + p.v + '"' + (f.portes.includes(p.v) ? ' checked' : '') + '> ' + p.l + '</label>';
  }).join('');
  const capPresets = CAPITAL_PRESETS.map(function (p) {
    return '<label><input type="checkbox" class="ps-cap-preset" data-min="' + p.min + '" data-max="' + (p.max ?? '') + '"> ' + p.l + '</label>';
  }).join('');

  return (
    '<aside class="ps-sidebar">' +
      '<div class="ps-sidebar-head">' +
        '<h3>Filtros' + (n ? ' <span class="ps-badge">' + n + '</span>' : '') + '</h3>' +
        '<button type="button" class="btn sm" id="ps-clear-filters">Limpar</button>' +
      '</div>' +
      '<div class="ps-opt-block">' +
        '<p class="ps-opt-title">Opções de pesquisa</p>' +
        '<label class="ps-check"><input type="checkbox" id="ps-opt-email"' + (f.apenas_email ? ' checked' : '') + '> Apenas com e-mail</label>' +
        '<label class="ps-check"><input type="checkbox" id="ps-opt-tel"' + (f.apenas_telefone ? ' checked' : '') + '> Apenas com telefone</label>' +
        '<label class="ps-check"><input type="checkbox" id="ps-opt-excl-enr"' + (f.excluir_enriquecidas ? ' checked' : '') + '> Excluir já enriquecidas</label>' +
        '<label class="ps-check"><input type="checkbox" id="ps-opt-excl-crm"' + (f.excluir_importados_crm ? ' checked' : '') + '> Excluir já importadas p/ CRM</label>' +
      '</div>' +
      accordionGroup('localizacao', '📍', 'Localização',
        '<div class="ps-check-grid" id="ps-ufs">' + ufChecks + '</div>' +
        '<div class="ps-field"><span>Município</span>' +
          '<input type="search" id="ps-mun-q" placeholder="Buscar município…" autocomplete="off">' +
          '<div id="ps-mun-suggest" class="ps-suggest"></div>' +
          '<input type="hidden" id="ps-mun-data" value="' + esc(f.municipios.join('|')) + '">' +
          '<div id="ps-mun-chips" class="ps-chips"></div></div>', true) +
      accordionGroup('cnae', '🏭', 'CNAE / Atividade',
        '<input type="search" id="ps-cnae-q" placeholder="Buscar CNAE…" autocomplete="off">' +
        '<div id="ps-cnae-suggest" class="ps-suggest"></div>' +
        '<input type="hidden" id="ps-cnaes-data" value="' + esc(f.cnaes.join('|')) + '">' +
        '<div id="ps-cnae-chips" class="ps-chips"></div>') +
      accordionGroup('cluster', '◈', 'Segmento / Cluster',
        '<div class="ps-check-list" id="ps-clusters">' + clusterChecks + '</div>') +
      accordionGroup('porte', '👥', 'Porte (funcionários proxy)',
        '<div class="ps-check-list" id="ps-portes">' + porteChecks + '</div>') +
      accordionGroup('capital', '💰', 'Capital social',
        '<div class="ps-check-list ps-cap-presets">' + capPresets + '</div>' +
        '<div class="ps-row2">' +
          '<label class="ps-field"><span>Mín (R$)</span><input type="number" id="ps-cap-min" value="' + (f.capital_min ?? '') + '"></label>' +
          '<label class="ps-field"><span>Máx (R$)</span><input type="number" id="ps-cap-max" value="' + (f.capital_max ?? '') + '"></label>' +
        '</div>') +
      accordionGroup('tipo', '🏢', 'Tipo estabelecimento',
        toggleRow('ps-tipo', f.tipo_estabelecimento, [
          ['todos', 'Todos'], ['matriz', 'Matriz'], ['filial', 'Com filiais'],
        ])) +
      accordionGroup('situacao', '✓', 'Situação cadastral',
        toggleRow('ps-situacao', f.situacao_cadastral, [
          ['todos', 'Todos'], ['ativa', 'Ativa'], ['inativa', 'Baixada/Inapta'],
        ])) +
      accordionGroup('abertura', '📅', 'Data de abertura',
        '<div class="ps-row2">' +
          '<label class="ps-field"><span>De</span><input type="date" id="ps-abert-de" value="' + esc(f.data_abertura_de) + '"></label>' +
          '<label class="ps-field"><span>Até</span><input type="date" id="ps-abert-ate" value="' + esc(f.data_abertura_ate) + '"></label>' +
        '</div>') +
      accordionGroup('socios', '👤', 'Sócios',
        '<input type="search" id="ps-socio" placeholder="Nome do sócio…" value="' + esc(f.socio_nome) + '">') +
      accordionGroup('natureza', '⚖', 'Natureza jurídica',
        '<div id="ps-nat" class="ps-check-list ps-nat-list"><p class="hint">Carregando…</p></div>') +
      '<button type="button" class="btn primary ps-save-search" id="ps-save-search">Salvar pesquisa</button>' +
      '<button type="button" class="btn sm ps-apply" id="ps-apply">Aplicar filtros</button>' +
    '</aside>'
  );
}

function toggleRow(name, current, options) {
  return '<div class="ps-toggle-row">' + options.map(function (o) {
    return '<label class="ps-toggle"><input type="radio" name="' + name + '" value="' + o[0] + '"' +
      (current === o[0] ? ' checked' : '') + '> ' + o[1] + '</label>';
  }).join('') + '</div>';
}

function renderMain() {
  return (
    '<main class="ps-main">' +
      '<div class="ps-topbar">' +
        '<input type="search" id="ps-q" class="ps-search-input" placeholder="Razão social ou CNPJ…" value="' + esc(state.filtros.q) + '">' +
        '<div class="ps-topbar-actions">' +
          '<button type="button" class="btn sm" id="ps-btn-admin">⚙ Base de dados</button>' +
          '<button type="button" class="btn sm" id="ps-btn-intel">📊 Mapas</button>' +
        '</div>' +
      '</div>' +
      '<div class="ps-results-bar">' +
        '<div class="ps-tabs" role="tablist">' +
          tabBtn('todas', 'ps-tab-todas', 'Todas') +
          tabBtn('nao_enriquecidas', 'ps-tab-nao', 'Não enriquecidas') +
          tabBtn('enriquecidas', 'ps-tab-enr', 'Enriquecidas') +
          tabBtn('novas', 'ps-tab-novas', 'Novas') +
        '</div>' +
        '<div class="ps-batch-actions">' +
          '<button type="button" class="btn sm" id="ps-batch-enr" disabled>Enriquecer selecionados</button>' +
          '<button type="button" class="btn sm" id="ps-batch-crm" disabled>Importar CRM</button>' +
        '</div>' +
      '</div>' +
      '<div id="ps-chips-active" class="ps-chips-active"></div>' +
      '<div id="ps-results" class="ps-results-wrap"></div>' +
    '</main>'
  );
}

function tabBtn(id, elId, label) {
  const num = state.counts[id] ?? 0;
  return '<button type="button" role="tab" class="ps-tab' + (state.aba === id ? ' active' : '') + '" data-aba="' + id + '" id="' + elId + '">' +
    label + ' (' + num.toLocaleString('pt-BR') + ')</button>';
}

function renderResultsArea(root) {
  const el = root?.querySelector('#ps-results') || mountEl?.querySelector('#ps-results');
  if (!el) return;

  if (!state.searched && !state.loading) {
    el.innerHTML =
      '<div class="ps-hero-empty">' +
        '<div class="ps-hero-icon">🔍</div>' +
        '<h2>Comece sua busca usando os filtros ao lado</h2>' +
        '<p>Combine CNAE, localização, capital e porte para encontrar empresas Lucro Real.</p>' +
        '<div class="ps-presets">' +
          presetCard('ICP padrão R$ 2–10mi', { capital_min: 2000000, capital_max: 10000000 }) +
          presetCard('Transição de Regime', { capital_min: 360000, capital_max: 4800000, situacao_cadastral: 'ativa' }) +
          presetCard('Novas empresas SP', { ufs: ['SP'], novas_dias: 90 }) +
          presetCard('Dead Zone LR', { capital_min: 360000, capital_max: 4800000, situacao_cadastral: 'ativa', portes: ['03'] }) +
        '</div>' +
      '</div>';
    return;
  }

  if (state.loading) {
    el.innerHTML = '<table class="ps-table"><tbody>' +
      Array(8).fill(0).map(function () {
        return '<tr class="ps-skeleton"><td colspan="10"><div class="ps-skel-bar"></div></td></tr>';
      }).join('') + '</tbody></table>';
    return;
  }

  if (!state.rows.length) {
    el.innerHTML = '<p class="ps-empty">Nenhuma empresa encontrada com estes filtros.</p>';
    return;
  }

  const start = (state.page - 1) * state.pageSize + 1;
  const end = Math.min(state.page * state.pageSize, state.total);

  el.innerHTML =
    '<table class="ps-table">' +
      '<thead><tr>' +
        '<th><input type="checkbox" id="ps-select-all" aria-label="Selecionar todos"></th>' +
        '<th>Empresa</th><th>Ações</th><th>CNPJ</th><th>Tipo</th><th>Cidade/UF</th>' +
        '<th>CNAE</th><th>Capital</th><th>Porte</th><th>Contatos</th>' +
      '</tr></thead><tbody>' +
      state.rows.map(function (r) {
        const name = r.nome_fantasia || r.razao_social || '—';
        const initial = (name[0] || '?').toUpperCase();
        const sel = state.selected.has(r.cnpj_basico);
        return '<tr data-cnpj="' + esc(r.cnpj_basico) + '">' +
          '<td><input type="checkbox" class="ps-row-cb" value="' + esc(r.cnpj_basico) + '"' + (sel ? ' checked' : '') + '></td>' +
          '<td><div class="ps-empresa-cell"><span class="ps-avatar">' + initial + '</span>' +
            '<div><strong>' + esc(r.razao_social || name) + '</strong>' +
            (r.nome_fantasia ? '<br><small class="hint">' + esc(r.nome_fantasia) + '</small>' : '') +
          '</div></div></td>' +
          '<td><button type="button" class="btn sm primary ps-enr-one" data-cnpj="' + esc(r.cnpj_basico) + '" data-enr="' + (r.enriquecida ? '1' : '0') + '">' +
            (r.enriquecida ? 'Ver contatos' : 'Enriquecer') + '</button></td>' +
          '<td><code>' + formatCnpj(r.cnpj_basico) + '</code></td>' +
          '<td><span class="pm-tag">' + esc(r.tipo || 'Matriz') + '</span></td>' +
          '<td>' + esc(r.municipio || '—') + ' / ' + esc(r.uf || '—') + '</td>' +
          '<td title="' + esc(r.cnae_descricao || '') + '"><code>' + esc(r.cnae || '—') + '</code></td>' +
          '<td>' + formatCapital(r.capital_social) + '</td>' +
          '<td>' + esc(r.porte || '—') + '</td>' +
          '<td class="hint">' + esc(r.contatos_label || '—') + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>' +
    '<div class="ps-pagination">' +
      '<label>Por página <select id="ps-page-size">' +
        [25, 50, 100].map(function (n) {
          return '<option value="' + n + '"' + (state.pageSize === n ? ' selected' : '') + '>' + n + '</option>';
        }).join('') +
      '</select></label>' +
      '<span>' + start + '–' + end + ' de ' + state.total.toLocaleString('pt-BR') + '</span>' +
      '<button type="button" class="btn sm" id="ps-prev"' + (state.page <= 1 ? ' disabled' : '') + '>Anterior</button>' +
      '<button type="button" class="btn sm" id="ps-next"' + (end >= state.total ? ' disabled' : '') + '>Próxima</button>' +
    '</div>';
}

function presetCard(title, patch) {
  return '<button type="button" class="ps-preset-card" data-preset=\'' + JSON.stringify(patch).replace(/'/g, '&#39;') + '\'>' +
    '<strong>' + esc(title) + '</strong><span class="hint">Clique para aplicar</span></button>';
}

function renderPage(root) {
  root.innerHTML =
    '<div class="ps-page prospeccao-page">' +
      renderSidebar() +
      renderMain() +
    '</div>';
  renderResultsArea(root);
  renderActiveChips(root);
}

function renderActiveChips(root) {
  const el = root.querySelector('#ps-chips-active');
  if (!el) return;
  const chips = [];
  const f = state.filtros;
  f.ufs.forEach(function (u) { chips.push(['UF ' + u, function () { f.ufs = f.ufs.filter(function (x) { return x !== u; }); }]); });
  f.clusters.forEach(function (c) { chips.push([c, function () { f.clusters = f.clusters.filter(function (x) { return x !== c; }); }]); });
  if (f.q) chips.push(['Busca: ' + f.q, function () { f.q = ''; }]);
  el.innerHTML = chips.map(function (c, i) {
    return '<span class="ps-chip-rem">' + esc(c[0]) + ' <button type="button" data-chip="' + i + '">×</button></span>';
  }).join('');
  el.querySelectorAll('[data-chip]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const idx = Number(btn.getAttribute('data-chip'));
      chips[idx][1]();
      state.filtros = f;
      void refreshResults(root);
      renderPage(root);
      bindEvents(root);
    });
  });
}

async function loadNaturezas(root) {
  const box = root.querySelector('#ps-nat');
  if (!box) return;
  try {
    const list = await fetchNaturezas();
    box.innerHTML = list.slice(0, 40).map(function (n) {
      return '<label><input type="checkbox" value="' + esc(n) + '"' +
        (state.filtros.naturezas.includes(n) ? ' checked' : '') + '> ' + esc(n) + '</label>';
    }).join('') || '<p class="hint">Nenhuma natureza na base.</p>';
    box.querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('change', function () { scheduleSearch(root); });
    });
  } catch (_) {
    box.innerHTML = '<p class="hint">Indisponível offline.</p>';
  }
}

function bindAutocomplete(root) {
  let cnaeT = null;
  root.querySelector('#ps-cnae-q')?.addEventListener('input', function () {
    clearTimeout(cnaeT);
    const q = this.value.trim();
    cnaeT = setTimeout(async function () {
      const box = root.querySelector('#ps-cnae-suggest');
      const items = await fetchCnaes(q);
      box.innerHTML = items.map(function (it) {
        return '<button type="button" class="ps-suggest-item" data-c="' + esc(it.codigo) + '">' +
          '<code>' + esc(it.codigo) + '</code> ' + esc((it.descricao || '').slice(0, 60)) + '</button>';
      }).join('');
      box.querySelectorAll('.ps-suggest-item').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const c = btn.getAttribute('data-c');
          const hidden = root.querySelector('#ps-cnaes-data');
          const arr = (hidden.value || '').split('|').filter(Boolean);
          if (!arr.includes(c)) arr.push(c);
          hidden.value = arr.join('|');
          root.querySelector('#ps-cnae-q').value = '';
          box.innerHTML = '';
          scheduleSearch(root);
        });
      });
    }, 300);
  });

  let munT = null;
  root.querySelector('#ps-mun-q')?.addEventListener('input', function () {
    clearTimeout(munT);
    const q = this.value.trim();
    munT = setTimeout(async function () {
      const box = root.querySelector('#ps-mun-suggest');
      const uf = state.filtros.ufs[0] || '';
      const items = await fetchMunicipios(q, uf || undefined);
      box.innerHTML = items.map(function (it) {
        return '<button type="button" class="ps-suggest-item" data-m="' + esc(it.nome) + '">' +
          esc(it.nome) + ' — ' + esc(it.uf) + '</button>';
      }).join('');
      box.querySelectorAll('.ps-suggest-item').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const m = btn.getAttribute('data-m');
          const hidden = root.querySelector('#ps-mun-data');
          const arr = (hidden.value || '').split('|').filter(Boolean);
          if (!arr.includes(m)) arr.push(m);
          hidden.value = arr.join('|');
          root.querySelector('#ps-mun-q').value = '';
          box.innerHTML = '';
          scheduleSearch(root);
        });
      });
    }, 300);
  });
}

function bindEvents(root) {
  root.querySelectorAll('[data-toggle-acc]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = btn.getAttribute('data-toggle-acc');
      if (state.openGroups.has(id)) state.openGroups.delete(id);
      else state.openGroups.add(id);
      const body = btn.parentElement.querySelector('.ps-acc-body');
      body?.classList.toggle('open');
      btn.classList.toggle('open');
    });
  });

  root.querySelector('#ps-clear-filters')?.addEventListener('click', function () {
    state.filtros = defaultFiltros();
    state.page = 1;
    state.searched = false;
    renderPage(root);
    bindEvents(root);
    loadNaturezas(root);
    bindAutocomplete(root);
  });

  root.querySelector('#ps-apply')?.addEventListener('click', function () {
    state.filtros = filtrosFromDom(root);
    state.page = 1;
    void refreshResults(root);
  });

  root.querySelectorAll('.ps-cap-preset').forEach(function (cb) {
    cb.addEventListener('change', function () {
      if (!cb.checked) return;
      root.querySelector('#ps-cap-min').value = cb.getAttribute('data-min') || '';
      root.querySelector('#ps-cap-max').value = cb.getAttribute('data-max') || '';
      scheduleSearch(root);
    });
  });

  root.querySelectorAll('#ps-ufs input, #ps-clusters input, #ps-portes input, #ps-opt-email, #ps-opt-tel, #ps-opt-excl-enr, #ps-opt-excl-crm, input[name=ps-tipo], input[name=ps-situacao]').forEach(function (el) {
    el.addEventListener('change', function () { scheduleSearch(root); });
  });

  ['#ps-cap-min', '#ps-cap-max', '#ps-socio', '#ps-abert-de', '#ps-abert-ate', '#ps-q'].forEach(function (sel) {
    root.querySelector(sel)?.addEventListener('input', function () { scheduleSearch(root); });
  });

  root.querySelectorAll('.ps-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      state.aba = tab.getAttribute('data-aba');
      state.page = 1;
      root.querySelectorAll('.ps-tab').forEach(function (t) { t.classList.toggle('active', t === tab); });
      void refreshResults(root);
    });
  });

  root.querySelector('#ps-save-search')?.addEventListener('click', async function () {
    const nome = prompt('Nome da pesquisa salva:');
    if (!nome) return;
    state.filtros = filtrosFromDom(root);
    await saveSegmentacao(nome, state.filtros);
    window.AFSToast?.success('Pesquisa salva');
  });

  root.querySelector('#ps-btn-admin')?.addEventListener('click', function () {
    openAdminDrawer(root);
  });

  root.querySelector('#ps-btn-intel')?.addEventListener('click', function () {
    location.hash = '#/prospeccao/massa?view=intel';
    openIntelDrawer(root);
  });

  root.addEventListener('change', function (e) {
    if (e.target.id === 'ps-page-size') {
      state.pageSize = Number(e.target.value);
      state.page = 1;
      void refreshResults(root);
    }
  });

  root.addEventListener('click', function (e) {
    const enr = e.target.closest('.ps-enr-one');
    if (enr) {
      const cnpj = enr.getAttribute('data-cnpj');
      if (enr.getAttribute('data-enr') === '1') {
        void openContatosDrawer(cnpj);
      } else {
        enr.disabled = true;
        void enriquecerCnpjs([cnpj], true).then(function (r) {
          const proc = r.processamento?.processados ?? r.enfileirados ?? 0;
          window.AFSToast?.success(proc + ' enriquecido(s) — cascata RF→API→site');
          void refreshResults(root);
        }).catch(function (err) {
          window.AFSToast?.error(err.message);
        }).finally(function () { enr.disabled = false; });
      }
      return;
    }
    if (e.target.id === 'ps-prev' && state.page > 1) {
      state.page--;
      void refreshResults(root);
    }
    if (e.target.id === 'ps-next') {
      state.page++;
      void refreshResults(root);
    }
    if (e.target.id === 'ps-select-all') {
      const checked = e.target.checked;
      state.rows.forEach(function (r) {
        if (checked) state.selected.add(r.cnpj_basico);
        else state.selected.delete(r.cnpj_basico);
      });
      root.querySelectorAll('.ps-row-cb').forEach(function (cb) { cb.checked = checked; });
      updateBatchButtons(root);
    }
    if (e.target.classList.contains('ps-row-cb')) {
      const c = e.target.value;
      if (e.target.checked) state.selected.add(c);
      else state.selected.delete(c);
      updateBatchButtons(root);
    }
    const preset = e.target.closest('.ps-preset-card');
    if (preset) {
      const patch = JSON.parse(preset.getAttribute('data-preset'));
      state.filtros = { ...defaultFiltros(), ...patch };
      state.page = 1;
      renderPage(root);
      bindEvents(root);
      loadNaturezas(root);
      bindAutocomplete(root);
      void refreshResults(root);
    }
  });

  root.querySelector('#ps-batch-enr')?.addEventListener('click', async function () {
    const cnpjs = [...state.selected];
    if (!cnpjs.length) return;
    const btn = root.querySelector('#ps-batch-enr');
    btn.disabled = true;
    try {
      const r = await enriquecerCnpjs(cnpjs, true);
      const proc = r.processamento?.processados ?? r.enfileirados ?? 0;
      window.AFSToast?.success(proc + ' enriquecidos');
      state.selected.clear();
      updateBatchButtons(root);
      await refreshResults(root);
    } catch (e) {
      window.AFSToast?.error(e.message);
    } finally {
      btn.disabled = state.selected.size === 0;
    }
  });

  root.querySelector('#ps-batch-crm')?.addEventListener('click', async function () {
    const cnpjs = [...state.selected];
    if (!cnpjs.length) return;
    const search = await prospeccaoSearch({ filtros: { ...state.filtros, excluir_cnpjs: [] }, aba: 'todas', page: 1, page_size: 100 });
    const rows = (search.rows || []).filter(function (r) { return cnpjs.includes(r.cnpj_basico); });
    store.bulkUpsert('leads', rows.map(function (p) {
      return { ...mapProspectoToStore(p), id: store.uid('lead') };
    }));
    window.AFSToast?.success(rows.length + ' importados para CRM');
  });

  updateBatchButtons(root);
}

function updateBatchButtons(root) {
  const n = state.selected.size;
  root.querySelector('#ps-batch-enr') && (root.querySelector('#ps-batch-enr').disabled = n === 0);
  root.querySelector('#ps-batch-crm') && (root.querySelector('#ps-batch-crm').disabled = n === 0);
}

function openAdminDrawer(root) {
  openDrawer({
    title: 'Administração da base',
    bodyHtml: '<div id="ps-admin-body"><p class="hint">Carregando…</p></div>',
    width: '640px',
  });
  setTimeout(function () { renderAdminPanel(document.getElementById('ps-admin-body')); }, 50);
}

async function openContatosDrawer(cnpjBasico) {
  openDrawer({
    title: 'Contatos — CNPJ ' + formatCnpj(cnpjBasico),
    bodyHtml: '<div id="ps-contatos-body"><p class="hint">Carregando contatos…</p></div>',
    width: '520px',
  });
  const el = document.getElementById('ps-contatos-body');
  try {
    const list = await fetchContatos(cnpjBasico);
    if (!list.length) {
      el.innerHTML = '<p class="hint">Nenhum contato coletado. Clique em Enriquecer para rodar a cascata.</p>' +
        '<button type="button" class="btn sm primary" id="ps-cont-enr">Enriquecer agora</button>';
      el.querySelector('#ps-cont-enr')?.addEventListener('click', async function () {
        await enriquecerCnpjUnitario(cnpjBasico);
        window.AFSToast?.success('Enriquecimento concluído');
        void openContatosDrawer(cnpjBasico);
      });
      return;
    }
    el.innerHTML = '<table class="ps-table"><thead><tr><th>Tipo</th><th>Valor</th><th>Fonte</th><th>Conf.</th></tr></thead><tbody>' +
      list.map(function (c) {
        return '<tr><td>' + esc(c.tipo) + '</td><td>' + esc(c.valor) + '</td><td>' + esc(c.fonte) + '</td><td>' + esc(c.confianca || '—') + '</td></tr>';
      }).join('') + '</tbody></table>';
  } catch (e) {
    el.innerHTML = '<p class="hint">Erro: ' + esc(e.message) + '</p>';
  }
}

function openIntelDrawer(root) {
  openDrawer({
    title: 'Mapas & Inteligência',
    bodyHtml:
      '<nav class="l2-subnav pm-tabs" style="margin-bottom:1rem">' +
        '<a href="#/prospeccao/massa?view=mapa">Mapa LR</a>' +
        '<a href="#/prospeccao/dead-zone">Dead Zone</a>' +
        '<a href="#/prospeccao/transicao">Transição Regime</a>' +
      '</nav>' +
      '<p class="hint">Abra os módulos de inteligência pelo menu lateral ou links acima.</p>',
    width: '480px',
  });
}

async function renderAdminPanel(el) {
  if (!el) return;
  const ping = await pingHttpBackend();
  state.backendOnline = ping.online;
  const st = ping.data || (await fetchRfStatus()) || {};
  const loaded = st.prospectos_carregados ?? 0;

  el.innerHTML =
    '<div class="pm-backend-status ' + (ping.online ? 'online' : 'offline') + '">' +
      (ping.online ? 'Backend online' : 'Backend offline — ' + esc(backendConfigHint() || '')) +
    '</div>' +
    '<h4>Ingestão Receita Federal</h4>' +
    '<p class="hint">Prospectos carregados: <strong>' + loaded.toLocaleString('pt-BR') + '</strong></p>' +
    '<div class="pm-actions">' +
      '<button type="button" class="btn primary sm" id="adm-rf-start"' + (!ping.online ? ' disabled' : '') + '>Iniciar ingestão RF</button>' +
      '<label class="pm-check"><input type="checkbox" id="adm-skip-dl"> Pular download</label>' +
    '</div>' +
    '<pre id="adm-log" class="pm-log hint">—</pre>' +
    '<hr style="border-color:var(--border-subtle);margin:1rem 0">' +
    '<h4>Exportar Excel</h4>' +
    '<div class="pm-export-form">' +
      '<select id="adm-export-lim"><option value="5000">5.000</option><option value="50000" selected>50.000</option></select>' +
      '<button type="button" class="btn sm primary" id="adm-export"' + (!ping.online ? ' disabled' : '') + '>Exportar .xlsx</button>' +
    '</div>' +
    '<h4 style="margin-top:1rem">Grupos para raspagem</h4>' +
    '<input type="text" id="adm-grp-name" placeholder="Nome do grupo">' +
    '<button type="button" class="btn sm" id="adm-grp-save">Salvar grupo (filtros atuais)</button>' +
    '<hr style="border-color:var(--border-subtle);margin:1rem 0">' +
    '<h4>Fila de enriquecimento (contatos)</h4>' +
    '<div class="pm-actions">' +
      '<button type="button" class="btn sm primary" id="adm-queue-run"' + (!ping.online ? ' disabled' : '') + '>Processar fila (10)</button>' +
      '<span id="adm-queue-st" class="hint">—</span>' +
    '</div>' +
    '<hr style="border-color:var(--border-subtle);margin:1rem 0">' +
    '<h4>Prospecção social (LinkedIn + Instagram)</h4>' +
    '<p class="hint">Uma URL/usuário por linha. Requer credenciais em prospect-automation/.env no servidor.</p>' +
    '<label class="ps-field"><span>LinkedIn URLs</span><textarea id="adm-li-urls" rows="2" placeholder="https://linkedin.com/in/..."></textarea></label>' +
    '<label class="ps-field"><span>Instagram users</span><textarea id="adm-ig-users" rows="2" placeholder="usuario1"></textarea></label>' +
    '<button type="button" class="btn sm" id="adm-social-run"' + (!ping.online ? ' disabled' : '') + '>Iniciar scrape social</button>' +
    '<pre id="adm-social-log" class="pm-log hint">—</pre>';

  el.querySelector('#adm-rf-start')?.addEventListener('click', async function () {
    const log = el.querySelector('#adm-log');
    try {
      log.textContent = 'Iniciando…';
      const res = await startRfIngest({ skipDownload: el.querySelector('#adm-skip-dl')?.checked, modo: 'completo' });
      await pollJob(res.job_id, function (j) { log.textContent = j.status + ' · ' + (j.message || ''); });
      window.AFSToast?.success('Ingestão concluída');
    } catch (e) {
      log.textContent = e.message;
    }
  });

  el.querySelector('#adm-export')?.addEventListener('click', async function () {
    try {
      await exportProspectosExcel({ ...state.filtros, limite: Number(el.querySelector('#adm-export-lim').value) });
      window.AFSToast?.success('Exportado');
    } catch (e) {
      window.AFSToast?.error(e.message);
    }
  });

  el.querySelector('#adm-grp-save')?.addEventListener('click', function () {
    const name = el.querySelector('#adm-grp-name')?.value.trim();
    if (!name) return;
    store.create('scrapingGroups', { nome: name, filtros: state.filtros, status: 'rascunho' });
    window.AFSToast?.success('Grupo salvo');
  });

  async function refreshQueueStatus() {
    const stEl = el.querySelector('#adm-queue-st');
    if (!stEl) return;
    try {
      const st = await fetchScrapingQueueStatus();
      const parts = Object.entries(st.fila || {}).map(function (kv) { return kv[0] + ': ' + kv[1]; });
      stEl.textContent = parts.length ? parts.join(' · ') : 'Fila vazia';
    } catch (_) {
      stEl.textContent = '—';
    }
  }
  void refreshQueueStatus();

  el.querySelector('#adm-queue-run')?.addEventListener('click', async function () {
    try {
      const r = await runScrapingQueue(10);
      window.AFSToast?.success((r.processados || 0) + ' processados, ' + (r.erros || 0) + ' erros');
      void refreshQueueStatus();
    } catch (e) {
      window.AFSToast?.error(e.message);
    }
  });

  el.querySelector('#adm-social-run')?.addEventListener('click', async function () {
    const log = el.querySelector('#adm-social-log');
    const li = (el.querySelector('#adm-li-urls')?.value || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    const ig = (el.querySelector('#adm-ig-users')?.value || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!li.length && !ig.length) {
      window.AFSToast?.error('Informe URLs ou usuários');
      return;
    }
    try {
      log.textContent = 'Enfileirando…';
      const res = await socialScrape({ linkedin_urls: li, instagram_users: ig });
      if (res.job_id) {
        log.textContent = 'Job #' + res.job_id + ' — aguardando…';
        await pollJob(res.job_id, function (j) {
          log.textContent = j.status + ' · ' + (j.message || '') + (j.result ? ' · ' + JSON.stringify(j.result) : '');
        });
        window.AFSToast?.success('Scrape social concluído');
      } else {
        log.textContent = JSON.stringify(res);
      }
    } catch (e) {
      log.textContent = e.message;
      window.AFSToast?.error(e.message);
    }
  });
}

export async function renderProspeccaoMassa({ mount }) {
  mountEl = mount;
  try {
    const d = await fetchProspectDefaults();
    if (d?.icp_ativo) {
      state.filtros.capital_min = d.icp_ativo.capital_min ?? state.filtros.capital_min;
      state.filtros.capital_max = d.icp_ativo.capital_max ?? state.filtros.capital_max;
    }
  } catch (_) {}

  const ping = await pingHttpBackend();
  state.backendOnline = ping.online;

  renderPage(mount);
  bindEvents(mount);
  loadNaturezas(mount);
  bindAutocomplete(mount);

  state.searched = true;
  await refreshResults(mount);
}
