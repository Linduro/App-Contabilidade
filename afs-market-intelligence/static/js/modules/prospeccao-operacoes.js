/**
 * Centro de Operações — roda todo o pipeline pela interface (sem CLI).
 */
import {
  fetchOpsStatus, fetchJobs, startPipeline, enqueueFiltros,
  runScrapingQueue, fetchScrapingQueueStatus, socialScrape, fetchSocialLeads, fetchSocialConfig,
  enriquecerCnpjs, pingHttpBackend,
} from '../adapters/prospeccao-search-v6.js';
import {
  startRfIngest, exportProspectosExcel, fetchRfStatus, backendConfigHint, pollJob,
} from '../adapters/rf-pipeline-api.js';
import * as store from '../core/store.js';

let activeTab = 'visao';
let logEl = null;
let pageMount = null;

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function appendLog(msg) {
  if (!logEl) return;
  const ts = new Date().toLocaleTimeString('pt-BR');
  logEl.textContent = (logEl.textContent === '—' ? '' : logEl.textContent + '\n') + '[' + ts + '] ' + msg;
  logEl.scrollTop = logEl.scrollHeight;
}

function tabBtn(id, label) {
  return '<button type="button" class="ops-tab' + (activeTab === id ? ' active' : '') + '" data-ops-tab="' + id + '">' + label + '</button>';
}

export async function renderProspeccaoOperacoes({ mount }) {
  pageMount = mount;
  const ping = await pingHttpBackend();
  mount.innerHTML =
    '<div class="ops-page">' +
      '<div class="ops-head">' +
        '<div><h2 style="margin:0">Centro de Operações</h2>' +
        '<p class="hint">Ingestão RF, enriquecimento, social e export — tudo pela interface.</p></div>' +
        '<div class="ops-head-actions">' +
          '<span class="pm-backend-status ' + (ping.online ? 'online' : 'offline') + '">' +
            (ping.online ? '● Backend online' : '● Offline') +
          '</span>' +
          '<a href="#/prospeccao/massa" class="btn sm">← Busca</a>' +
        '</div>' +
      '</div>' +
      '<nav class="ops-tabs">' +
        tabBtn('visao', 'Visão geral') +
        tabBtn('rf', 'Receita Federal') +
        tabBtn('enriquecer', 'Enriquecimento') +
        tabBtn('social', 'LinkedIn / Instagram') +
        tabBtn('jobs', 'Jobs') +
      '</nav>' +
      '<div id="ops-body" class="ops-body"><p class="hint">Carregando…</p></div>' +
      '<div class="ops-log-wrap"><h4>Log de operações</h4><pre id="ops-log" class="pm-log">—</pre></div>' +
    '</div>';

  logEl = mount.querySelector('#ops-log');
  mount.querySelectorAll('[data-ops-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      activeTab = btn.getAttribute('data-ops-tab');
      void renderTab(mount);
    });
  });

  if (!ping.online) {
    appendLog('Backend offline: ' + (backendConfigHint() || 'Inicie python app.py'));
  }

  await renderTab(mount);
}

async function renderTab(mount) {
  mount.querySelectorAll('.ops-tab').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-ops-tab') === activeTab);
  });
  const body = mount.querySelector('#ops-body');
  if (activeTab === 'visao') await renderVisao(body);
  else if (activeTab === 'rf') renderRf(body);
  else if (activeTab === 'enriquecer') renderEnriquecer(body);
  else if (activeTab === 'social') await renderSocial(body);
  else if (activeTab === 'jobs') await renderJobs(body);
}

