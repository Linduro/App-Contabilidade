import * as store from '../core/store.js';
import { openModal, closeModal, bindModalCloses } from '../components/modal.js';

const TABS = [
  { path: '/analises/relatorios', label: 'Relatórios' },
  { path: '/analises/metas', label: 'Metas' },
];

const FUNIL_ORDER = ['prospectado', 'contato_feito', 'proposta_enviada', 'negociacao', 'fechado', 'perdido'];
const FUNIL_LABELS = {
  prospectado: 'Prospectado', contato_feito: 'Contato', proposta_enviada: 'Proposta',
  negociacao: 'Negociação', fechado: 'Fechado', perdido: 'Perdido',
};

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function tabNav(path) {
  return '<nav class="l2-subnav">' + TABS.map((t) =>
    '<a href="#' + t.path + '" class="' + (path.startsWith(t.path) ? 'active' : '') + '">' + t.label + '</a>'
  ).join('') + '</nav>';
}

function chartDataFunil() {
  const leads = store.list('leads').rows;
  return {
    labels: FUNIL_ORDER.map((k) => FUNIL_LABELS[k]),
    data: FUNIL_ORDER.map((k) => leads.filter((l) => l.status_funil === k).length),
  };
}

function chartDataUf() {
  const leads = store.list('leads').rows;
  const ufs = {};
  leads.forEach((l) => { if (l.uf) ufs[l.uf] = (ufs[l.uf] || 0) + 1; });
  const sorted = Object.entries(ufs).sort((a, b) => b[1] - a[1]);
  return { labels: sorted.map((x) => x[0]), data: sorted.map((x) => x[1]) };
}

function chartDataDeals() {
  const stages = store.list('stages', { sort: { key: 'ordem', dir: 'asc' } }).rows;
  const deals = store.list('deals').rows;
  return {
    labels: stages.map((s) => s.nome),
    data: stages.map((s) => deals.filter((d) => d.stage_id === s.id).reduce((sum, d) => sum + (Number(d.valor) || 0), 0)),
  };
}

function destroyCharts() {
  if (window._afsCharts) {
    window._afsCharts.forEach((c) => c.destroy());
    window._afsCharts = [];
  } else {
    window._afsCharts = [];
  }
}

function mountCharts(mount) {
  if (!window.Chart) return;
  destroyCharts();
  const funil = chartDataFunil();
  const uf = chartDataUf();
  const deals = chartDataDeals();
  const orange = '#e8681a';
  const blue = '#3b82f6';

  const c1 = mount.querySelector('#chart-funil');
  if (c1) {
    window._afsCharts.push(new Chart(c1, {
      type: 'bar',
      data: { labels: funil.labels, datasets: [{ label: 'Leads', data: funil.data, backgroundColor: orange }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: '#9ca3af' } }, x: { ticks: { color: '#9ca3af' } } } },
    }));
  }
  const c2 = mount.querySelector('#chart-uf');
  if (c2) {
    window._afsCharts.push(new Chart(c2, {
      type: 'doughnut',
      data: { labels: uf.labels, datasets: [{ data: uf.data, backgroundColor: [orange, blue, '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'] }] },
      options: { plugins: { legend: { labels: { color: '#d1d5db' } } } },
    }));
  }
  const c3 = mount.querySelector('#chart-deals');
  if (c3) {
    window._afsCharts.push(new Chart(c3, {
      type: 'bar',
      data: { labels: deals.labels, datasets: [{ label: 'R$ pipeline', data: deals.data, backgroundColor: blue }] },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: '#9ca3af' } }, x: { ticks: { color: '#9ca3af' } } } },
    }));
  }
}

