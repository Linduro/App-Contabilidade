/**
 * Prospec├º├úo em Massa ÔÇö p├ígina dedicada com abas:
 * ingest├úo RF, mapa LR, auditorias, patrimonial, CNAE, prioriza├º├úo cold mail.
 */
import * as store from '../core/store.js';
import { fetchRfStatus, startRfIngest, pollJob, fetchProspectos, fetchProspectDefaults, mapProspectoToStore, exportProspectosExcel, pingHttpBackend, backendConfigHint, getHttpApiBase, PROSPECT_EXPORT_COLS } from '../adapters/rf-pipeline-api.js';
import { exportExcel } from '../components/export.js';
import {
  defaultFilters, renderFilterBar, bindFilterBar, formatCapital,
} from '../components/prospect-filters.js';
import {
  fetchMapaProspectos, fetchCnaeSetores, fetchAuditorias,
  fetchPatrimonial, fetchCarencia,
} from '../adapters/market-intel-api.js';
import { mountBrazilMap, destroyMap } from '../components/brazil-map.js';
import {
  fetchClassificacao, setDivisaoStatus, renderStatusBadge, renderPagination,
  bindPagination, formatCnaeCell, statusForDivisao,
} from '../components/cnae-classificacao.js';
import { LAB_SLUG_TO_TAB, LAB_SUBNAV } from '../shell/nav-config.js';
import { parseHash } from '../core/router.js';

const ALL_TABS = [
  { id: 'massa', label: 'Ingest├úo em massa' },
  { id: 'mapa', label: 'Mapa ┬À 230k LR' },
  { id: 'cnaes', label: 'CNAE ├ù Setores' },
  { id: 'teses', label: 'Teses & hip├│teses' },
  { id: 'auditorias', label: 'Auditorias' },
  { id: 'patrimonial', label: 'Controle patrimonial' },
  { id: 'coldmail', label: 'Prioriza├º├úo cold mail' },
];

const TABS = ALL_TABS;

function tabFromHash() {
  const raw = (location.hash || '').split('?')[1] || '';
  const p = new URLSearchParams(raw);
  const t = p.get('tab');
  if (t && ALL_TABS.some((x) => x.id === t)) return t;
  return 'massa';
}

function resolvePageContext(ctx) {
  const path = ctx?.path || parseHash().path;
  if (path.startsWith('/lab/')) {
    const slug = path.split('/')[2] || 'ingestao';
    return { section: 'lab', tab: LAB_SLUG_TO_TAB[slug] || 'massa', labSlug: slug };
  }
  if (path === '/operacao/coldmail') return { section: 'operacao', tab: 'coldmail', labSlug: null };
  if (path === '/estrategia/teses') return { section: 'estrategia', tab: 'teses', labSlug: null };
  return { section: 'legacy', tab: tabFromHash(), labSlug: null };
}

function navigateLab(slug) {
  location.hash = '#/lab/' + slug;
}

function scheduleMapResize(instance) {
  if (!instance?.map) return;
  const run = function () { try { instance.map.invalidateSize(true); } catch (_) {} };
  setTimeout(run, 80);
  setTimeout(run, 350);
}

function navigateTab(id) {
  state.tab = id;
  if (state.section === 'lab') {
    const slug = Object.entries(LAB_SLUG_TO_TAB).find(function (e) { return e[1] === id; });
    if (slug) { navigateLab(slug[0]); return; }
  }
  if (id === 'coldmail') { location.hash = '#/operacao/coldmail'; return; }
  if (id === 'teses') { location.hash = '#/estrategia/teses'; return; }
  location.hash = '#/prospeccao/massa?tab=' + id;
}

let state = {
  tab: 'massa',
  section: 'legacy',
  labSlug: 'ingestao',
  rfBusy: false,
  rfStatus: null,
  mapInstance: null,
  mapUf: '',
  cnaeQ: '',
  cnaeSecao: '',
  auditUf: '',
  patUf: '',
  filters: defaultFilters(),
  filtersInitialized: false,
  filterCount: null,
  prospectPage: 0,
  prospectPageSize: 100,
  cnaePage: 0,
  cnaePageSize: 100,
  cnaeClassFilter: '',
};

async function ensureFilters() {
  if (state.filtersInitialized) return;
  try {
    const d = await fetchProspectDefaults();
    const icp = d.icp_ativo || {};
    state.filters = {
      ...defaultFilters(),
      capitalMin: icp.capital_min ?? 2000000,
      capitalMax: icp.capital_max ?? 10000000,
    };
  } catch (_) {
    state.filters = defaultFilters();
  }
  state.filtersInitialized = true;
}

