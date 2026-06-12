/**
 * AFS Market Intelligence — SPA controller (vanilla ES module, sem imports estáticos).
 */
(function () {
  'use strict';

  const API = () => window.AFSMarketAPI;
  const Toast = () => window.AFSToast;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const TITLES = {
    dashboard: 'Dashboard',
    pipeline: 'Pipeline de Dados',
    leads: 'Leads ICP',
    deadzone: 'Dead Zone',
    transicao: 'Transição de Regime',
    parceiros: 'Parceiros B2B2B',
    funil: 'Funil Comercial',
    export: 'Exportar Dados',
    configuracoes: 'Configurações',
  };

  const KANBAN_COLS = [
    { id: 'prospectado', label: 'Prospectado' },
    { id: 'contato_feito', label: 'Contato Feito' },
    { id: 'proposta_enviada', label: 'Proposta Enviada' },
    { id: 'negociacao', label: 'Negociação' },
    { id: 'fechado', label: 'Fechado ✅' },
    { id: 'perdido', label: 'Perdido ❌' },
  ];

  const PIPELINE_STEPS = [
    { id: 'ingestao_rf', label: 'Ingestão RF' },
    { id: 'icp_cluster', label: 'ICP & Cluster' },
    { id: 'enriquecimento', label: 'Enriquecimento' },
    { id: 'validacao_email', label: 'Validação E-mail' },
    { id: 'monitor_regime', label: 'Monitor Regime' },
  ];

  const REGIME_LABELS = { SN: 'Simples Nacional', LP: 'Lucro Presumido', LR: 'Lucro Real' };

  let authMod = null;
  let activeTab = 'dashboard';
  let leadsPage = 1;
  const PAGE_SIZE = 25;
  let leadsCache = [];
  let filteredLeads = [];
  let deadZoneCache = [];
  let currentDrawerLead = null;
  let unsubLeads = null;
  let unsubConfig = null;
  let searchTimer = null;
  let reconnectAttempts = 0;
  let browserOnline = navigator.onLine;

  const ALLOWED_EMAILS = ['cartoonhq@gmail.com', 'gabrieldouran@gmail.com'];

  function perfil() {
    return $('#perfil')?.value || 'patrimonial';
  }

  function fmtMoney(v) {
    if (!v) return '—';
    return 'R$ ' + Number(v).toLocaleString('pt-BR');
  }

  function fmtPct(n) {
    const sign = n >= 0 ? '+' : '';
    return sign + n.toFixed(1) + '%';
  }

  function portalSignInUrl() {
    const base = window.__AFS_BASE_PATH__ || '';
    const ret = encodeURIComponent(window.location.pathname + window.location.search);
    return base + '/sign-in/?redirect=' + ret;
  }

  function portalHomeUrl() {
    return (window.__AFS_BASE_PATH__ || '') + '/dashboard/';
  }

  function showTableSkeleton(id, rows) {
    const el = $('#' + id);
    if (!el) return;
    el.classList.remove('hidden');
    el.innerHTML = Array(rows || 5).fill('<div class="skeleton-row"></div>').join('');
  }

  function hideTableSkeleton(id) {
    const el = $('#' + id);
    if (el) el.classList.add('hidden');
  }

  function computeFunilMetrics(leads) {
    const p = perfil();
    const list = leads.filter(function (l) {
      return !l.perfil_icp || l.perfil_icp === p || p === 'generico';
    });
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const countInMonth = function (arr, start, end) {
      return arr.filter(function (l) {
        const ts = l.criado_em && l.criado_em.toDate ? l.criado_em.toDate() : null;
        return ts && ts >= start && ts < end;
      }).length;
    };
    const prospectados = list.filter(function (l) { return l.status_funil === 'prospectado'; }).length;
    const fechados = list.filter(function (l) { return l.status_funil === 'fechado'; }).length;
    const regimeCounts = { SN: 0, LP: 0, LR: 0 };
    list.forEach(function (l) {
      if (regimeCounts[l.regime_tributario] !== undefined) regimeCounts[l.regime_tributario]++;
    });
    const thisMonth = countInMonth(list, monthStart, now);
    const lastMonth = countInMonth(list, prevStart, monthStart);
    return {
      universo_icp: list.length,
      enriquecidos: list.filter(function (l) { return l.email; }).length,
      emails_validados: list.filter(function (l) { return l.email && l.email.includes('@'); }).length,
      dead_zone: list.filter(function (l) { return l.status_funil === 'dead_zone'; }).length,
      transicao_regime: list.filter(function (l) { return l.transicao_regime; }).length,
      taxa_conversao: prospectados ? (fechados / prospectados) * 100 : 0,
      pct_change: lastMonth ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0,
      regime_counts: regimeCounts,
    };
  }

  function updateOnlineBadge(firestoreOnline) {
    const online = browserOnline && firestoreOnline !== false;
    const dot = $('#status-dot');
    dot.classList.toggle('offline', !online);
    dot.classList.toggle('pulse', !online);
    if (online) {
      reconnectAttempts = 0;
      $('#status-text').textContent = '● Online';
    } else {
      reconnectAttempts++;
      $('#status-text').textContent = '● Offline — tentando reconectar... (' + reconnectAttempts + ')';
    }
  }

  function esc(s) {
    if (s == null) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  async function getAuthMod() {
    if (!authMod) {
      authMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');
    }
    return authMod;
  }

  function waitForAPI(maxMs) {
    return new Promise(function (resolve) {
      if (window.AFSMarketAPI) return resolve(window.AFSMarketAPI);
      const start = Date.now();
      const t = setInterval(function () {
        if (window.AFSMarketAPI) { clearInterval(t); resolve(window.AFSMarketAPI); }
        else if (Date.now() - start > (maxMs || 8000)) { clearInterval(t); resolve(null); }
      }, 50);
    });
  }

  function waitForFB() {
    return new Promise(function (resolve) {
      if (window.AFS_FB?.auth) return resolve(window.AFS_FB.auth);
      const start = Date.now();
      const t = setInterval(function () {
        if (window.AFS_FB?.auth) { clearInterval(t); resolve(window.AFS_FB.auth); }
        else if (Date.now() - start > 8000) { clearInterval(t); resolve(null); }
      }, 50);
    });
  }

  /* ── Auth ── */

  async function initAuth() {
    const auth = await waitForFB();
    if (!auth) return;
    const { onAuthStateChanged, signInWithEmailAndPassword, signOut } = await getAuthMod();

    window.AFSAuth = {
      signIn: function (email, password) {
        return signInWithEmailAndPassword(auth, email, password);
      },
      signOut: function () {
        return signOut(auth);
      },
      currentUser: function () { return auth.currentUser; },
    };

    onAuthStateChanged(auth, function (user) {
      if (user && ALLOWED_EMAILS.includes((user.email || '').toLowerCase())) {
        $('#afs-login').classList.add('hidden');
        $('#afs-app').classList.remove('hidden');
        bootstrapApp();
      } else if (user) {
        signOut(auth).then(function () {
          Toast()?.error('Acesso restrito a usuários autorizados.');
          window.location.href = portalHomeUrl();
        });
      } else {
        teardownApp();
        $('#login-status').textContent = 'Redirecionando para o login do portal…';
        window.location.replace(portalSignInUrl());
      }
    });
  }

  function teardownApp() {
    if (unsubLeads) { unsubLeads(); unsubLeads = null; }
    if (unsubConfig) { unsubConfig(); unsubConfig = null; }
  }

  async function bootstrapApp() {
    await waitForAPI();
    renderPipelineSteps();
    buildKanbanBoard();
    loadScoringConfig();
    reloadActiveTab();
    startSubscriptions();
  }

  function startSubscriptions() {
    const api = API();
    if (!api) return;
    if (unsubLeads) unsubLeads();
    unsubLeads = api.subscribeLeads(function (leads) {
      leadsCache = leads;
      const funil = computeFunilMetrics(leads);
      if (activeTab === 'dashboard') {
        renderMetrics(funil, funil.pct_change);
        renderRegimeBars(funil.regime_counts);
        renderDashboardFromLeads(leads);
      }
      if (activeTab === 'funil') {
        renderKanban(leads);
        renderFunnelMetrics(funil, leads);
      }
    });
    if (unsubConfig) unsubConfig();
    unsubConfig = api.subscribeConfigStatus(function (cfg) {
      updateOnlineBadge(cfg.online);
    });
    window.addEventListener('online', function () { browserOnline = true; updateOnlineBadge(true); });
    window.addEventListener('offline', function () { browserOnline = false; updateOnlineBadge(false); });
    updateOnlineBadge(true);
  }

  /* ── Tabs ── */

  function switchTab(tab) {
    activeTab = tab;
    $$('.nav-item').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
    $$('.tab-panel').forEach(function (p) { p.classList.toggle('active', p.id === 'tab-' + tab); });
    $('#page-title').textContent = TITLES[tab] || tab;
    if (window.innerWidth <= 768) $('#sidebar').classList.remove('open');
    reloadActiveTab();
  }

  function reloadActiveTab() {
    const loaders = {
      dashboard: loadDashboard,
      pipeline: loadPipelineConfig,
      leads: loadLeads,
      deadzone: loadDeadZone,
      transicao: loadTransicao,
      parceiros: loadParceiros,
      funil: loadFunil,
      export: function () {},
      configuracoes: loadScoringConfig,
    };
    if (loaders[activeTab]) loaders[activeTab]();
  }

  /* ── Dashboard ── */

  async function loadDashboard() {
    try {
      const data = await API().get('/status?perfil=' + perfil());
      renderMetrics(data.funil || {}, data.funil?.pct_change || 0);
      renderRegimeBars(data.funil?.regime_counts || {});
    } catch (e) {
      Toast()?.error('Erro ao carregar dashboard');
    }
    if (leadsCache.length) renderDashboardFromLeads(leadsCache);
    else API().subscribeLeads && API().get('/leads?perfil=' + perfil() + '&limite=500').then(function (d) {
      renderDashboardFromLeads(d.leads || []);
    });
  }

  function renderMetrics(funil, pctChange) {
    const icons = ['📊', '✉', '✓', '⛔', '🔥', '📈'];
    const items = [
      { label: 'Total de Leads na Base', value: funil.universo_icp || 0, change: pctChange },
      { label: 'Leads Enriquecidos', value: funil.enriquecidos || 0, change: null },
      { label: 'E-mails Validados', value: funil.emails_validados || 0, change: null },
      { label: 'Em Dead Zone', value: funil.dead_zone || 0, change: null },
      { label: 'Em Transição de Regime', value: funil.transicao_regime || 0, change: null },
      { label: 'Taxa de Conversão do Funil', value: (funil.taxa_conversao || 0).toFixed(1) + '%', change: null, raw: true },
    ];
    $('#metrics-grid').innerHTML = items.map(function (i, idx) {
      const ch = i.change != null
        ? '<div class="change ' + (i.change >= 0 ? 'up' : 'down') + '">' + fmtPct(i.change) + ' vs mês ant.</div>'
        : '';
      const val = i.raw ? i.value : Number(i.value).toLocaleString('pt-BR');
      return '<div class="metric-card"><div class="metric-icon">' + icons[idx] + '</div><div class="value">' + val + '</div><div class="label">' + esc(i.label) + '</div>' + ch + '</div>';
    }).join('');
  }

  function renderRegimeBars(counts) {
    const total = (counts.SN || 0) + (counts.LP || 0) + (counts.LR || 0) || 1;
    const rows = [
      { key: 'SN', label: 'Simples Nacional' },
      { key: 'LP', label: 'Lucro Presumido' },
      { key: 'LR', label: 'Lucro Real' },
    ];
    $('#regime-bars').innerHTML = rows.map(function (r) {
      const n = counts[r.key] || 0;
      const pct = Math.round((n / total) * 100);
      return '<div class="regime-bar"><span style="min-width:110px">' + r.label + '</span>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="bar-val">' + n + '</span></div>';
    }).join('');
  }

  function renderDashboardFromLeads(leads) {
    const p = perfil();
    const filtered = leads.filter(function (l) {
      return !l.perfil_icp || l.perfil_icp === p || p === 'generico';
    });

    const cnaeMap = {};
    filtered.forEach(function (l) {
      const k = l.cnae_codigo || l.cnae_descricao || 'Outros';
      cnaeMap[k] = (cnaeMap[k] || 0) + 1;
    });
    const topCnaes = Object.entries(cnaeMap).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
    $('#top-cnaes').innerHTML = topCnaes.length
      ? topCnaes.map(function (e) { return '<li><span>' + esc(e[0]) + '</span><strong>' + e[1] + '</strong></li>'; }).join('')
      : '<li><span>Nenhum dado</span></li>';

    const opps = filtered
      .filter(function (l) { return l.status_funil === 'prospectado'; })
      .sort(function (a, b) { return (b.score || 0) - (a.score || 0); })
      .slice(0, 5);

    $('#oportunidades-dia').innerHTML = opps.length
      ? opps.map(function (l) {
        return '<div class="oportunidade-item"><div><strong>' + esc(l.razao_social) + '</strong>' +
          '<br><span class="hint">' + esc(l.cluster || l.cnae_descricao) + ' · Score ' + (l.score || 0).toFixed(1) + '</span></div>' +
          '<button class="btn primary btn-abordagem" data-id="' + esc(l.id) + '">Iniciar Abordagem</button></div>';
      }).join('')
      : '<p class="hint">Nenhuma oportunidade destacada hoje.</p>';

    $$('.btn-abordagem').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        iniciarAbordagem(btn.dataset.id);
      });
    });
  }

  async function iniciarAbordagem(id) {
    try {
      await API().updateLead(id, { status_funil: 'contato_feito' });
      await API().post('/feedback', { lead_id: id, outcome: 'positivo', motivo: 'Abordagem iniciada' });
      Toast()?.success('Abordagem iniciada');
      API().invalidateCache();
      reloadActiveTab();
    } catch (e) {
      Toast()?.error('Erro ao iniciar abordagem');
    }
  }

  /* ── Pipeline ── */

  function renderPipelineSteps(steps) {
    const state = steps || PIPELINE_STEPS.map(function (s) { return { id: s.id, status: 'pending' }; });
    $('#pipeline-steps').innerHTML = PIPELINE_STEPS.map(function (s, i) {
      const st = (state[i] && state[i].status) || 'pending';
      const icon = st === 'running' ? '⏳' : st === 'done' ? '✓' : '○';
      return '<div class="pipeline-step ' + st + '"><div class="step-icon">' + icon + '</div><div>' + s.label + '</div></div>';
    }).join('');
  }

  async function loadPipelineConfig() {
    try {
      const data = await API().get('/config/pipeline');
      if (data.config) {
        if (data.config.perfil) $('#pipe-perfil').value = data.config.perfil;
        if (data.config.limite) $('#pipe-limite').value = data.config.limite;
        if (data.config.pular_ingestao != null) $('#pipe-pular-ingestao').checked = data.config.pular_ingestao;
      }
      if (data.steps) renderPipelineSteps(data.steps);
    } catch (e) { /* config may not exist yet */ }
  }

  async function runPipeline(etapa) {
    const log = $('#pipeline-log');
    log.textContent = 'Executando' + (etapa ? ': ' + etapa : ' pipeline completo') + '...\n';
    const body = {
      perfil: $('#pipe-perfil').value || perfil(),
      pular_ingestao: $('#pipe-pular-ingestao').checked,
      limite: parseInt($('#pipe-limite').value, 10) || 500,
    };
    if (etapa) body.etapa = etapa;
    try {
      const result = await API().post('/pipeline/run', body);
      log.textContent += JSON.stringify(result, null, 2);
      if (result.steps) renderPipelineSteps(result.steps);
      Toast()?.success('Pipeline executado');
      reloadActiveTab();
    } catch (e) {
      log.textContent += '\nErro: ' + e.message;
      Toast()?.error('Falha no pipeline');
    }
  }

  async function savePipelineConfig() {
    const body = {
      perfil: $('#pipe-perfil').value,
      limite: parseInt($('#pipe-limite').value, 10),
      pular_ingestao: $('#pipe-pular-ingestao').checked,
    };
    try {
      await API().post('/pipeline/save', body);
      Toast()?.success('Configuração salva');
    } catch (e) {
      Toast()?.error('Erro ao salvar config');
    }
  }

  /* ── Leads ── */

  function buildLeadsQuery() {
    const q = { perfil: perfil(), limite: 5000 };
    const uf = $('#filter-uf').value;
    const regime = $('#filter-regime').value;
    const porte = $('#filter-porte').value;
    if (uf && uf !== 'Todos') q.uf = uf;
    if (regime && regime !== 'Todos') q.regime = regime;
    if (porte && porte !== 'Todos') q.porte = porte;
    const smin = $('#filter-score-min').value;
    if (smin) q.score_min = smin;
    const cmin = $('#filter-capital-min').value;
    if (cmin) q.capital_min = cmin;
    const cmax = $('#filter-capital-max').value;
    if (cmax) q.capital_max = cmax;
    if ($('#filter-transicao').checked) q.transicao = 'true';
    if ($('#filter-email').checked) q.email_validado = 'true';
    if ($('#filter-situacao-ativa')?.checked) q.situacao_ativa = 'true';
    const cnae = $('#filter-cnae')?.value;
    if (cnae && cnae !== 'Todos') q.cnae = cnae;
    const fq = $('#filter-q')?.value?.trim();
    if (fq) q.q = fq;
    return q;
  }

  function populateCnaeFilter(leads) {
    const sel = $('#filter-cnae');
    if (!sel) return;
    const current = sel.value;
    const cnaes = [...new Set(leads.map(function (l) {
      return l.cnae_codigo ? l.cnae_codigo + ' — ' + (l.cnae_descricao || '') : l.cnae_descricao;
    }).filter(Boolean))].sort();
    sel.innerHTML = '<option value="Todos">Todos</option>' +
      cnaes.map(function (c) { return '<option value="' + esc(c.split(' — ')[0]) + '">' + esc(c) + '</option>'; }).join('');
    if ([...sel.options].some(function (o) { return o.value === current; })) sel.value = current;
  }

  function clearLeadsFilters() {
    $('#filter-q').value = '';
    $('#filter-uf').value = 'Todos';
    $('#filter-regime').value = 'Todos';
    $('#filter-porte').value = 'Todos';
    $('#filter-score-min').value = '';
    $('#filter-capital-min').value = '';
    $('#filter-capital-max').value = '';
    $('#filter-cnae').value = 'Todos';
    $('#filter-transicao').checked = false;
    $('#filter-email').checked = false;
    $('#filter-situacao-ativa').checked = true;
    loadLeads();
  }

  async function loadLeads() {
    $('#leads-skeleton').classList.remove('hidden');
    $('#leads-table').classList.add('hidden');
    try {
      const data = await API().get('/leads?' + new URLSearchParams(buildLeadsQuery()).toString());
      filteredLeads = data.leads || [];
      populateUfFilter(filteredLeads);
      populateCnaeFilter(filteredLeads);
      leadsPage = 1;
      renderLeadsPage();
    } catch (e) {
      Toast()?.error('Erro ao carregar leads');
    } finally {
      $('#leads-skeleton').classList.add('hidden');
      $('#leads-table').classList.remove('hidden');
    }
  }

  function populateUfFilter(leads) {
    const sel = $('#filter-uf');
    const current = sel.value;
    const ufs = [...new Set(leads.map(function (l) { return l.uf; }).filter(Boolean))].sort();
    sel.innerHTML = '<option value="Todos">Todos</option>' +
      ufs.map(function (u) { return '<option value="' + esc(u) + '">' + esc(u) + '</option>'; }).join('');
    if (ufs.includes(current)) sel.value = current;
  }

  function renderLeadsPage() {
    const total = filteredLeads.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (leadsPage > pages) leadsPage = pages;
    const start = (leadsPage - 1) * PAGE_SIZE;
    const slice = filteredLeads.slice(start, start + PAGE_SIZE);

    $('#leads-table tbody').innerHTML = slice.map(function (l) {
      return '<tr data-id="' + esc(l.id) + '">' +
        '<td>' + esc(l.cnpj_basico) + '</td>' +
        '<td>' + esc(l.razao_social) + '</td>' +
        '<td>' + esc(l.cnae_codigo || l.cnae_descricao) + '</td>' +
        '<td>' + esc(REGIME_LABELS[l.regime_tributario] || l.regime_tributario || '—') + '</td>' +
        '<td>' + esc(l.porte_empresa || '—') + '</td>' +
        '<td>' + fmtMoney(l.capital_social) + '</td>' +
        '<td>' + fmtMoney(l.receita_anual_estimada) + '</td>' +
        '<td>' + esc(l.uf) + '</td>' +
        '<td>' + (l.qtd_filiais || 0) + '</td>' +
        '<td>' + (l.score || 0).toFixed(1) + '</td>' +
        '<td>' + esc(l.telefone || '—') + '</td>' +
        '<td>' + esc(l.email || '—') + '</td>' +
        '<td>' + esc(l.status_funil || '—') + '</td>' +
        '<td><div class="action-icons">' +
        '<button title="Ver detalhes" data-action="view" data-id="' + esc(l.id) + '">👁</button>' +
        '<button title="Adicionar ao funil" data-action="funil" data-id="' + esc(l.id) + '">➕</button>' +
        '<button title="Marcar contatado" data-action="contato" data-id="' + esc(l.id) + '">✓</button>' +
        '</div></td></tr>';
    }).join('');

    const from = total ? start + 1 : 0;
    const to = Math.min(start + PAGE_SIZE, total);
    $('#leads-page-info').textContent = 'Exibindo ' + from + '–' + to + ' de ' + total + ' leads';
    $('#leads-prev').disabled = leadsPage <= 1;
    $('#leads-next').disabled = leadsPage >= pages;

    $$('#leads-table [data-action]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (btn.dataset.action === 'view') openLeadDrawer(id);
        else if (btn.dataset.action === 'funil') addToFunil(id);
        else if (btn.dataset.action === 'contato') marcarContatado(id);
      });
    });

    $$('#leads-table tbody tr').forEach(function (tr) {
      tr.addEventListener('click', function () { openLeadDrawer(tr.dataset.id); });
    });
  }

  async function addToFunil(id) {
    try {
      await API().updateLead(id, { status_funil: 'prospectado' });
      Toast()?.success('Lead adicionado ao funil');
      API().invalidateCache();
      loadLeads();
    } catch (e) { Toast()?.error('Erro ao adicionar ao funil'); }
  }

  async function marcarContatado(id) {
    try {
      await API().updateLead(id, { status_funil: 'contato_feito' });
      await API().post('/feedback', { lead_id: id, outcome: 'positivo', motivo: 'Marcado como contatado' });
      Toast()?.success('Lead marcado como contatado');
      API().invalidateCache();
      loadLeads();
    } catch (e) { Toast()?.error('Erro ao atualizar status'); }
  }

  /* ── Lead Drawer ── */

  async function openLeadDrawer(leadId) {
    let lead = filteredLeads.find(function (l) { return l.id === leadId; });
    if (!lead) {
      const all = await API().get('/leads?perfil=' + perfil() + '&limite=5000');
      lead = (all.leads || []).find(function (l) { return l.id === leadId; });
    }
    if (!lead) { Toast()?.warn('Lead não encontrado'); return; }
    currentDrawerLead = lead;

    $('#drawer-title').textContent = lead.razao_social || '—';
    $('#drawer-subtitle').textContent = lead.cnpj_basico + ' · ' + (lead.cluster || '');

    $('#drawer-empresa').innerHTML = [
      ['CNPJ', lead.cnpj_basico], ['CNAE', lead.cnae_codigo + ' ' + (lead.cnae_descricao || '')],
      ['Regime', REGIME_LABELS[lead.regime_tributario] || lead.regime_tributario],
      ['Capital', fmtMoney(lead.capital_social)], ['Filiais', lead.qtd_filiais],
      ['Porte', lead.porte_empresa], ['Situação', lead.situacao_cadastral],
      ['UF / Município', (lead.uf || '') + ' / ' + (lead.municipio || '')],
    ].map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('');

    $('#drawer-contato').innerHTML = [
      ['E-mail', lead.email || '—'], ['Telefone', lead.telefone || '—'],
      ['Site', lead.site || '—'], ['LinkedIn', lead.linkedin_url || '—'],
    ].map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('');

    $('#drawer-comercial').innerHTML = [
      ['Score', (lead.score || 0).toFixed(1)], ['Status Funil', lead.status_funil],
      ['Prioridade', lead.prioridade], ['Transição', lead.transicao_regime ? 'Sim 🔥' : 'Não'],
      ['Dead Zone', lead.motivo_dead_zone || '—'],
    ].map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('');

    try {
      const hist = await API().get('/historico/' + leadId);
      const items = hist.items || hist || [];
      $('#drawer-historico').innerHTML = items.length
        ? items.map(function (h) {
          const dt = h.data_contato?.toDate ? h.data_contato.toDate().toLocaleString('pt-BR') : '—';
          return '<div class="historico-item"><strong>' + esc(h.outcome) + '</strong> · ' + dt +
            (h.motivo ? '<br>' + esc(h.motivo) : '') + '</div>';
        }).join('')
        : '<p class="hint">Nenhum contato registrado.</p>';
    } catch (e) {
      $('#drawer-historico').innerHTML = '<p class="hint">Histórico indisponível.</p>';
    }

    $('#drawer-overlay').classList.add('open');
    $('#lead-drawer').classList.add('open');
  }

  function closeDrawer() {
    $('#drawer-overlay').classList.remove('open');
    $('#lead-drawer').classList.remove('open');
    currentDrawerLead = null;
  }

  /* ── Dead Zone ── */

  async function loadDeadZone() {
    showTableSkeleton('deadzone-skeleton', 5);
    $('#deadzone-table').classList.add('hidden');
    try {
      const data = await API().get('/dead-zone?limite=200');
      deadZoneCache = data.dead_zone || [];
      renderDeadZone();
    } catch (e) {
      Toast()?.error('Erro ao carregar dead zone');
    } finally {
      hideTableSkeleton('deadzone-skeleton');
      $('#deadzone-table').classList.remove('hidden');
    }
  }

  function renderDeadZone() {
    const motivo = $('#dz-filter-motivo').value;
    const prioridade = $('#dz-filter-prioridade').value;
    const rota = $('#dz-filter-rota')?.value;
    let list = deadZoneCache;
    if (rota) list = list.filter(function (d) { return d.rota_recomendada === rota; });
    if (motivo) list = list.filter(function (d) { return (d.motivo || '').includes(motivo); });
    if (prioridade) list = list.filter(function (d) { return d.prioridade === prioridade; });

    $('#deadzone-table tbody').innerHTML = list.map(function (d) {
      return '<tr><td>' + esc(d.razao_social || '—') + '</td><td>' + esc(d.cluster_estrategico || '—') +
        '</td><td>' + esc(d.motivo) + '</td><td><strong>' + esc(d.rota_recomendada) + '</strong></td><td>' +
        (d.linkedin_url ? '<a href="' + esc(d.linkedin_url) + '" target="_blank">Perfil</a>' : '—') +
        '</td><td>' + esc(d.telefone_matriz || '—') + '</td><td>' + esc(d.prioridade) + '</td>' +
        '<td><button class="btn btn-reativar" data-id="' + esc(d.id) + '">Reativar</button></td></tr>';
    }).join('');

    $$('.btn-reativar').forEach(function (btn) {
      btn.addEventListener('click', function () { reativarLead(btn.dataset.id); });
    });
  }

  async function reativarLead(id) {
    try {
      await API().post('/feedback', { lead_id: id, outcome: 'reativado', motivo: 'Reativado da dead zone' });
      Toast()?.success('Lead reativado');
      API().invalidateCache();
      loadDeadZone();
    } catch (e) {
      Toast()?.error('Erro ao reativar');
    }
  }

  /* ── Transição ── */

  async function loadTransicao() {
    showTableSkeleton('transicao-skeleton', 5);
    $('#transicao-table').classList.add('hidden');
    try {
      const data = await API().get('/transicao-regime');
      const n = data.count_90d || 0;
      $('#transicao-card-title').textContent = '🔥 ' + n + ' empresas detectadas em transição para Lucro Real nos últimos 90 dias';
      $('#transicao-stats').innerHTML = '<strong>' + n + '</strong> oportunidades ativas de assessoria fiscal';
      $('#transicao-table tbody').innerHTML = (data.transicoes || []).map(function (t) {
        const dt = t.data_transicao?.toDate ? t.data_transicao.toDate().toLocaleDateString('pt-BR') : '—';
        return '<tr><td>' + esc(t.cnpj_basico) + '</td><td>' + esc(t.razao_social || '—') +
          '</td><td>' + esc(t.regime_anterior) + '</td><td>' + esc(t.regime_novo) +
          '</td><td>' + esc(t.cluster_estrategico || '—') + '</td><td>' + (t.score_prioridade || 0) +
          '</td><td>' + esc(t.uf || '—') + '</td><td>' + fmtMoney(t.capital_social) + '</td>' +
          '<td>' + esc(t.telefone || '—') + '</td><td>' + esc(t.email || '—') + '</td><td>' + dt + '</td>' +
          '<td><button class="btn primary btn-priorizar" data-id="' + esc(t.id) + '">Priorizar</button></td></tr>';
      }).join('');

      $$('.btn-priorizar').forEach(function (btn) {
        btn.addEventListener('click', function () { priorizarLead(btn.dataset.id); });
      });
    } catch (e) {
      Toast()?.error('Erro ao carregar transições');
    } finally {
      hideTableSkeleton('transicao-skeleton');
      $('#transicao-table').classList.remove('hidden');
    }
  }

  async function priorizarLead(id) {
    try {
      const all = await API().get('/leads?limite=5000');
      const lead = (all.leads || []).find(function (l) { return l.id === id; });
      const newScore = Math.min(10, (lead?.score || 0) + 2);
      await API().updateLead(id, {
        status_funil: 'prospectado',
        prioridade: 'Alta',
        score: newScore,
        transicao_regime: true,
      });
      await API().post('/feedback', { lead_id: id, outcome: 'positivo', motivo: '🔥 Priorizado — Transição de Regime' });
      Toast()?.success('Lead priorizado no Kanban');
      API().invalidateCache();
      loadTransicao();
    } catch (e) {
      Toast()?.error('Erro ao priorizar');
    }
  }

  /* ── Parceiros ── */

  async function loadParceiros() {
    showTableSkeleton('parceiros-skeleton', 5);
    $('#parceiros-table').classList.add('hidden');
    try {
      const data = await API().get('/parceiros');
      window._parceirosCache = data.parceiros || [];
      $('#parceiros-table tbody').innerHTML = window._parceirosCache.map(function (p) {
        return '<tr><td>' + esc(p.nome) + '</td><td>' + esc(p.rede || '—') + '</td><td>' + esc(p.uf_sede || '—') +
          '</td><td>' + (p.website ? '<a href="' + esc(p.website) + '" target="_blank">Site</a>' : '—') +
          '</td><td>' + esc(p.email_contato || '—') + '</td><td>' + esc(p.telefone || '—') + '</td>' +
          '<td>' + esc(p.status_parceria) + '</td>' +
          '<td><button class="btn btn-acionar-parceiro" data-id="' + esc(p.id) + '">Acionar Parceiro</button></td></tr>';
      }).join('');

      $$('.btn-acionar-parceiro').forEach(function (btn) {
        btn.addEventListener('click', function () { openAcionarModalFromParceiro(btn.dataset.id); });
      });
    } catch (e) {
      Toast()?.error('Erro ao carregar parceiros');
    } finally {
      hideTableSkeleton('parceiros-skeleton');
      $('#parceiros-table').classList.remove('hidden');
    }
  }

  function openAcionarModalFromParceiro(parceiroId) {
    $('#acionar-parceiro-fixo').value = parceiroId;
    $('#acionar-parceiro-field').classList.add('hidden');
    const sel = $('#acionar-lead');
    sel.innerHTML = (leadsCache.length ? leadsCache : filteredLeads).map(function (l) {
      return '<option value="' + esc(l.id) + '">' + esc(l.razao_social) + '</option>';
    }).join('') || '<option value="">Nenhum lead</option>';
    openModal('modal-acionar');
  }

  function openParceiroModal(id) {
    $('#modal-parceiro-title').textContent = id ? 'Editar Parceiro' : 'Cadastrar Parceiro';
    $('#parceiro-id').value = id || '';
    if (id) {
      const p = (window._parceirosCache || []).find(function (x) { return x.id === id; });
      if (p) {
        $('#parceiro-nome').value = p.nome || '';
        $('#parceiro-rede').value = p.rede || '';
        $('#parceiro-uf').value = p.uf_sede || '';
        $('#parceiro-website').value = p.website || '';
        $('#parceiro-status').value = p.status_parceria || 'prospectando';
      }
    } else {
      $('#form-parceiro').reset();
    }
    openModal('modal-parceiro');
  }

  async function saveParceiro(e) {
    e.preventDefault();
    const body = {
      nome: $('#parceiro-nome').value,
      rede: $('#parceiro-rede').value,
      uf_sede: $('#parceiro-uf').value,
      website: $('#parceiro-website').value,
      email_contato: $('#parceiro-email').value,
      telefone: $('#parceiro-telefone').value,
      status_parceria: $('#parceiro-status').value,
    };
    try {
      await API().post('/parceiros', body);
      Toast()?.success('Parceiro salvo');
      closeModal('modal-parceiro');
      loadParceiros();
    } catch (e) {
      Toast()?.error('Erro ao salvar parceiro');
    }
  }

  function openAcionarModal(leadId) {
    $('#acionar-lead-id').value = leadId || '';
    $('#acionar-parceiro-fixo').value = '';
    $('#acionar-parceiro-field').classList.remove('hidden');
    const leadSel = $('#acionar-lead');
    leadSel.innerHTML = (leadsCache.length ? leadsCache : filteredLeads).map(function (l) {
      return '<option value="' + esc(l.id) + '"' + (l.id === leadId ? ' selected' : '') + '>' + esc(l.razao_social) + '</option>';
    }).join('') || '<option value="' + esc(leadId) + '">Lead</option>';
    const sel = $('#acionar-parceiro');
    sel.innerHTML = (window._parceirosCache || []).map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc(p.nome) + '</option>';
    }).join('') || '<option value="">Nenhum parceiro</option>';
    openModal('modal-acionar');
  }

  async function confirmarAcionar() {
    const leadId = $('#acionar-lead').value || $('#acionar-lead-id').value;
    const parcId = $('#acionar-parceiro-fixo').value || $('#acionar-parceiro').value;
    const obs = $('#acionar-obs').value;
    try {
      await API().post('/feedback', {
        lead_id: leadId,
        outcome: 'indicacao_b2b2b',
        motivo: 'Parceiro: ' + parcId + (obs ? ' — ' + obs : ''),
        status_funil: 'proposta_enviada',
      });
      Toast()?.success('Indicação registrada');
      closeModal('modal-acionar');
    } catch (e) {
      Toast()?.error('Erro ao acionar parceiro');
    }
  }

  function openContatoModal(leadId) {
    $('#contato-lead-id').value = leadId;
    $('#contato-outcome').value = 'positivo';
    $('#contato-motivo').value = '';
    openModal('modal-contato');
  }

  async function confirmarContato() {
    const leadId = $('#contato-lead-id').value;
    const outcome = $('#contato-outcome').value;
    const motivo = $('#contato-motivo').value;
    const statusMap = {
      reuniao: 'negociacao',
      positivo: 'contato_feito',
      indicacao_b2b2b: 'proposta_enviada',
      negativo: 'perdido',
    };
    try {
      await API().post('/feedback', {
        lead_id: leadId,
        outcome: outcome,
        motivo: motivo,
        status_funil: statusMap[outcome] || undefined,
      });
      Toast()?.success('Contato registrado');
      closeModal('modal-contato');
      if (currentDrawerLead?.id === leadId) openLeadDrawer(leadId);
    } catch (e) {
      Toast()?.error('Erro ao registrar contato');
    }
  }

  /* ── Kanban / Funil ── */

  function buildKanbanBoard() {
    $('#kanban-board').innerHTML = KANBAN_COLS.map(function (col) {
      return '<div class="kanban-col" data-status="' + col.id + '">' +
        '<h4>' + col.label + '</h4><div class="count" data-count="' + col.id + '">0</div>' +
        '<div class="kanban-cards" data-col="' + col.id + '"></div></div>';
    }).join('');

    $$('.kanban-col').forEach(function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('drag-over'); });
      col.addEventListener('dragleave', function () { col.classList.remove('drag-over'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault();
        col.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        const status = col.dataset.status;
        if (id && status) updateKanbanStatus(id, status);
      });
    });
  }

  async function loadFunil() {
    try {
      const data = await API().get('/leads?perfil=' + perfil() + '&limite=500');
      const list = data.leads || [];
      renderKanban(list);
      renderFunnelMetrics(computeFunilMetrics(list), list);
    } catch (e) {
      Toast()?.error('Erro ao carregar funil');
    }
  }

  function renderKanban(leads) {
    const p = perfil();
    const list = leads.filter(function (l) {
      return (!l.perfil_icp || l.perfil_icp === p || p === 'generico') && l.status_funil !== 'dead_zone';
    });

    KANBAN_COLS.forEach(function (col) {
      const cards = list.filter(function (l) { return (l.status_funil || 'prospectado') === col.id; });
      const container = $('.kanban-cards[data-col="' + col.id + '"]');
      const countEl = $('[data-count="' + col.id + '"]');
      if (countEl) countEl.textContent = cards.length;
      if (!container) return;
      container.innerHTML = cards.map(function (l) {
        const next = nextKanbanStatus(col.id);
        const cls = l.transicao_regime ? 'kanban-card transicao' : 'kanban-card';
        return '<div class="' + cls + '" draggable="true" data-id="' + esc(l.id) + '">' +
          '<strong>' + esc(l.razao_social) + '</strong>' +
          (l.transicao_regime ? ' <span>🔥</span>' : '') + '<br>' +
          '<span class="hint">Score ' + (l.score || 0).toFixed(1) + ' · ' +
          esc(REGIME_LABELS[l.regime_tributario] || l.regime_tributario || '—') + ' · ' + esc(l.uf || '—') + '</span>' +
          (next ? '<br><button class="btn" style="margin-top:0.35rem;font-size:0.7rem" data-next="' + next + '" data-id="' + esc(l.id) + '">Próxima etapa →</button>' : '') +
          '</div>';
      }).join('');

      container.querySelectorAll('.kanban-card').forEach(function (card) {
        card.addEventListener('dragstart', function (e) {
          e.dataTransfer.setData('text/plain', card.dataset.id);
          card.classList.add('dragging');
        });
        card.addEventListener('dragend', function () { card.classList.remove('dragging'); });
        card.addEventListener('click', function (e) {
          if (e.target.closest('button[data-next]')) return;
          openLeadDrawer(card.dataset.id);
        });
      });
      container.querySelectorAll('button[data-next]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          updateKanbanStatus(btn.dataset.id, btn.dataset.next);
        });
      });
    });
  }

  async function updateKanbanStatus(leadId, status) {
    try {
      await API().post('/feedback', {
        lead_id: leadId,
        outcome: 'positivo',
        motivo: 'Movido para ' + status,
        status_funil: status,
      });
      Toast()?.success('Status atualizado');
      API().invalidateCache();
      loadFunil();
    } catch (e) {
      Toast()?.error('Erro ao atualizar status');
    }
  }

  function nextKanbanStatus(current) {
    const order = KANBAN_COLS.map(function (c) { return c.id; });
    const idx = order.indexOf(current);
    return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
  }

  function renderFunnelMetrics(funil, leads) {
    const p = perfil();
    const list = (leads || leadsCache).filter(function (l) {
      return (!l.perfil_icp || l.perfil_icp === p || p === 'generico') && l.status_funil !== 'dead_zone';
    });
    const counts = {};
    KANBAN_COLS.forEach(function (c) {
      counts[c.id] = list.filter(function (l) { return (l.status_funil || 'prospectado') === c.id; }).length;
    });
    const conv = [];
    for (let i = 0; i < KANBAN_COLS.length - 1; i++) {
      const a = counts[KANBAN_COLS[i].id] || 0;
      const b = counts[KANBAN_COLS[i + 1].id] || 0;
      conv.push({ from: KANBAN_COLS[i].label, pct: a ? ((b / a) * 100).toFixed(1) : '0.0' });
    }
    $('#funnel-metrics').innerHTML = conv.map(function (c) {
      return '<div class="funnel-step"><span>' + esc(c.from) + ' → próxima</span><strong>' + c.pct + '%</strong></div>';
    }).join('');

    const max = Math.max.apply(null, Object.values(counts).concat([1]));
    $('#funnel-bars').innerHTML = KANBAN_COLS.map(function (col) {
      const n = counts[col.id] || 0;
      const w = Math.round((n / max) * 100);
      return '<div class="funnel-bar-row"><span style="min-width:110px">' + col.label + '</span>' +
        '<div class="funnel-bar-track"><div class="funnel-bar-fill" style="width:' + w + '%"></div></div>' +
        '<span>' + n + '</span></div>';
    }).join('');
  }

  /* ── Export ── */

  function getSelectedExportCols() {
    return [...$$('#export-cols input:checked')].map(function (cb) { return cb.value; });
  }

  function getSelectedExportStatuses() {
    return [...$$('#export-status input:checked')].map(function (cb) { return cb.value; });
  }

  async function getExportData() {
    const data = await API().get('/leads?perfil=' + perfil() + '&limite=5000');
    const statuses = getSelectedExportStatuses();
    return (data.leads || []).filter(function (l) {
      return !statuses.length || statuses.includes(l.status_funil);
    });
  }

  function pickCols(rows, cols) {
    return rows.map(function (r) {
      const o = {};
      cols.forEach(function (c) { o[c] = r[c] != null ? r[c] : ''; });
      return o;
    });
  }

  async function exportCSV() {
    const cols = getSelectedExportCols();
    const rows = pickCols(await getExportData(), cols);
    if (!rows.length) { Toast()?.warn('Nenhum dado para exportar'); return; }
    const header = cols.join(';');
    const body = rows.map(function (r) {
      return cols.map(function (c) { return '"' + String(r[c]).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\n');
    downloadBlob('\uFEFF' + header + '\n' + body, 'afs-leads.csv', 'text/csv;charset=utf-8');
    $('#export-result').textContent = 'CSV exportado com ' + rows.length + ' registros.';
    Toast()?.success('CSV exportado');
  }

  async function exportJSON() {
    const cols = getSelectedExportCols();
    const rows = pickCols(await getExportData(), cols);
    downloadBlob(JSON.stringify(rows, null, 2), 'afs-leads.json', 'application/json');
    $('#export-result').textContent = 'JSON exportado com ' + rows.length + ' registros.';
    Toast()?.success('JSON exportado');
  }

  async function exportClipboard() {
    const cols = getSelectedExportCols();
    const rows = pickCols(await getExportData(), cols);
    const header = cols.join('\t');
    const body = rows.map(function (r) {
      return cols.map(function (c) { return String(r[c] ?? '').replace(/\t/g, ' '); }).join('\t');
    }).join('\n');
    try {
      await navigator.clipboard.writeText(header + '\n' + body);
      $('#export-result').textContent = rows.length + ' registros copiados (TSV).';
      Toast()?.success('Copiado — cole no Google Sheets');
    } catch (e) {
      Toast()?.error('Falha ao copiar');
    }
  }

  async function exportExcel() {
    if (typeof XLSX === 'undefined') { Toast()?.error('SheetJS não carregado'); return; }
    try {
      const pack = await API().post('/export', { perfil: perfil(), statuses: getSelectedExportStatuses() });
      const sheets = pack.sheets || {};
      const wb = XLSX.utils.book_new();
      const add = function (name, rows) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows || []), name);
      };
      add('Leads Prontos', sheets.leads);
      add('Dead Zone', sheets.dead_zone);
      add('Transição Regime', sheets.transicao);
      add('Parceiros', sheets.parceiros);
      add('Histórico Contatos', sheets.historico);
      add('Metadados', [{ perfil: perfil(), exportado_em: new Date().toISOString(), total_leads: (sheets.leads || []).length }]);
      XLSX.writeFile(wb, pack.filename || 'afs-export.xlsx');
      $('#export-result').textContent = 'Excel multi-abas exportado.';
      Toast()?.success('Excel exportado');
    } catch (e) {
      Toast()?.error('Erro na exportação Excel');
    }
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ── Config / Scoring ── */

  async function loadScoringConfig() {
    try {
      const data = await API().get('/config/scoring');
      const pesos = data.pesos_scoring || {};
      ['capital', 'filiais', 'regime', 'cnae', 'porte'].forEach(function (k) {
        const el = $('#peso-' + k);
        const val = $('#val-' + k);
        if (el && pesos[k] != null) {
          el.value = pesos[k];
          if (val) val.textContent = pesos[k];
        }
      });
    } catch (e) { /* defaults */ }
  }

  function getPesos() {
    return {
      capital: parseInt($('#peso-capital').value, 10),
      filiais: parseInt($('#peso-filiais').value, 10),
      regime: parseInt($('#peso-regime').value, 10),
      cnae: parseInt($('#peso-cnae').value, 10),
      porte: parseInt($('#peso-porte').value, 10),
    };
  }

  async function saveScoring() {
    try {
      await API().post('/config/scoring', { pesos: getPesos() });
      Toast()?.success('Pesos salvos');
    } catch (e) {
      Toast()?.error('Erro ao salvar pesos');
    }
  }

  async function recalcScores() {
    try {
      const result = await API().post('/leads/recalculate-scores', { pesos: getPesos() });
      Toast()?.success('Scores recalculados (' + (result.updated || 0) + ' leads)');
      API().invalidateCache();
      reloadActiveTab();
    } catch (e) {
      Toast()?.error('Erro ao recalcular');
    }
  }

  /* ── Global Search ── */

  function initSearch() {
    const input = $('#global-search');
    const dropdown = $('#search-dropdown');
    if (!input) return;

    input.addEventListener('input', function () {
      clearTimeout(searchTimer);
      const term = input.value.trim();
      if (!term) { dropdown.classList.remove('open'); return; }
      searchTimer = setTimeout(async function () {
        const results = await API().searchLeads(term);
        if (!results.length) {
          dropdown.innerHTML = '<div class="search-item">Nenhum resultado</div>';
        } else {
          dropdown.innerHTML = results.map(function (l) {
            return '<div class="search-item" data-id="' + esc(l.id) + '">' +
              esc(l.razao_social) + '<small>' + esc(l.cnpj_basico) + ' · ' + esc(l.uf) + '</small></div>';
          }).join('');
          dropdown.querySelectorAll('.search-item[data-id]').forEach(function (item) {
            item.addEventListener('click', function () {
              dropdown.classList.remove('open');
              input.value = '';
              switchTab('leads');
              openLeadDrawer(item.dataset.id);
            });
          });
        }
        dropdown.classList.add('open');
      }, 250);
    });

    document.addEventListener('click', function (e) {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
  }

  /* ── Modals ── */

  function openModal(id) { $('#' + id).classList.add('open'); }
  function closeModal(id) { $('#' + id).classList.remove('open'); }

  /* ── Init ── */

  function bindEvents() {
    $$('.nav-item').forEach(function (btn) {
      btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
    });

    $('#perfil').addEventListener('change', reloadActiveTab);
    $('#menu-toggle').addEventListener('click', function () {
      $('#sidebar').classList.toggle('open');
    });

    $('#btn-logout').addEventListener('click', function () {
      window.AFSAuth.signOut().then(function () {
        window.location.href = portalSignInUrl();
      });
    });

    $('#btn-run-full').addEventListener('click', function () { runPipeline(null); });
    $('#btn-run-icp').addEventListener('click', function () { runPipeline('categorizacao_icp'); });
    $('#btn-run-enrich').addEventListener('click', function () { runPipeline('enriquecimento'); });
    $('#btn-run-validate').addEventListener('click', function () { runPipeline('validacao_email'); });
    $('#btn-run-regime').addEventListener('click', function () { runPipeline('monitor_regime'); });
    $('#btn-save-pipeline').addEventListener('click', savePipelineConfig);

    $('#btn-filter-leads').addEventListener('click', loadLeads);
    $('#btn-clear-filters').addEventListener('click', clearLeadsFilters);
    const fq = $('#filter-q');
    if (fq) fq.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(loadLeads, 300);
    });
    $('#leads-prev').addEventListener('click', function () { if (leadsPage > 1) { leadsPage--; renderLeadsPage(); } });
    $('#leads-next').addEventListener('click', function () { leadsPage++; renderLeadsPage(); });

    $('#btn-dz-filter').addEventListener('click', renderDeadZone);

    $('#drawer-close').addEventListener('click', closeDrawer);
    $('#drawer-fechar').addEventListener('click', closeDrawer);
    $('#drawer-overlay').addEventListener('click', closeDrawer);
    $('#drawer-abordagem').addEventListener('click', function () {
      if (currentDrawerLead) iniciarAbordagem(currentDrawerLead.id);
    });
    $('#drawer-registrar-contato').addEventListener('click', async function () {
      if (!currentDrawerLead) return;
      const outcome = $('#drawer-contato-outcome').value;
      const motivo = $('#drawer-contato-motivo').value;
      const statusMap = { reuniao: 'negociacao', positivo: 'contato_feito', indicacao_b2b2b: 'proposta_enviada', negativo: 'perdido' };
      try {
        await API().post('/feedback', {
          lead_id: currentDrawerLead.id,
          outcome: outcome,
          motivo: motivo,
          status_funil: statusMap[outcome],
        });
        Toast()?.success('Contato registrado');
        openLeadDrawer(currentDrawerLead.id);
      } catch (e) { Toast()?.error('Erro ao registrar contato'); }
    });

    $('#btn-cadastrar-parceiro').addEventListener('click', function () { openParceiroModal(null); });
    $('#form-parceiro').addEventListener('submit', saveParceiro);
    $('#btn-confirmar-acionar').addEventListener('click', confirmarAcionar);
    $('#btn-confirmar-contato').addEventListener('click', confirmarContato);

    $$('[data-close]').forEach(function (btn) {
      btn.addEventListener('click', function () { closeModal(btn.dataset.close); });
    });
    $$('.modal-overlay').forEach(function (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });

    $('#btn-export-csv').addEventListener('click', exportCSV);
    $('#btn-export-json').addEventListener('click', exportJSON);
    $('#btn-export-clipboard').addEventListener('click', exportClipboard);
    $('#btn-export-excel').addEventListener('click', exportExcel);

    ['capital', 'filiais', 'regime', 'cnae', 'porte'].forEach(function (k) {
      const el = $('#peso-' + k);
      if (el) el.addEventListener('input', function () {
        $('#val-' + k).textContent = el.value;
      });
    });
    $('#btn-save-scoring').addEventListener('click', saveScoring);
    $('#btn-recalc-scores').addEventListener('click', recalcScores);

    initSearch();
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindEvents();
    initAuth();
  });
})();
