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
      if (user) {
        $('#afs-login').classList.add('hidden');
        $('#afs-app').classList.remove('hidden');
        bootstrapApp();
      } else {
        teardownApp();
        $('#afs-app').classList.add('hidden');
        $('#afs-login').classList.remove('hidden');
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
      if (activeTab === 'dashboard') renderDashboardFromLeads(leads);
      if (activeTab === 'funil') renderKanban(leads);
    });
    if (unsubConfig) unsubConfig();
    unsubConfig = api.subscribeConfigStatus(function (cfg) {
      const online = cfg.online !== false;
      $('#status-dot').classList.toggle('offline', !online);
      $('#status-text').textContent = (online ? 'Online' : 'Offline') + ' · Perfil: ' + perfil();
    });
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
    const items = [
      { label: 'Universo ICP', value: funil.universo_icp || 0, change: pctChange },
      { label: 'Enriquecidos', value: funil.enriquecidos || 0, change: null },
      { label: 'E-mails Validados', value: funil.emails_validados || 0, change: null },
      { label: 'Dead Zone', value: funil.dead_zone || 0, change: null },
      { label: 'Transição Regime', value: funil.transicao_regime || 0, change: null },
      { label: 'Taxa Conversão', value: (funil.taxa_conversao || 0).toFixed(1) + '%', change: null, raw: true },
    ];
    $('#metrics-grid').innerHTML = items.map(function (i) {
      const ch = i.change != null
        ? '<div class="change ' + (i.change >= 0 ? 'up' : 'down') + '">' + fmtPct(i.change) + ' vs mês ant.</div>'
        : '';
      const val = i.raw ? i.value : Number(i.value).toLocaleString('pt-BR');
      return '<div class="metric-card"><div class="value">' + val + '</div><div class="label">' + esc(i.label) + '</div>' + ch + '</div>';
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

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const opps = filtered
      .filter(function (l) {
        if (l.transicao_regime) return true;
        if ((l.score || 0) >= 7) return true;
        const ts = l.criado_em?.toDate ? l.criado_em.toDate() : null;
        return ts && ts >= today;
      })
      .sort(function (a, b) { return (b.score || 0) - (a.score || 0); })
      .slice(0, 8);

    $('#oportunidades-dia').innerHTML = opps.length
      ? opps.map(function (l) {
        return '<div class="oportunidade-item"><div><strong>' + esc(l.razao_social) + '</strong>' +
          '<br><span class="hint">' + esc(l.cluster || l.cnae_descricao) + ' · Score ' + (l.score || 0).toFixed(1) + '</span></div>' +
          '<button class="btn primary btn-abordagem" data-id="' + esc(l.id) + '">Iniciar Abordagem</button></div>';
      }).join('')
      : '<p class="hint">Nenhuma oportunidade destacada hoje.</p>';

    $$('.btn-abordagem').forEach(function (btn) {
      btn.addEventListener('click', function () { openLeadDrawer(btn.dataset.id); });
    });
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
      await API().post('/pipeline/run', body);
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
    return q;
  }

  async function loadLeads() {
    $('#leads-skeleton').classList.remove('hidden');
    $('#leads-table').classList.add('hidden');
    try {
      const data = await API().get('/leads?' + new URLSearchParams(buildLeadsQuery()).toString());
      filteredLeads = data.leads || [];
      populateUfFilter(filteredLeads);
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
        '<td>' + esc(l.cluster) + '</td>' +
        '<td>' + esc(REGIME_LABELS[l.regime_tributario] || l.regime_tributario || '—') + '</td>' +
        '<td>' + fmtMoney(l.capital_social) + '</td>' +
        '<td>' + (l.qtd_filiais || 0) + '</td>' +
        '<td>' + esc(l.uf) + '</td>' +
        '<td>' + (l.score || 0).toFixed(1) + '</td>' +
        '<td>' + esc(l.status_funil || '—') + '</td>' +
        '<td>' + (l.transicao_regime ? '🔥' : '—') + '</td>' +
        '<td><div class="action-icons">' +
        '<button title="Ver" data-action="view" data-id="' + esc(l.id) + '">👁</button>' +
        '<button title="Contato" data-action="contato" data-id="' + esc(l.id) + '">✉</button>' +
        '<button title="Parceiro" data-action="parceiro" data-id="' + esc(l.id) + '">🤝</button>' +
        '</div></td></tr>';
    }).join('');

    $('#leads-page-info').textContent = 'Página ' + leadsPage + ' de ' + pages + ' (' + total + ' leads)';
    $('#leads-prev').disabled = leadsPage <= 1;
    $('#leads-next').disabled = leadsPage >= pages;

    $$('#leads-table [data-action]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (btn.dataset.action === 'view') openLeadDrawer(id);
        else if (btn.dataset.action === 'contato') openContatoModal(id);
        else if (btn.dataset.action === 'parceiro') openAcionarModal(id);
      });
    });

    $$('#leads-table tbody tr').forEach(function (tr) {
      tr.addEventListener('click', function () { openLeadDrawer(tr.dataset.id); });
    });
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
    try {
      const data = await API().get('/dead-zone?limite=200');
      deadZoneCache = data.dead_zone || [];
      renderDeadZone();
    } catch (e) {
      Toast()?.error('Erro ao carregar dead zone');
    }
  }

  function renderDeadZone() {
    const motivo = $('#dz-filter-motivo').value;
    const prioridade = $('#dz-filter-prioridade').value;
    let list = deadZoneCache;
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
    try {
      const data = await API().get('/transicao-regime');
      $('#transicao-stats').innerHTML = '<strong>' + (data.count_90d || 0) +
        '</strong> empresas em transição nos últimos 90 dias';
      $('#transicao-table tbody').innerHTML = (data.transicoes || []).map(function (t) {
        return '<tr><td>' + esc(t.cnpj_basico) + '</td><td>' + esc(t.razao_social || '—') +
          '</td><td>' + esc(t.regime_anterior) + '</td><td>' + esc(t.regime_novo) +
          '</td><td>' + esc(t.cluster_estrategico || '—') + '</td><td>' + (t.score_prioridade || 0) +
          '</td><td>' + esc(t.uf || '—') + '</td>' +
          '<td><button class="btn primary btn-priorizar" data-id="' + esc(t.id) + '">Priorizar</button></td></tr>';
      }).join('');

      $$('.btn-priorizar').forEach(function (btn) {
        btn.addEventListener('click', function () { priorizarLead(btn.dataset.id); });
      });
    } catch (e) {
      Toast()?.error('Erro ao carregar transições');
    }
  }

  async function priorizarLead(id) {
    try {
      await API().updateLead(id, { prioridade: 'Alta', score: 10 });
      Toast()?.success('Lead priorizado');
      loadTransicao();
    } catch (e) {
      Toast()?.error('Erro ao priorizar');
    }
  }

  /* ── Parceiros ── */

  async function loadParceiros() {
    try {
      const data = await API().get('/parceiros');
      window._parceirosCache = data.parceiros || [];
      $('#parceiros-table tbody').innerHTML = window._parceirosCache.map(function (p) {
        return '<tr><td>' + esc(p.nome) + '</td><td>' + esc(p.rede || '—') + '</td><td>' + esc(p.uf_sede || '—') +
          '</td><td>' + (p.website ? '<a href="' + esc(p.website) + '" target="_blank">Site</a>' : '—') +
          '</td><td>' + esc(p.status_parceria) + '</td>' +
          '<td><button class="btn btn-edit-parceiro" data-id="' + esc(p.id) + '">Editar</button></td></tr>';
      }).join('');

      $$('.btn-edit-parceiro').forEach(function (btn) {
        btn.addEventListener('click', function () { openParceiroModal(btn.dataset.id); });
      });
    } catch (e) {
      Toast()?.error('Erro ao carregar parceiros');
    }
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
    $('#acionar-lead-id').value = leadId;
    const sel = $('#acionar-parceiro');
    sel.innerHTML = (window._parceirosCache || []).map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc(p.nome) + '</option>';
    }).join('') || '<option value="">Nenhum parceiro</option>';
    openModal('modal-acionar');
  }

  async function confirmarAcionar() {
    const leadId = $('#acionar-lead-id').value;
    const parcId = $('#acionar-parceiro').value;
    const obs = $('#acionar-obs').value;
    try {
      await API().post('/feedback', {
        lead_id: leadId,
        outcome: 'indicacao_b2b2b',
        motivo: 'Parceiro: ' + parcId + (obs ? ' — ' + obs : ''),
        status_funil: 'contato_feito',
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
      renderKanban(data.leads || []);
      const st = await API().get('/status?perfil=' + perfil());
      renderFunnelMetrics(st.funil || {});
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
        return '<div class="kanban-card" draggable="true" data-id="' + esc(l.id) + '">' +
          '<strong>' + esc(l.razao_social) + '</strong><br>' +
          '<span class="hint">Score ' + (l.score || 0).toFixed(1) + '</span></div>';
      }).join('');

      container.querySelectorAll('.kanban-card').forEach(function (card) {
        card.addEventListener('dragstart', function (e) {
          e.dataTransfer.setData('text/plain', card.dataset.id);
          card.classList.add('dragging');
        });
        card.addEventListener('dragend', function () { card.classList.remove('dragging'); });
        card.addEventListener('click', function () { openLeadDrawer(card.dataset.id); });
      });
    });
  }

  async function updateKanbanStatus(leadId, status) {
    try {
      await API().updateLead(leadId, { status_funil: status });
      Toast()?.success('Status atualizado');
      loadFunil();
    } catch (e) {
      Toast()?.error('Erro ao atualizar status');
    }
  }

  function renderFunnelMetrics(funil) {
    const steps = [
      { name: 'Universo ICP', val: funil.universo_icp || 0 },
      { name: 'Enriquecidos', val: funil.enriquecidos || 0 },
      { name: 'E-mails Validados', val: funil.emails_validados || 0 },
      { name: 'Dead Zone', val: funil.dead_zone || 0 },
      { name: 'Transição', val: funil.transicao_regime || 0 },
      { name: 'Taxa Conversão', val: (funil.taxa_conversao || 0).toFixed(1) + '%' },
    ];
    $('#funnel-metrics').innerHTML = steps.map(function (s) {
      return '<div class="funnel-step"><span>' + s.name + '</span><strong>' + s.val + '</strong></div>';
    }).join('');
  }

  /* ── Export ── */

  function getSelectedExportCols() {
    return [...$$('#export-cols input:checked')].map(function (cb) { return cb.value; });
  }

  async function getExportData() {
    const data = await API().get('/leads?perfil=' + perfil() + '&limite=5000');
    return data.leads || [];
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
    const text = JSON.stringify(rows, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      $('#export-result').textContent = rows.length + ' registros copiados.';
      Toast()?.success('Copiado para área de transferência');
    } catch (e) {
      Toast()?.error('Falha ao copiar');
    }
  }

  async function exportExcel() {
    if (typeof XLSX === 'undefined') { Toast()?.error('SheetJS não carregado'); return; }
    const cols = getSelectedExportCols();
    const rows = pickCols(await getExportData(), cols);
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, 'afs-leads-' + Date.now() + '.xlsx');
    $('#export-result').textContent = 'Excel exportado com ' + rows.length + ' registros.';
    Toast()?.success('Excel exportado');
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

    $('#login-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const errEl = $('#login-error');
      errEl.style.display = 'none';
      try {
        await window.AFSAuth.signIn($('#login-email').value, $('#login-password').value);
      } catch (err) {
        errEl.textContent = 'Credenciais inválidas. Tente novamente.';
        errEl.style.display = 'block';
      }
    });

    $('#btn-logout').addEventListener('click', function () {
      window.AFSAuth.signOut();
      Toast()?.success('Sessão encerrada');
    });

    $('#btn-run-full').addEventListener('click', function () { runPipeline(null); });
    $('#btn-run-icp').addEventListener('click', function () { runPipeline('categorizacao_icp'); });
    $('#btn-run-enrich').addEventListener('click', function () { runPipeline('enriquecimento'); });
    $('#btn-run-validate').addEventListener('click', function () { runPipeline('validacao_email'); });
    $('#btn-run-regime').addEventListener('click', function () { runPipeline('monitor_regime'); });
    $('#btn-save-pipeline').addEventListener('click', savePipelineConfig);

    $('#btn-filter-leads').addEventListener('click', loadLeads);
    $('#leads-prev').addEventListener('click', function () { if (leadsPage > 1) { leadsPage--; renderLeadsPage(); } });
    $('#leads-next').addEventListener('click', function () { leadsPage++; renderLeadsPage(); });

    $('#btn-dz-filter').addEventListener('click', renderDeadZone);

    $('#drawer-close').addEventListener('click', closeDrawer);
    $('#drawer-overlay').addEventListener('click', closeDrawer);
    $('#drawer-abordagem').addEventListener('click', function () {
      if (currentDrawerLead) openContatoModal(currentDrawerLead.id);
    });
    $('#drawer-acionar').addEventListener('click', function () {
      if (currentDrawerLead) openAcionarModal(currentDrawerLead.id);
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