function filterParams(extra) {
  return { ...state.filters, ...(extra || {}) };
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function groupsList() {
  return store.list('scrapingGroups').rows;
}

function saveGroup(name, filters) {
  return store.create('scrapingGroups', {
    nome: name,
    filtros: filters,
    status: 'rascunho',
    nota: 'Fila preparada para raspagem futura (s├│cios, e-mails, filiais)',
  });
}

export async function renderProspeccaoMassa(ctx) {
  const mount = ctx.mount;
  const page = resolvePageContext(ctx);
  state.section = page.section;
  state.tab = page.tab;
  state.labSlug = page.labSlug;
  await ensureFilters();
  if (state.mapInstance) {
    destroyMap(state.mapInstance);
    state.mapInstance = null;
  }

  const showFilters = state.tab === 'massa' || state.tab === 'mapa';
  if (showFilters && getHttpApiBase()) {
    try {
      const cnt = await fetchProspectos({ ...filterParams(), limite: 1 });
      state.filterCount = cnt.total;
    } catch (_) {}
  }

  const sectionBanner = state.section === 'lab'
    ? '<div class="pm-section-banner lab"><span>Ôæá Laborat├│rio</span> Capta├º├úo, an├ílises, filtros, mapas e classifica├º├úo CNAE</div>'
    : state.section === 'operacao'
      ? '<div class="pm-section-banner operacao"><span>Ôæó Opera├º├úo</span> Prioriza├º├úo e execu├º├úo de outbound</div>'
      : '';

  const subnav = state.section === 'lab'
    ? '<nav class="l2-subnav pm-tabs">' + LAB_SUBNAV.map(function (item) {
        return '<a href="#/lab/' + item.slug + '" class="' + (state.labSlug === item.slug ? 'active' : '') + '">' + item.label + '</a>';
      }).join('') + '</nav>'
    : state.section === 'legacy'
      ? '<nav class="l2-subnav pm-tabs">' + ALL_TABS.map(function (t) {
          return '<a href="#" data-tab="' + t.id + '" class="' + (state.tab === t.id ? 'active' : '') + '">' + t.label + '</a>';
        }).join('') + '</nav>'
      : '';

  mount.innerHTML =
    '<div class="pm-page">' +
      sectionBanner +
      (state.tab === 'massa' && state.section !== 'operacao' ? heroHtml() : '') +
      subnav +
      (showFilters ? '<div id="pm-filters-wrap"></div>' : '') +
      '<div id="pm-tab-body" class="pm-tab-body"></div>' +
    '</div>';

  if (showFilters) {
    const fw = mount.querySelector('#pm-filters-wrap');
    fw.innerHTML = renderFilterBar('pm-f', state.filters, { count: state.filterCount });
    bindFilterBar(
      mount, 'pm-f',
      function () { state.prospectPage = 0; renderProspeccaoMassa(ctx); },
      function () { return state.filters; },
      function (f) { state.filters = f; state.filtersInitialized = true; },
    );
  }

  mount.querySelectorAll('[data-tab]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      navigateTab(a.getAttribute('data-tab'));
      renderProspeccaoMassa(ctx);
    });
  });

  const body = mount.querySelector('#pm-tab-body');
  if (state.tab === 'massa') await renderTabMassa(body, ctx);
  else if (state.tab === 'mapa') await renderTabMapa(body);
  else if (state.tab === 'cnaes') await renderTabCnaes(body, ctx);
  else if (state.tab === 'teses') {
    const { renderTeses } = await import('./teses.js');
    await renderTeses({ mount: body });
  } else if (state.tab === 'auditorias') await renderTabAuditorias(body);
  else if (state.tab === 'patrimonial') await renderTabPatrimonial(body);
  else if (state.tab === 'coldmail') await renderTabColdmail(body);
}

function heroHtml() {
  return (
    '<section class="pm-hero l2-card">' +
      '<div class="pm-hero-grid">' +
        '<div>' +
          '<span class="pm-eyebrow">Comece aqui</span>' +
          '<h2>Prospec├º├úo em Massa ┬À Lucro Real</h2>' +
          '<p class="hint">Base Receita Federal (~230 mil empresas). Use a aba <strong>Ingest├úo em massa</strong> para carregar os dados; depois explore mapas, concorrentes e prioriza├º├úo de cold mail.</p>' +
        '</div>' +
        '<div class="pm-hero-cta">' +
          '<button type="button" id="pm-hero-start" class="btn primary lg">ÔûÂ Iniciar ingest├úo RF</button>' +
          '<a class="btn sm" href="#/lab/ingestao">Ingest├úo RF ÔåÆ</a>' +
        '</div>' +
      '</div>' +
      '<ol class="pm-steps">' +
        '<li><strong>1.</strong> Clique em <em>Iniciar ingest├úo RF</em> (backend online)</li>' +
        '<li><strong>2.</strong> Aguarde o job (~15 GB download + DuckDB)</li>' +
        '<li><strong>3.</strong> Veja empresas no <em>Mapa</em> e exporte grupos para raspagem</li>' +
      '</ol>' +
    '</section>'
  );
}