function renderRelatorios(mount, path) {
  const leads = store.count('leads');
  const dealsVal = store.list('deals').rows.reduce((s, d) => s + (Number(d.valor) || 0), 0);
  const conv = store.count('leads', (l) => l.status_funil === 'fechado');
  const rate = leads ? ((conv / leads) * 100).toFixed(1) : '0';

  mount.innerHTML =
    '<div class="crm-toolbar"><h2 style="margin:0">Análises</h2></div>' + tabNav(path) +
    '<div class="opp-summary-grid" style="margin-top:1rem">' +
      '<div class="opp-summary-card" style="--accent:#e8681a"><span>Leads na base</span><strong>' + leads + '</strong></div>' +
      '<div class="opp-summary-card" style="--accent:#3b82f6"><span>Pipeline (R$)</span><strong>' + dealsVal.toLocaleString('pt-BR') + '</strong></div>' +
      '<div class="opp-summary-card" style="--accent:#22c55e"><span>Taxa conversão</span><strong>' + rate + '%</strong></div>' +
    '</div>' +
    '<div class="charts-grid" style="margin-top:1rem">' +
      '<div class="l2-card chart-card"><h4>Funil de leads</h4><canvas id="chart-funil" height="200"></canvas></div>' +
      '<div class="l2-card chart-card"><h4>Leads por UF</h4><canvas id="chart-uf" height="200"></canvas></div>' +
      '<div class="l2-card chart-card chart-wide"><h4>Valor por etapa do pipeline</h4><canvas id="chart-deals" height="180"></canvas></div>' +
    '</div>';

  requestAnimationFrame(() => mountCharts(mount));
}

function renderMetas(mount, path) {
  const goals = store.list('goals').rows;
  const dealsWon = store.count('deals', (d) => {
    const st = store.get('stages', d.stage_id);
    return st?.is_won;
  });

  mount.innerHTML =
    '<div class="crm-toolbar"><h2 style="margin:0">Análises</h2>' +
    '<button type="button" class="btn primary sm" id="goal-new">+ Meta</button></div>' + tabNav(path) +
    '<div class="l2-card" style="margin-top:1rem"><table class="data-table"><thead><tr><th>Meta</th><th>Tipo</th><th>Progresso</th><th>Período</th></tr></thead><tbody>' +
    goals.map((g) => {
      const atual = g.tipo === 'deals_won' ? dealsWon : (g.atual || 0);
      const pct = g.meta ? Math.min(100, Math.round((atual / g.meta) * 100)) : 0;
      return '<tr><td>' + esc(g.titulo) + '</td><td>' + esc(g.tipo) + '</td>' +
        '<td><div class="pipe-bar-row"><div class="pipe-bar-track"><div class="pipe-bar-fill" style="width:' + pct + '%;background:var(--afs-orange-500)"></div></div>' +
        '<span>' + atual + '/' + g.meta + '</span></div></td><td>' + esc(g.periodo) + '</td></tr>';
    }).join('') +
    '</tbody></table></div>' +
    '<div id="modal-goal" class="l2-modal-overlay"><div class="l2-modal">' +
      '<h3>Nova meta</h3>' +
      '<label class="l2-field"><span>Título</span><input id="goal-titulo"></label>' +
      '<label class="l2-field"><span>Meta (número)</span><input type="number" id="goal-meta" value="10"></label>' +
      '<label class="l2-field"><span>Período</span><input id="goal-periodo" value="2026-Q2"></label>' +
      '<div class="l2-modal-actions"><button type="button" class="btn" data-close-modal>Cancelar</button><button type="button" class="btn primary" id="goal-save">Salvar</button></div></div></div>';

  bindModalCloses(mount);
  mount.querySelector('#goal-new')?.addEventListener('click', () => openModal('modal-goal'));
  mount.querySelector('#goal-save')?.addEventListener('click', () => {
    store.create('goals', {
      titulo: mount.querySelector('#goal-titulo')?.value.trim() || 'Nova meta',
      tipo: 'deals_won',
      meta: Number(mount.querySelector('#goal-meta')?.value || 10),
      atual: 0,
      periodo: mount.querySelector('#goal-periodo')?.value.trim() || '2026',
    });
    closeModal('modal-goal');
    renderMetas(mount, path);
    window.AFSToast?.success('Meta criada');
  });
}

export async function renderAnalises({ path, mount }) {
  if (path.startsWith('/analises/metas')) return renderMetas(mount, path);
  return renderRelatorios(mount, path);
}
