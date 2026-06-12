import * as store from '../core/store.js';

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function money(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR');
}

export async function renderOportunidades({ mount }) {
  const leads = store.list('leads').rows;
  const deals = store.list('deals', { filter: (d) => d.status === 'aberto' }).rows;
  const activities = store.list('activities').rows;
  const overdue = activities.filter((a) => a.status === 'atrasada').length;
  const hot = deals.filter((d) => (Number(d.valor) || 0) >= 50000);
  const won = store.list('deals', { filter: (d) => d.status === 'ganho' }).rows;
  const clients = store.list('clients').rows;

  const cards = [
    { label: 'Leads', val: leads.length, color: '#3b82f6' },
    { label: 'Oportunidades', val: deals.length, color: '#e8681a' },
    { label: 'Ações Atrasadas', val: overdue, color: '#ef4444' },
    { label: 'Negócios Quentes', val: hot.length, color: '#f59e0b' },
    { label: 'Oportunidades Ganhas', val: won.length, color: '#22c55e' },
    { label: 'Pós-venda', val: clients.length, color: '#8b5cf6' },
  ];

  mount.innerHTML =
    '<div class="crm-oportunidades">' +
      '<div class="opp-summary-grid">' + cards.map((c) =>
        '<div class="opp-summary-card" style="--accent:' + c.color + '"><span>' + c.label + '</span><strong>' + c.val + '</strong></div>'
      ).join('') + '</div>' +
      '<section class="l2-card" style="margin-top:1.25rem">' +
        '<h3>Oportunidades Ativas</h3>' +
        '<table class="data-table compact"><thead><tr><th>Negócio</th><th>Valor</th><th>Etapa</th><th>Empresa</th></tr></thead><tbody>' +
        deals.map((d) => {
          const lead = store.get('leads', d.lead_id);
          const stage = store.get('stages', d.stage_id);
          return '<tr><td><a href="#/crm/pipelines">' + esc(d.titulo) + '</a></td><td>' + money(d.valor) + '</td><td>' + esc(stage?.nome || '—') + '</td><td>' + esc(lead?.razao_social || '—') + '</td></tr>';
        }).join('') +
        '</tbody></table>' +
      '</section></div>';
}