async function renderTabMassa(body, ctx) {
  const mount = ctx.mount;
  const ping = await pingHttpBackend();
  state.rfStatus = ping.data || (await fetchRfStatus());
  const u = state.rfStatus?.universo || {};
  const loaded = state.rfStatus?.prospectos_carregados ?? 0;
  const snap = state.rfStatus?.snapshot;
  const backendOk = ping.online;
  const backendHint = backendConfigHint();

  body.innerHTML =
    '<div class="pm-backend-status ' + (backendOk ? 'online' : 'offline') + '">' +
      '<span class="pm-backend-dot"></span>' +
      (backendOk
        ? '<strong>Backend Python online</strong> ÔÇö ingest├úo e exporta├º├úo dispon├¡veis'
        : '<strong>Backend offline</strong> ÔÇö ' + esc(backendHint || '')) +
    '</div>' +
    '<div class="pm-grid-2">' +
      '<section class="l2-card pm-ingest-card">' +
        '<h3>Ingest├úo Receita Federal</h3>' +
        '<p class="hint">Pipeline completo: Empresas, Estabelecimentos, S├│cios, Simples ÔåÆ filtro Lucro Real.</p>' +
        '<dl class="pm-stats-dl">' +
          '<dt>Prospectos carregados</dt><dd><strong id="pm-loaded">' + loaded.toLocaleString('pt-BR') + '</strong></dd>' +
          '<dt>Universo LR estimado</dt><dd>' + (u.lucro_real ?? '~230.000') + '</dd>' +
          '<dt>Snapshot RF</dt><dd>' + (snap ? esc(snap.versao) + ' ┬À ' + esc(snap.data) : 'Nenhum ÔÇö rode a ingest├úo') + '</dd>' +
        '</dl>' +
        '<div class="pm-actions">' +
          '<button type="button" id="pm-rf-start" class="btn primary"' + (state.rfBusy || !backendOk ? ' disabled' : '') + '>Iniciar ingest├úo completa RF</button>' +
          '<button type="button" id="pm-rf-refresh" class="btn sm">Atualizar status</button>' +
          '<label class="pm-check"><input type="checkbox" id="pm-rf-skip-dl"> Pular download (usar arquivos locais)</label>' +
        '</div>' +
        '<pre id="pm-rf-log" class="pm-log hint">' + (backendOk ? 'Aguardando a├º├úoÔÇª' : esc(backendHint || '')) + '</pre>' +
      '</section>' +
      '<section class="l2-card">' +
        '<h3>Onde ficam os dados?</h3>' +
        '<ul class="pm-info-list">' +
          '<li><strong>Ap├│s ingest├úo:</strong> tabela <code>prospectos_rf</code> no DuckDB do servidor (<code>data/afs_market.duckdb</code> local ou volume Cloud Run)</li>' +
          '<li><strong>Detalhe por CNPJ:</strong> <code>estabelecimentos_rf</code> (matriz + filiais) e <code>socios_rf</code></li>' +
          '<li><strong>Consulta unit├íria (BrasilAPI):</strong> vai para <code>localStorage</code> / CRM ÔåÆ aba Prospec├º├úo unit├íria</li>' +
          '<li><strong>Importar para CRM:</strong> use o bot├úo abaixo para trazer uma amostra como leads locais</li>' +
          '<li><strong>Export Excel:</strong> gera arquivo em <code>data/exports/</code> no servidor e baixa no navegador</li>' +
        '</ul>' +
      '</section>' +
    '</div>' +
    '<section class="l2-card pm-export-card" style="margin-top:1rem">' +
      '<h3>Exportar para Excel</h3>' +
      '<p class="hint">Dispon├¡vel ap├│s a ingest├úo. At├® 250 mil linhas por exporta├º├úo.</p>' +
      '<div class="pm-export-form">' +
        '<select id="pm-export-limite"><option value="5000">5.000 linhas</option><option value="25000">25.000</option><option value="50000" selected>50.000</option><option value="230000">230.000 (completo)</option></select>' +
        '<button type="button" id="pm-export-xlsx" class="btn primary"' + (!backendOk ? ' disabled' : '') + '>Ô¼ç Exportar Excel (.xlsx)</button>' +
        '<button type="button" id="pm-export-sample" class="btn sm">Exportar amostra (100) no browser</button>' +
        '<button type="button" id="pm-import-crm" class="btn sm">Importar 100 para CRM</button>' +
      '</div>' +
      '<p class="hint">Export usa os filtros ICP acima (capital, CNAE, porte, regi├úo).</p>' +
      '<p id="pm-export-status" class="hint"></p>' +
    '</section>' +
    '<section class="l2-card" style="margin-top:1rem">' +
      '<h3>Grupos para investiga├º├úo (raspagem futura)</h3>' +
      '<p class="hint">Salve filtros de empresas para enriquecimento em lote quando a fila de scraping estiver ativa.</p>' +
      '<div class="pm-group-form">' +
        '<input type="text" id="pm-group-name" placeholder="Nome do grupo (ex: Agro SP capital &gt; 5M)">' +
        '<select id="pm-group-uf"><option value="">UF (todas)</option>' +
          ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'].map(function(u){ return '<option>'+u+'</option>'; }).join('') +
        '</select>' +
        '<select id="pm-group-cluster"><option value="">Cluster (todos)</option><option>agro</option><option>industria</option><option>varejo</option></select>' +
        '<button type="button" id="pm-group-save" class="btn sm primary">Salvar grupo</button>' +
      '</div>' +
      '<div id="pm-groups-list"></div>' +
    '</section>' +
    '<section class="l2-card" style="margin-top:1rem">' +
      '<h3>Empresas filtradas (p├│s-ingest├úo)</h3>' +
      '<p class="hint">Atualiza ao aplicar filtros ICP. 100 linhas por p├ígina.</p>' +
      '<div id="pm-sample-table"><p class="hint">CarregandoÔÇª</p></div>' +
      '<div id="pm-sample-pager"></div>' +
    '</section>';

  renderGroupsList(body.querySelector('#pm-groups-list'));

  async function log(msg) {
    const el = body.querySelector('#pm-rf-log');
    if (el) el.textContent = msg;
  }

  async function runIngest(btn) {
    if (state.rfBusy) return;
    state.rfBusy = true;
    if (btn) btn.disabled = true;
    try {
      await log('Iniciando ingest├úo RFÔÇª');
      const skip = body.querySelector('#pm-rf-skip-dl')?.checked;
      const res = await startRfIngest({ skipDownload: skip, modo: 'completo' });
      await log('Job #' + res.job_id + ' ÔÇö aguardando conclus├úoÔÇª');
      await pollJob(res.job_id, function (j) {
        log('Job #' + res.job_id + ' ┬À ' + (j.status || '') + ' ┬À ' + (j.progress || j.message || ''));
      });
      window.AFSToast?.success('Ingest├úo RF conclu├¡da');
      state.rfStatus = await fetchRfStatus();
      const ld = body.querySelector('#pm-loaded');
      if (ld) ld.textContent = (state.rfStatus?.prospectos_carregados ?? 0).toLocaleString('pt-BR');
      await loadProspectTable(body, ctx);
    } catch (e) {
      await log('Erro: ' + (e.message || e));
      window.AFSToast?.error(e.message || 'Falha na ingest├úo');
    } finally {
      state.rfBusy = false;
      if (btn) btn.disabled = false;
    }
  }

  mount.querySelector('#pm-hero-start')?.addEventListener('click', function () {
    runIngest(body.querySelector('#pm-rf-start'));
  });
  body.querySelector('#pm-rf-start')?.addEventListener('click', function () {
    runIngest(this);
  });
  body.querySelector('#pm-rf-refresh')?.addEventListener('click', async function () {
    state.rfStatus = await fetchRfStatus();
    renderProspeccaoMassa(ctx);
  });
  body.querySelector('#pm-group-save')?.addEventListener('click', function () {
    const name = body.querySelector('#pm-group-name')?.value.trim();
    if (!name) { window.AFSToast?.warn('Informe o nome do grupo'); return; }
    saveGroup(name, {
      uf: body.querySelector('#pm-group-uf')?.value || null,
      cluster: body.querySelector('#pm-group-cluster')?.value || null,
    });
    body.querySelector('#pm-group-name').value = '';
    renderGroupsList(body.querySelector('#pm-groups-list'));
    window.AFSToast?.success('Grupo salvo para raspagem futura');
  });

  body.querySelector('#pm-export-xlsx')?.addEventListener('click', async function () {
    const statusEl = body.querySelector('#pm-export-status');
    try {
      if (statusEl) statusEl.textContent = 'Gerando Excel no servidorÔÇª';
      const result = await exportProspectosExcel({
        ...filterParams(),
        limite: Number(body.querySelector('#pm-export-limite')?.value || 50000),
      });
      if (statusEl) statusEl.textContent = 'Exportado: ' + result.total_exportado + ' registros ÔåÆ ' + result.filename;
      window.AFSToast?.success('Excel exportado (' + result.total_exportado + ' linhas)');
    } catch (e) {
      if (statusEl) statusEl.textContent = '';
      window.AFSToast?.error(e.message || 'Falha na exporta├º├úo');
    }
  });

  body.querySelector('#pm-export-sample')?.addEventListener('click', async function () {
    try {
      const data = await fetchProspectos({ ...filterParams(), limite: 100 });
      if (!data.prospectos?.length) {
        window.AFSToast?.warn('Nenhum prospecto ÔÇö rode a ingest├úo primeiro');
        return;
      }
      exportExcel(data.prospectos, PROSPECT_EXPORT_COLS, 'Prospectos LR');
      window.AFSToast?.success('Amostra Excel baixada (100 linhas)');
    } catch (e) {
      window.AFSToast?.error(e.message || 'Erro');
    }
  });

  body.querySelector('#pm-import-crm')?.addEventListener('click', async function () {
    try {
      const data = await fetchProspectos({ ...filterParams(), limite: 100 });
      if (!data.prospectos?.length) {
        window.AFSToast?.warn('Nenhum prospecto na base');
        return;
      }
      const rows = data.prospectos.map(mapProspectoToStore);
      store.bulkUpsert('leads', rows.map(function (r) {
        return { ...r, id: store.uid('lead') };
      }));
      window.AFSToast?.success(rows.length + ' leads importados para CRM (localStorage)');
    } catch (e) {
      window.AFSToast?.error(e.message || 'Erro');
    }
  });

  await loadProspectTable(body, ctx);

  async function loadProspectTable(tabBody, pageCtx) {
    const pageMount = pageCtx.mount;
    const wrap = tabBody.querySelector('#pm-sample-table');
    const pagerWrap = tabBody.querySelector('#pm-sample-pager');
    if (!wrap) return;
    wrap.innerHTML = '<p class="hint">Carregando empresasÔÇª</p>';
    try {
      const data = await fetchProspectos({
        ...filterParams(),
        limite: state.prospectPageSize,
        offset: state.prospectPage * state.prospectPageSize,
      });
      state.filterCount = data.total;
      const countEl = pageMount.querySelector('.pm-filter-count');
      if (countEl) countEl.textContent = (data.total || 0).toLocaleString('pt-BR') + ' empresas';
      if (!data.prospectos?.length) {
        wrap.innerHTML = '<p class="hint">Nenhum prospecto com estes filtros. Ajuste CNAE/capital ou rode a ingest├úo RF.</p>';
        if (pagerWrap) pagerWrap.innerHTML = '';
        return;
      }
      const clsData = await fetchClassificacao();
      wrap.innerHTML =
        '<table class="data-table compact"><thead><tr>' +
          '<th>CNPJ</th><th>Raz├úo social</th><th>UF</th><th>Munic├¡pio</th><th>Capital</th>' +
          '<th>CNAE principal</th><th>Porte</th><th>Cluster</th><th>CNAE AFS</th><th>Score</th>' +
        '</tr></thead><tbody>' +
        data.prospectos.map(function (p) {
          const div = String(p.cnae || '').replace(/\D/g, '').slice(0, 2);
          const cnaeAfs = renderStatusBadge(statusForDivisao(div, clsData));
          return '<tr><td>' + esc(p.cnpj_basico) + '</td><td>' + esc(p.razao_social) + '</td><td>' + esc(p.uf) +
            '</td><td>' + esc(p.municipio) + '</td><td>' + formatCapital(p.capital_social) + '</td>' +
            formatCnaeCell(p.cnae, p.cnae_descricao) +
            '<td>' + esc(p.porte) + '</td><td><span class="pm-tag pm-tag-' + esc(p.cluster || 'outro') + '">' + esc(p.cluster || 'ÔÇö') + '</span></td>' +
            '<td>' + cnaeAfs + '</td><td>' + esc(p.score) + '</td></tr>';
        }).join('') +
        '</tbody></table>';
      if (pagerWrap) {
        pagerWrap.innerHTML = renderPagination('prospect', state.prospectPage, state.prospectPageSize, data.total || 0);
        bindPagination(
          tabBody, 'prospect',
          function () { return state.prospectPage; },
          function (n) { state.prospectPage = n; },
          function () { loadProspectTable(tabBody, pageCtx); },
        );
      }
    } catch (e) {
      wrap.innerHTML = '<p class="hint">Erro ao carregar: ' + esc(e.message || e) + '</p>';
    }
  }
}

