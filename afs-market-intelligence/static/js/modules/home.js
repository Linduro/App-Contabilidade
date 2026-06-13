import * as store from '../core/store.js';

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

export async function renderHome({ mount }) {
  const leads = store.count('leads');
  const deals = store.count('deals');
  const activities = store.count('activities', (a) => a.status === 'pendente');
  const overdue = store.count('activities', (a) => a.status === 'atrasada');
  const automations = store.count('automations');
  const partners = store.count('partners');
  const hot = store.list('leads', { filter: (l) => (l.score || 0) >= 7 && l.status_funil === 'prospectado', limit: 5 }).rows;

  const now = new Date();
  const clock = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  mount.innerHTML =
    '<div class="l2-home">' +
      '<div class="l2-home-hero">' +
        '<h1>' + clock + '</h1>' +
        '<p class="hint">' + date + '</p>' +
      '</div>' +
      '<div class="l2-onboard-grid">' +
        card('Prospecção em Massa', '~230k LR', '/prospeccao/massa', 'Ingestão RF + mapas') +
        card('Prospecção', leads + ' leads ICP', '/prospeccao', 'Buscar empresas') +
        card('Pipelines', deals + ' negócios', '/crm/pipelines', 'Abrir kanban') +
        card('Atividades', activities + ' pendentes', '/tarefas', overdue ? overdue + ' atrasadas' : 'Em dia') +
        card('Automação', automations + ' jornadas', '/automacao/jornadas', 'Configurar fluxos') +
        card('Parceiros', partners + ' bancas', '/parceiros', 'Canal B2B2B') +
        card('Análises', 'Relatórios', '/analises/relatorios', 'Ver métricas') +
      '</div>' +
      '<section class="l2-card" style="margin-top:1.5rem">' +
        '<h3>Oportunidades do dia</h3>' +
        '<p class="hint">Leads quentes para abordagem manual hoje</p>' +
        (hot.length ? '<ul class="l2-opp-list">' + hot.map(function (l) {
          return '<li><strong>' + esc(l.razao_social) + '</strong> <span>Score ' + esc(l.score) + ' · ' + esc(l.uf) + '</span>' +
            '<a class="btn sm" href="#/crm/leads">Abrir lead</a></li>';
        }).join('') + '</ul>' : '<p class="hint">Nenhuma oportunidade quente no momento.</p>') +
      '</section>' +
      '<p class="hint" style="margin-top:1rem">Dados em <code>localStorage</code>. Import do Firestore na primeira carga.</p>' +
    '</div>';
}

function card(title, stat, hash, sub) {
  return '<a class="l2-onboard-card" href="#' + hash + '">' +
    '<h4>' + title + '</h4><div class="l2-onboard-stat">' + stat + '</div><small>' + sub + '</small></a>';
}