async function renderVisao(el) {
  let st = {};
  try { st = await fetchOpsStatus(); } catch (e) { st = { error: e.message }; }
  const fila = st.fila_enriquecimento || {};
  const filaTxt = Object.entries(fila).map(function (kv) { return kv[0] + ': ' + kv[1]; }).join(' · ') || 'vazia';

  el.innerHTML =
    '<div class="ops-cards">' +
      card('Prospectos RF', (st.prospectos ?? 0).toLocaleString('pt-BR'), 'Empresas Lucro Real na base') +
      card('Contatos coletados', (st.contatos ?? 0).toLocaleString('pt-BR'), 'Cascata RF→API→site') +
      card('Leads social', (st.social_leads ?? 0).toLocaleString('pt-BR'), 'LinkedIn + Instagram') +
      card('Fila enriquecimento', filaTxt, 'Status scraping_queue') +
    '</div>' +
    '<div class="ops-actions-grid">' +
      '<button type="button" class="btn primary" id="ops-pipeline-full">Pipeline completo (RF + ICP + fila)</button>' +
      '<button type="button" class="btn sm" id="ops-refresh">Atualizar painel</button>' +
      '<a href="#/prospeccao/massa" class="btn sm">Ir para busca</a>' +
    '</div>' +
    (st.rf?.snapshot ? '<p class="hint">Último snapshot RF: <strong>' + esc(st.rf.snapshot.versao || '—') + '</strong></p>' : '');

  el.querySelector('#ops-refresh')?.addEventListener('click', function () {
    if (pageMount) void renderTab(pageMount);
  });
  el.querySelector('#ops-pipeline-full')?.addEventListener('click', async function () {
    appendLog('Iniciando pipeline completo…');
    try {
      const res = await startPipeline({ pular_ingestao: false });
      appendLog('Job #' + res.job_id + ' enfileirado');
      await pollJob(res.job_id, function (j) { appendLog(j.status + ' · ' + (j.message || '')); });
      appendLog('Pipeline concluído');
      window.AFSToast?.success('Pipeline concluído');
      void renderVisao(el);
    } catch (e) {
      appendLog('Erro: ' + e.message);
      window.AFSToast?.error(e.message);
    }
  });
}

function card(title, value, hint) {
  return '<div class="ops-card"><strong>' + esc(title) + '</strong><div class="ops-card-val">' + esc(String(value)) + '</div><small class="hint">' + esc(hint) + '</small></div>';
}

function renderRf(el) {
  el.innerHTML =
    '<section class="l2-card">' +
      '<h3>Ingestão Receita Federal</h3>' +
      '<p class="hint">Download dos ZIPs abertos + carga DuckDB + materialização prospectos_rf (~230k LR).</p>' +
      '<label class="pm-check"><input type="checkbox" id="ops-skip-dl"> Pular download (usar ZIPs locais)</label>' +
      '<div class="pm-actions" style="margin-top:0.75rem">' +
        '<button type="button" class="btn primary" id="ops-rf-start">Iniciar ingestão RF</button>' +
      '</div>' +
    '</section>' +
    '<section class="l2-card" style="margin-top:1rem">' +
      '<h3>Exportar Excel</h3>' +
      '<div class="pm-export-form">' +
        '<select id="ops-export-lim"><option value="5000">5.000</option><option value="50000" selected>50.000</option></select>' +
        '<button type="button" class="btn sm primary" id="ops-export">Exportar .xlsx</button>' +
      '</div>' +
    '</section>';

  el.querySelector('#ops-rf-start')?.addEventListener('click', async function () {
    appendLog('Ingestão RF iniciada…');
    try {
      const res = await startRfIngest({ skipDownload: el.querySelector('#ops-skip-dl')?.checked, modo: 'completo' });
      await pollJob(res.job_id, function (j) { appendLog('RF: ' + j.status + ' · ' + (j.message || '')); });
      window.AFSToast?.success('Ingestão RF concluída');
    } catch (e) {
      appendLog('RF erro: ' + e.message);
      window.AFSToast?.error(e.message);
    }
  });

  el.querySelector('#ops-export')?.addEventListener('click', async function () {
    try {
      await exportProspectosExcel({ limite: Number(el.querySelector('#ops-export-lim').value) });
      appendLog('Excel exportado');
      window.AFSToast?.success('Exportado');
    } catch (e) {
      window.AFSToast?.error(e.message);
    }
  });
}