function renderGroupsList(el) {
  const groups = groupsList();
  if (!groups.length) {
    el.innerHTML = '<p class="hint">Nenhum grupo salvo ainda.</p>';
    return;
  }
  el.innerHTML = '<ul class="pm-groups">' + groups.map(function (g) {
    return '<li><strong>' + esc(g.nome) + '</strong> ┬À ' + esc(JSON.stringify(g.filtros)) +
      ' <span class="hint">' + esc(g.status) + '</span></li>';
  }).join('') + '</ul>';
}

async function renderTabMapa(body) {
  body.innerHTML =
    '<section class="l2-card">' +
      '<div class="pm-map-toolbar">' +
        '<h3>Mapa do Brasil ┬À empresas filtradas</h3>' +
        '<select id="pm-map-view">' +
          '<option value="heatmap" selected>Mapa de calor (temperatura)</option>' +
          '<option value="points">Pontos por munic├¡pio</option>' +
        '</select>' +
        '<select id="pm-map-metric">' +
          '<option value="volume_lr">Densidade</option>' +
          '<option value="share_pct">Participa├º├úo %</option>' +
        '</select>' +
        '<button type="button" id="pm-map-reload" class="btn sm">Atualizar mapa</button>' +
      '</div>' +
      '<p class="hint" id="pm-map-meta">CarregandoÔÇª</p>' +
      '<div id="pm-map" class="pm-map pm-map-heat"></div>' +
      '<div id="pm-map-mun" class="pm-mun-list"></div>' +
      '<div id="pm-map-agg" class="pm-agg-grid"></div>' +
    '</section>';

  async function loadMap() {
    const view = body.querySelector('#pm-map-view')?.value || 'heatmap';
    const metric = body.querySelector('#pm-map-metric')?.value || 'volume_lr';
    const data = await fetchMapaProspectos({ limite: 10000, ...filterParams() });
    body.querySelector('#pm-map-meta').textContent =
      (data.total_empresas || 0).toLocaleString('pt-BR') + ' empresas ┬À fonte: ' + (data.fonte || 'ÔÇö') +
      ' ┬À capital R$ ' + (state.filters.capitalMin / 1e6).toFixed(0) + 'ÔÇô' + (state.filters.capitalMax / 1e6).toFixed(0) + ' mi';

    if (state.mapInstance) destroyMap(state.mapInstance);

    if (view === 'heatmap') {
      state.mapInstance = await mountBrazilMap(body.querySelector('#pm-map'), {
        mode: 'heatmap',
        preset: metric,
        aggregado: data.aggregado_uf || [],
        zoom: state.filters.uf ? 6 : 4,
      });
    } else {
      state.mapInstance = await mountBrazilMap(body.querySelector('#pm-map'), {
        mode: 'points',
        points: data.pontos || [],
        pointStyle: 'empresa',
        zoom: state.filters.uf ? 6 : 4,
      });
    }
    scheduleMapResize(state.mapInstance);

    const mun = data.aggregado_municipio || [];
    body.querySelector('#pm-map-mun').innerHTML = mun.length
      ? '<h4>Top munic├¡pios</h4><ul class="pm-mun-ul">' + mun.slice(0, 12).map(function (m) {
          return '<li><strong>' + esc(m.municipio) + '</strong> (' + m.uf + ') ÔÇö ' + m.total + ' empresas ┬À cap. m├®dio ' + formatCapital(m.capital_medio) + '</li>';
        }).join('') + '</ul>'
      : '';

    const agg = data.aggregado_uf || [];
    body.querySelector('#pm-map-agg').innerHTML = agg.slice(0, 12).map(function (a) {
      return '<div class="pm-agg-card"><span>' + a.uf + '</span><strong>' + a.total.toLocaleString('pt-BR') + '</strong><small>' + a.pct + '%</small></div>';
    }).join('');
  }

  body.querySelector('#pm-map-reload')?.addEventListener('click', loadMap);
  body.querySelector('#pm-map-view')?.addEventListener('change', loadMap);
  body.querySelector('#pm-map-metric')?.addEventListener('change', loadMap);
  await loadMap();
}

