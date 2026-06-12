import * as store from '../core/store.js';
import { openDrawer } from '../components/drawer.js';

const REGIME_LABELS = { SN: 'SN', LP: 'LP', LR: 'LR' };

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

function transicaoLeads() {
  return store.list('leads', {
    filter: (l) => l.transicao_regime && l.status_funil !== 'dead_zone',
    sort: { key: 'score', dir: 'desc' },
  }).rows;
}

function within90Days(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  return diff >= 0 && diff <= 90 * 86400000;
}

export async function renderTransicao({ mount }) {
  const all = transicaoLeads();
  const recent = all.filter((l) => within90Days(l.transicao_regime?.data));

  mount.innerHTML =
    '<div class="crm-toolbar"><div><h2 style="margin:0">Transição de Regime</h2>' +
    '<p class="hint">Oportunidades de assessoria fiscal em mudança tributária</p></div></div>' +
    '<div class="opp-summary-grid">' +
      '<div class="opp-summary-card" style="--accent:#f59e0b"><span>Em transição (total)</span><strong>' + all.length + '</strong></div>' +
      '<div class="opp-summary-card" style="--accent:#e8681a"><span>Últimos 90 dias</span><strong>' + recent.length + '</strong></div>' +
      '<div class="opp-summary-card" style="--accent:#3b82f6"><span>Score médio</span><strong>' +
        (all.length ? (all.reduce((s, l) => s + (Number(l.score) || 0), 0) / all.length).toFixed(1) : '0') +
      '</strong></div>' +
    '</div>' +
    '<div class="l2-card" style="margin-top:1rem">' +
      '<h4>🔥 ' + recent.length + ' empresas em transição detectadas nos últimos 90 dias</h4>' +
      '<table class="data-table" style="margin-top:0.75rem"><thead><tr>' +
        '<th>Empresa</th><th>De → Para</th><th>Data</th><th>UF</th><th>Score</th><th>Capital</th><th></th>' +
      '</tr></thead><tbody>' +
      (all.length ? all.map((l) => {
        const t = l.transicao_regime || {};
        return '<tr data-id="' + esc(l.id) + '"><td>' + esc(l.razao_social) + '</td>' +
          '<td><strong>' + esc(REGIME_LABELS[t.de] || t.de || '?') + ' → ' + esc(REGIME_LABELS[t.para] || t.para || 'LR') + '</strong></td>' +
          '<td>' + fmtDate(t.data) + '</td><td>' + esc(l.uf) + '</td><td>' + esc(l.score) + '</td>' +
          '<td>R$ ' + Number(l.capital_social || 0).toLocaleString('pt-BR') + '</td>' +
          '<td><button type="button" class="btn sm" data-open="' + esc(l.id) + '">Abrir</button></td></tr>';
      }).join('') : '<tr><td colspan="7" class="hint">Nenhuma transição detectada.</td></tr>') +
      '</tbody></table></div>';

  mount.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lead = store.get('leads', btn.dataset.open);
      if (!lead) return;
      const t = lead.transicao_regime || {};
      openDrawer(lead.razao_social, '<dl class="drawer-grid">' +
        '<dt>Transição</dt><dd>' + esc(t.de) + ' → ' + esc(t.para) + '</dd>' +
        '<dt>Data</dt><dd>' + fmtDate(t.data) + '</dd>' +
        '<dt>Regime atual</dt><dd>' + esc(lead.regime_tributario) + '</dd>' +
        '<dt>Receita est.</dt><dd>R$ ' + Number(lead.receita_anual_estimada || 0).toLocaleString('pt-BR') + '</dd>' +
        '</dl><a class="btn sm primary" href="#/crm/leads" style="margin-top:1rem;display:inline-block">Ir para leads</a>');
    });
  });
}