function renderEnriquecer(el) {
  el.innerHTML =
    '<section class="l2-card">' +
      '<h3>Enriquecer em lote (filtro ICP)</h3>' +
      '<p class="hint">Usa filtros da última busca em Prospecção em Massa (se disponível).</p>' +
      '<div class="ops-row">' +
        '<label class="ps-field"><span>Quantidade</span>' +
          '<select id="ops-enr-lim"><option value="50">50</option><option value="100" selected>100</option><option value="500">500</option><option value="1000">1.000</option></select></label>' +
        '<label class="ps-field"><span>Aba</span>' +
          '<select id="ops-enr-aba"><option value="nao_enriquecidas">Não enriquecidas</option><option value="todas">Todas</option></select></label>' +
      '</div>' +
      '<label class="pm-check"><input type="checkbox" id="ops-enr-processar" checked> Processar fila imediatamente após enfileirar</label>' +
      '<button type="button" class="btn primary" id="ops-enr-batch" style="margin-top:0.75rem">Enriquecer lote</button>' +
    '</section>' +
    '<section class="l2-card" style="margin-top:1rem">' +
      '<h3>Fila de enriquecimento</h3>' +
      '<p id="ops-queue-st" class="hint">—</p>' +
      '<div class="pm-actions">' +
        '<button type="button" class="btn sm" id="ops-queue-10">Processar 10</button>' +
        '<button type="button" class="btn sm" id="ops-queue-50">Processar 50</button>' +
      '</div>' +
    '</section>' +
    '<section class="l2-card" style="margin-top:1rem">' +
      '<h3>Enriquecer CNPJs manualmente</h3>' +
      '<textarea id="ops-cnpjs-manual" rows="3" placeholder="CNPJ básico ou completo, um por linha"></textarea>' +
      '<button type="button" class="btn sm" id="ops-cnpjs-go" style="margin-top:0.5rem">Enriquecer lista</button>' +
    '</section>';

  async function refreshQ() {
    try {
      const st = await fetchScrapingQueueStatus();
      el.querySelector('#ops-queue-st').textContent = JSON.stringify(st.fila || {});
    } catch (_) {}
  }
  void refreshQ();

  const icpFiltros = (function () {
    try {
      const raw = sessionStorage.getItem('afs_last_filtros');
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {
      capital_min: 2000000, capital_max: 10000000,
      ufs: [], clusters: [], cnaes: [], municipios: [], portes: [], naturezas: [],
    };
  })();

  el.querySelector('#ops-enr-batch')?.addEventListener('click', async function () {
    const lim = Number(el.querySelector('#ops-enr-lim').value);
    const aba = el.querySelector('#ops-enr-aba').value;
    const processar = el.querySelector('#ops-enr-processar')?.checked;
    appendLog('Enfileirando ' + lim + ' CNPJs (' + aba + ')…');
    try {
      const r = await enqueueFiltros({ filtros: icpFiltros, aba, limite: lim, processar });
      appendLog('Enfileirados: ' + (r.enfileirados || 0) + (r.processamento ? ' · processados: ' + r.processamento.processados : ''));
      window.AFSToast?.success((r.enfileirados || 0) + ' enfileirados');
      void refreshQ();
    } catch (e) {
      appendLog('Erro: ' + e.message);
      window.AFSToast?.error(e.message);
    }
  });

  async function runQueue(n) {
    appendLog('Processando fila (' + n + ')…');
    const r = await runScrapingQueue(n);
    appendLog('Fila: ' + (r.processados || 0) + ' ok, ' + (r.erros || 0) + ' erros');
    window.AFSToast?.success('Fila processada');
    void refreshQ();
  }
  el.querySelector('#ops-queue-10')?.addEventListener('click', function () { void runQueue(10); });
  el.querySelector('#ops-queue-50')?.addEventListener('click', function () { void runQueue(50); });

  el.querySelector('#ops-cnpjs-go')?.addEventListener('click', async function () {
    const lines = (el.querySelector('#ops-cnpjs-manual')?.value || '').split('\n').map(function (s) {
      return s.replace(/\D/g, '').slice(0, 8);
    }).filter(Boolean);
    if (!lines.length) return;
    appendLog('Enriquecendo ' + lines.length + ' CNPJs…');
    const r = await enriquecerCnpjs(lines, true);
    appendLog('Concluído: ' + JSON.stringify(r));
    window.AFSToast?.success('Enriquecimento concluído');
  });
}

async function renderSocial(el) {
  let leads = [];
  let cfg = { linkedin_configured: false, linkedin_session_saved: false };
  try { leads = await fetchSocialLeads(30); } catch (_) {}
  try { cfg = await fetchSocialConfig(); } catch (_) {}

  const liStatus = cfg.linkedin_configured
    ? (cfg.linkedin_session_saved ? '● LinkedIn: credenciais OK · sessão salva' : '● LinkedIn: credenciais OK · login na 1ª execução')
    : '○ LinkedIn: credenciais ausentes (prospect-automation/.env)';

  el.innerHTML =
    '<section class="l2-card">' +
      '<h3>Scrape LinkedIn + Instagram</h3>' +
      '<p class="pm-backend-status ' + (cfg.linkedin_configured ? 'online' : 'offline') + '" style="margin-bottom:0.75rem">' + esc(liStatus) + '</p>' +
      '<p class="hint">Login aceita e-mail ou telefone. Instagram público funciona sem login.</p>' +
      '<label class="ps-field"><span>LinkedIn URLs (1/linha)</span><textarea id="ops-li" rows="3"></textarea></label>' +
      '<label class="ps-field"><span>Instagram users (1/linha)</span><textarea id="ops-ig" rows="2"></textarea></label>' +
      '<button type="button" class="btn primary" id="ops-social-run">Iniciar scrape</button>' +
    '</section>' +
    '<section class="l2-card" style="margin-top:1rem">' +
      '<h3>Últimos coletados (' + leads.length + ')</h3>' +
      (leads.length ? '<table class="ps-table"><thead><tr><th>Fonte</th><th>Nome</th><th>URL</th></tr></thead><tbody>' +
        leads.map(function (l) {
          return '<tr><td>' + esc(l.fonte) + '</td><td>' + esc(l.nome || l.username || '—') + '</td><td><a href="' + esc(l.url || '#') + '" target="_blank" rel="noopener">link</a></td></tr>';
        }).join('') + '</tbody></table>' : '<p class="hint">Nenhum lead social ainda.</p>') +
    '</section>';

  el.querySelector('#ops-social-run')?.addEventListener('click', async function () {
    const li = (el.querySelector('#ops-li')?.value || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    const ig = (el.querySelector('#ops-ig')?.value || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!li.length && !ig.length) { window.AFSToast?.error('Informe alvos'); return; }
    appendLog('Social scrape: ' + li.length + ' LI + ' + ig.length + ' IG');
    try {
      const res = await socialScrape({ linkedin_urls: li, instagram_users: ig });
      if (res.job_id) {
        await pollJob(res.job_id, function (j) { appendLog('Social: ' + j.status + ' · ' + (j.message || '')); });
      }
      window.AFSToast?.success('Scrape social concluído');
      await renderSocial(el);
    } catch (e) {
      appendLog('Social erro: ' + e.message);
      window.AFSToast?.error(e.message);
    }
  });
}

async function renderJobs(el) {
  let data = { jobs: [] };
  try { data = await fetchJobs(25); } catch (_) {}
  const jobs = data.jobs || [];

  el.innerHTML =
    '<section class="l2-card">' +
      '<h3>Jobs recentes</h3>' +
      (jobs.length ? '<table class="ps-table"><thead><tr><th>#</th><th>Tipo</th><th>Status</th><th>Progresso</th><th>Mensagem</th></tr></thead><tbody>' +
        jobs.map(function (j) {
          return '<tr><td>' + j.id + '</td><td>' + esc(j.tipo) + '</td><td>' + esc(j.status) +
            '</td><td>' + (j.progress ?? 0) + '%</td><td class="hint">' + esc((j.message || '').slice(0, 60)) + '</td></tr>';
        }).join('') + '</tbody></table>' :
        '<p class="hint">Nenhum job ainda.</p>') +
      '<button type="button" class="btn sm" id="ops-jobs-refresh" style="margin-top:0.75rem">Atualizar</button>' +
    '</section>';

  el.querySelector('#ops-jobs-refresh')?.addEventListener('click', function () { void renderJobs(el); });
}