async function renderTabAuditorias(body) {
  body.innerHTML = '<p class="hint">Carregando intelig├¬ncia de auditoriasÔÇª</p>';
  const uf = state.auditUf;
  const data = await fetchAuditorias({ uf: uf || undefined });
  body.innerHTML =
    '<section class="l2-card">' +
      '<div class="pm-map-toolbar">' +
        '<h3>Concorrentes ┬À Bancas de auditoria (Brasil)</h3>' +
        '<select id="pm-audit-uf"><option value="">Todas UFs</option>' +
          ['SP','RJ','MG','RS','PR','SC','BA','PE','GO','DF'].map(function(u){ return '<option'+(uf===u?' selected':'')+'>'+u+'</option>'; }).join('') +
        '</select>' +
      '</div>' +
      '<p class="hint">' + esc(data.nota_ia || '') + '</p>' +
      '<p class="hint">' + (data.total || 0) + ' bancas mapeadas (exclui Big Four + top 10 globais)</p>' +
      '<div id="pm-audit-map" class="pm-map pm-map-sm"></div>' +
      '<table class="data-table compact" style="margin-top:1rem"><thead><tr>' +
        '<th>Banca</th><th>UF sede</th><th>Tier</th><th>Faturamento est.</th><th>Raio atua├º├úo</th><th>Filiais</th><th>Raspagem</th>' +
      '</tr></thead><tbody id="pm-audit-rows"></tbody></table>' +
    '</section>';

  const rows = body.querySelector('#pm-audit-rows');
  rows.innerHTML = (data.firmas || []).slice(0, 80).map(function (f) {
    const fat = f.faturamento_estimado_m;
    return '<tr><td><strong>' + esc(f.nome) + '</strong><br><small class="hint">' + esc(f.rede) + '</small></td>' +
      '<td>' + esc(f.uf) + '</td><td>' + esc(f.tier) + '</td>' +
      '<td>R$ ' + (fat?.min || '?') + 'ÔÇô' + (fat?.max || '?') + ' mi</td>' +
      '<td>' + (f.raio_atuacao_km || 'ÔÇö') + ' km</td>' +
      '<td>' + (f.filiais?.length || 0) + '</td>' +
      '<td><span class="pm-tag">' + esc(f.scraping_status) + '</span></td></tr>';
  }).join('');

  const circles = (data.firmas || []).map(function (f) {
    return {
      lat: f.sede?.lat,
      lng: f.sede?.lng,
      raio_km: f.raio_atuacao_km,
      color: '#60a5fa',
      label: '<strong>' + esc(f.nome) + '</strong><br>Raio ~' + f.raio_atuacao_km + ' km',
    };
  }).filter(function (c) { return c.lat && c.lng; });

  if (state.mapInstance) destroyMap(state.mapInstance);
  state.mapInstance = await mountBrazilMap(body.querySelector('#pm-audit-map'), {
    circles: circles.slice(0, 40),
    zoom: 4,
  });
  scheduleMapResize(state.mapInstance);

  body.querySelector('#pm-audit-uf')?.addEventListener('change', function () {
    state.auditUf = this.value;
    renderTabAuditorias(body);
  });
}

