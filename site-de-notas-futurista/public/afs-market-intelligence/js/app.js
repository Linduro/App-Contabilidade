(function () {
  'use strict';

  const API = window.AFSMarketAPI;
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
    export: 'Export Excel',
  };

  function perfil() { return $('#perfil').value; }

  function fmtMoney(v) {
    if (!v) return '—';
    return 'R$ ' + Number(v).toLocaleString('pt-BR');
  }

  function switchTab(tab) {
    $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $$('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + tab));
    $('#page-title').textContent = TITLES[tab] || tab;
    if (tab === 'leads') loadLeads();
    if (tab === 'deadzone') loadDeadZone();
    if (tab === 'transicao') loadTransicao();
    if (tab === 'parceiros') loadParceiros();
    if (tab === 'funil') loadFunil();
  }

  async function loadStatus() {
    try {
      const data = await API.get('/status?perfil=' + perfil());
      $('#status-text').textContent = 'Online · Perfil: ' + data.perfil_ativo;
      renderMetrics(data.funil || {});
    } catch (e) {
      $('#status-text').textContent = 'Offline';
    }
  }

  function renderMetrics(funil) {
    const grid = $('#metrics-grid');
    const items = [
      { label: 'Universo ICP', value: funil.universo_icp || 0 },
      { label: 'Enriquecidos', value: funil.enriquecidos || 0 },
      { label: 'E-mails Validados', value: funil.emails_validados || 0 },
      { label: 'Dead Zone', value: funil.dead_zone || 0 },
    ];
    grid.innerHTML = items.map((i) =>
      '<div class="metric-card"><div class="value">' + i.value + '</div><div class="label">' + i.label + '</div></div>'
    ).join('');
  }

  async function runPipeline(etapa) {
    const log = $('#pipeline-log');
    log.textContent = 'Executando' + (etapa ? ': ' + etapa : ' pipeline completo') + '...\n';
    const body = { perfil: perfil(), pular_ingestao: true };
    if (etapa) body.etapa = etapa;
    const result = await API.post('/pipeline/run', body);
    log.textContent += JSON.stringify(result, null, 2);
    loadStatus();
  }

  async function loadLeads() {
    const data = await API.get('/leads?perfil=' + perfil() + '&limite=100');
    const tbody = $('#leads-table tbody');
    tbody.innerHTML = (data.leads || []).map((l) =>
      '<tr><td>' + l.cnpj_basico + '</td><td>' + l.razao_social + '</td><td>' + l.cluster +
      '</td><td>' + fmtMoney(l.capital_social) + '</td><td>' + l.qtd_filiais +
      '</td><td>' + (l.score || 0).toFixed(1) + '</td><td>' + (l.transicao_regime ? '🔥' : '—') + '</td></tr>'
    ).join('');
  }

  async function loadDeadZone() {
    const data = await API.get('/dead-zone?limite=100');
    const tbody = $('#deadzone-table tbody');
    tbody.innerHTML = (data.dead_zone || []).map((d) =>
      '<tr><td>' + (d.razao_social || '—') + '</td><td>' + (d.cluster_estrategico || '—') +
      '</td><td>' + d.motivo + '</td><td><strong>' + d.rota_recomendada + '</strong></td><td>' +
      (d.linkedin_url ? '<a href="' + d.linkedin_url + '" target="_blank">Perfil</a>' : '—') +
      '</td><td>' + (d.telefone_matriz || '—') + '</td><td>' + d.prioridade + '</td></tr>'
    ).join('');
  }

  async function loadTransicao() {
    const data = await API.get('/transicao-regime');
    const tbody = $('#transicao-table tbody');
    tbody.innerHTML = (data.transicoes || []).map((t) =>
      '<tr><td>' + t.cnpj_basico + '</td><td>' + (t.razao_social || '—') +
      '</td><td>' + t.regime_anterior + '</td><td>' + t.regime_novo +
      '</td><td>' + (t.cluster_estrategico || '—') + '</td><td>' + (t.score_prioridade || 0) + '</td></tr>'
    ).join('');
  }

  async function loadParceiros() {
    const data = await API.get('/parceiros');
    const tbody = $('#parceiros-table tbody');
    tbody.innerHTML = (data.parceiros || []).map((p) =>
      '<tr><td>' + p.nome + '</td><td>' + (p.rede || '—') + '</td><td>' + (p.uf_sede || '—') +
      '</td><td>' + (p.website ? '<a href="' + p.website + '" target="_blank">Site</a>' : '—') +
      '</td><td>' + p.status_parceria + '</td></tr>'
    ).join('');
  }

  function loadFunil() {
    API.get('/status?perfil=' + perfil()).then((data) => {
      const f = data.funil || {};
      const steps = [
        { name: 'Universo ICP', val: f.universo_icp || 0 },
        { name: 'Enriquecidos', val: f.enriquecidos || 0 },
        { name: 'E-mails Validados', val: f.emails_validados || 0 },
        { name: 'Dead Zone', val: f.dead_zone || 0 },
      ];
      $('#funnel-viz').innerHTML = steps.map((s) =>
        '<div class="funnel-step"><span>' + s.name + '</span><strong>' + s.val + '</strong></div>'
      ).join('');
    });
  }

  async function doExport() {
    $('#export-result').textContent = 'Gerando planilha...';
    const result = await API.post('/export', { perfil: perfil() });
    if (result.status === 'ok') {
      $('#export-result').innerHTML = 'Planilha gerada: <strong>' + result.filename + '</strong>';
    } else {
      $('#export-result').textContent = 'Erro: ' + (result.message || 'desconhecido');
    }
  }

  async function doFeedback() {
    const leadId = parseInt($('#fb-lead-id').value, 10);
    const outcome = $('#fb-outcome').value;
    const motivo = $('#fb-motivo').value;
    if (!leadId) return alert('Informe o Lead ID');
    const result = await API.post('/feedback', { lead_id: leadId, outcome, motivo });
    alert(result.status === 'ok' ? 'Feedback registrado — scoring recalibrado' : result.message);
    loadStatus();
  }

  document.addEventListener('DOMContentLoaded', function () {
    $$('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    $('#perfil').addEventListener('change', loadStatus);

    $('#btn-run-full').addEventListener('click', () => runPipeline(null));
    $('#btn-run-icp').addEventListener('click', () => runPipeline('categorizacao_icp'));
    $('#btn-run-enrich').addEventListener('click', () => runPipeline('enriquecimento'));
    $('#btn-run-validate').addEventListener('click', () => runPipeline('validacao_email'));
    $('#btn-run-regime').addEventListener('click', () => runPipeline('monitor_regime'));
    $('#btn-load-partners').addEventListener('click', () => runPipeline('parceiros_auditoria'));
    $('#btn-export').addEventListener('click', doExport);
    $('#btn-feedback').addEventListener('click', doFeedback);

    loadStatus();
  });
})();