async function renderTabPatrimonial(body) {
  body.innerHTML = '<p class="hint">Carregando prestadores patrimoniaisÔÇª</p>';
  const data = await fetchPatrimonial({ uf: state.patUf || undefined });
  body.innerHTML =
    '<section class="l2-card">' +
      '<div class="pm-map-toolbar">' +
        '<h3>Prestadores de controle patrimonial</h3>' +
        '<select id="pm-pat-uf"><option value="">Todas UFs</option>' +
          ['SP','RJ','MG','RS','PR','SC','BA','PE','GO','DF','MT','MS'].map(function(u){
            return '<option' + (state.patUf === u ? ' selected' : '') + '>' + u + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +
      '<p class="hint">' + esc(data.nota_ia || '') + '</p>' +
      '<p class="hint">CNAEs-alvo: ' + (data.cnaes_alvo || []).map(function(c){ return c.codigo || c; }).join(', ') + '</p>' +
      '<div id="pm-pat-map" class="pm-map pm-map-sm"></div>' +
      '<table class="data-table compact" style="margin-top:1rem"><thead><tr>' +
        '<th>Empresa</th><th>UF</th><th>Servi├ºo</th><th>Tier</th><th>Status dados</th></tr></thead><tbody>' +
      (data.prestadores || []).map(function (p) {
        return '<tr><td><strong>' + esc(p.nome) + '</strong></td><td>' + esc(p.uf) + '</td>' +
          '<td>' + esc(p.tipo_servico) + '</td><td>' + esc(p.tier) + '</td>' +
          '<td><span class="pm-tag">' + esc(p.scraping_status) + '</span></td></tr>';
      }).join('') +
      '</tbody></table>' +
    '</section>';

  if (state.mapInstance) destroyMap(state.mapInstance);
  state.mapInstance = await mountBrazilMap(body.querySelector('#pm-pat-map'), {
    points: data.pontos_mapa || [],
    pointStyle: 'patrimonial',
    zoom: 4,
  });
  scheduleMapResize(state.mapInstance);

  body.querySelector('#pm-pat-uf')?.addEventListener('change', function () {
    state.patUf = this.value;
    renderTabPatrimonial(body);
  });
}

async function renderTabCnaes(body, ctx) {
  body.innerHTML = '<p class="hint">Carregando correla├º├úo CNAEÔÇª</p>';
  const clsData = await fetchClassificacao();
  const data = await fetchCnaeSetores({
    q: state.cnaeQ,
    secao: state.cnaeSecao,
    classificacao: state.cnaeClassFilter,
    limite: state.cnaePageSize,
    offset: state.cnaePage * state.cnaePageSize,
  });
  const secoes = data.secoes || [];
  const totQ = clsData.totais?.quente ?? Object.keys(clsData.quente || {}).length;
  const totF = clsData.totais?.frio ?? Object.keys(clsData.frio || {}).length;
  body.innerHTML =
    '<section class="l2-card">' +
      '<h3>CNAE ├ù Setores produtivos ┬À Cluster AFS</h3>' +
      '<p class="hint">' + (data.meta?.descricao || '') + ' ┬À Marque divis├Áes <strong>quentes</strong> (prioridade) ou <strong>frias</strong> (blacklist). Neutros = banco de hip├│teses.</p>' +
      '<div class="pm-cnae-stats">' +
        '<span class="pm-tag pm-tag-quente">' + totQ + ' quentes</span>' +
        '<span class="pm-tag pm-tag-neutro">' + Math.max(0, (data.total || 87) - totQ - totF) + '+ neutros</span>' +
        '<span class="pm-tag pm-tag-frio">' + totF + ' frios</span>' +
      '</div>' +
      '<div class="pm-cnae-filters">' +
        '<input type="search" id="pm-cnae-q" placeholder="Buscar c├│digo ou setorÔÇª" value="' + esc(state.cnaeQ) + '">' +
        '<select id="pm-cnae-secao"><option value="">Todas se├º├Áes</option>' +
          secoes.map(function (s) {
            return '<option value="' + s.codigo + '"' + (state.cnaeSecao === s.codigo ? ' selected' : '') + '>' +
              s.codigo + ' ÔÇö ' + esc(s.nome).slice(0, 48) + '</option>';
          }).join('') +
        '</select>' +
        '<select id="pm-cnae-class"><option value="">Todas classifica├º├Áes</option>' +
          '<option value="quente"' + (state.cnaeClassFilter === 'quente' ? ' selected' : '') + '>Quentes</option>' +
          '<option value="neutro"' + (state.cnaeClassFilter === 'neutro' ? ' selected' : '') + '>Neutros</option>' +
          '<option value="frio"' + (state.cnaeClassFilter === 'frio' ? ' selected' : '') + '>Frios</option>' +
        '</select>' +
        '<button type="button" id="pm-cnae-search" class="btn sm primary">Filtrar</button>' +
      '</div>' +
      '<table class="data-table compact" style="margin-top:1rem"><thead><tr>' +
        '<th>C├│digo</th><th>Divis├úo CNAE</th><th>Se├º├úo</th><th>Setor</th><th>Cluster</th><th>Classifica├º├úo AFS</th><th>A├º├Áes</th>' +
      '</tr></thead><tbody>' +
      (data.divisoes || []).map(function (d) {
        const st = d.classificacao_afs || statusForDivisao(d.codigo, clsData);
        return '<tr data-cnae-div="' + esc(d.codigo) + '">' +
          '<td><code>' + esc(d.codigo) + '</code></td><td>' + esc(d.divisao) + '</td>' +
          '<td>' + esc(d.secao) + '</td><td>' + esc(d.setor_produtivo) + '</td>' +
          '<td><span class="pm-tag pm-tag-' + esc(d.cluster_afs) + '">' + esc(d.cluster_afs) + '</span></td>' +
          '<td>' + renderStatusBadge(st) + '</td>' +
          '<td class="pm-cnae-actions">' +
            '<button type="button" class="btn xs" data-cnae-act="quente" title="Marcar quente">­ƒöÑ</button>' +
            '<button type="button" class="btn xs" data-cnae-act="neutro" title="Neutro">Ôù»</button>' +
            '<button type="button" class="btn xs" data-cnae-act="frio" title="Blacklist">ÔØä</button>' +
            '<button type="button" class="btn xs primary" data-cnae-act="empresas">Ver empresas</button>' +
          '</td></tr>';
      }).join('') +
      '</tbody></table>' +
      '<div id="pm-cnae-pager"></div>' +
    '</section>';

  body.querySelector('#pm-cnae-pager').innerHTML = renderPagination(
    'cnae', state.cnaePage, state.cnaePageSize, data.total || 0,
  );
  bindPagination(
    body, 'cnae',
    function () { return state.cnaePage; },
    function (n) { state.cnaePage = n; },
    function () { renderTabCnaes(body, ctx); },
  );

  function applyCnaeFilters() {
    state.cnaeQ = body.querySelector('#pm-cnae-q')?.value.trim() || '';
    state.cnaeSecao = body.querySelector('#pm-cnae-secao')?.value || '';
    state.cnaeClassFilter = body.querySelector('#pm-cnae-class')?.value || '';
    state.cnaePage = 0;
    renderTabCnaes(body, ctx);
  }

  body.querySelector('#pm-cnae-search')?.addEventListener('click', applyCnaeFilters);
  body.querySelector('#pm-cnae-q')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') applyCnaeFilters();
  });

  body.querySelector('tbody')?.addEventListener('click', async function (e) {
    const btn = e.target.closest('[data-cnae-act]');
    if (!btn) return;
    const row = btn.closest('tr');
    const codigo = row?.getAttribute('data-cnae-div');
    const act = btn.getAttribute('data-cnae-act');
    if (act === 'empresas') {
      state.filters = { ...state.filters, cnae: codigo };
      state.prospectPage = 0;
      navigateTab('massa');
      renderProspeccaoMassa(ctx);
      return;
    }
    await setDivisaoStatus(codigo, act, '');
    window.AFSToast?.success('CNAE ' + codigo + ' ÔåÆ ' + act);
    renderTabCnaes(body, ctx);
  });
}

async function renderTabColdmail(body) {
  body.innerHTML = '<p class="hint">Calculando car├¬ncia regional e prioridade de cold mailÔÇª</p>';
  const data = await fetchCarencia();
  body.innerHTML =
    '<section class="l2-card">' +
      '<h3>Prioriza├º├úo cold mail</h3>' +
      '<p class="hint">' + esc(data.metodologia || '') + '</p>' +
      '<div class="pm-cold-top">' +
        '<h4>Top 5 regi├Áes</h4><ol>' +
        (data.top5_cold_mail || []).map(function (r) {
          return '<li><strong>' + r.uf + '</strong> ÔÇö score ' + r.score_prioridade_cold_mail +
            ' ┬À ' + r.empresas_lr.toLocaleString('pt-BR') + ' LR ┬À car├¬ncia patrimonial ' + r.carencia_patrimonial_pct + '%</li>';
        }).join('') +
        '</ol></div>' +
      '<div class="pm-map-toolbar">' +
        '<select id="pm-cold-metric">' +
          '<option value="coldmail">Prioridade cold mail</option>' +
          '<option value="carencia">Car├¬ncia patrimonial</option>' +
        '</select>' +
      '</div>' +
      '<div id="pm-cold-map" class="pm-map pm-map-heat pm-map-sm"></div>' +
      '<table class="data-table compact" style="margin-top:1rem"><thead><tr>' +
        '<th>UF</th><th>Empresas LR</th><th>Auditorias</th><th>Prest. patrimonial</th>' +
        '<th>Cobertura audit.</th><th>Car├¬ncia patrim.</th><th>Score cold mail</th></tr></thead><tbody>' +
      (data.regioes || []).map(function (r) {
        return '<tr><td><strong>' + r.uf + '</strong></td>' +
          '<td>' + r.empresas_lr.toLocaleString('pt-BR') + '</td>' +
          '<td>' + r.auditorias + '</td><td>' + r.prestadores_patrimonial + '</td>' +
          '<td>' + r.cobertura_auditoria_pct + '%</td>' +
          '<td>' + r.carencia_patrimonial_pct + '%</td>' +
          '<td><strong>' + r.score_prioridade_cold_mail + '</strong></td></tr>';
      }).join('') +
      '</tbody></table>' +
      '<p class="hint" style="margin-top:0.75rem">Otimiza├º├úo futura: cruzar empresas selecionadas ├ù cobertura de auditorias ├ù car├¬ncia de servi├ºos patrimoniais.</p>' +
    '</section>';

  const metric = body.querySelector('#pm-cold-metric')?.value || 'coldmail';
  if (state.mapInstance) destroyMap(state.mapInstance);
  state.mapInstance = await mountBrazilMap(body.querySelector('#pm-cold-map'), {
    mode: 'heatmap',
    preset: metric,
    aggregado: data.regioes || [],
    zoom: 4,
  });
  scheduleMapResize(state.mapInstance);

  body.querySelector('#pm-cold-metric')?.addEventListener('change', async function () {
    if (state.mapInstance) destroyMap(state.mapInstance);
    state.mapInstance = await mountBrazilMap(body.querySelector('#pm-cold-map'), {
      mode: 'heatmap',
      preset: this.value,
      aggregado: data.regioes || [],
      zoom: 4,
    });
    scheduleMapResize(state.mapInstance);
  });
}
