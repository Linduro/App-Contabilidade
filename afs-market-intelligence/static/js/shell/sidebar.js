import * as store from '../core/store.js';

const NAV = [
  { section: 'Atalhos', items: [
    { hash: '/apps', label: 'Home', icon: '⌂' },
    { hash: '/comunicacao/inbox', label: 'Caixa de entrada', icon: '✉' },
    { hash: '/crm/pipelines', label: 'Pipelines', icon: '▥' },
    { hash: '/tarefas', label: 'Atividades', icon: '☑' },
  ]},
  { section: 'Módulos', items: [
    { hash: '/prospeccao', label: 'Prospecção', icon: '◎' },
    { hash: '/crm/leads', label: 'CRM · Leads', icon: '◉' },
    { hash: '/crm/pipelines', label: 'CRM · Pipelines', icon: '▦' },
    { hash: '/marketing/segmentacoes', label: 'Marketing', icon: '◈' },
    { hash: '/automacao/jornadas', label: 'Automação', icon: '⚡' },
    { hash: '/analises/relatorios', label: 'Análises', icon: '📊' },
  ]},
  { section: 'AFS', items: [
    { hash: '/prospeccao/dead-zone', label: 'Dead Zone', icon: '⊘' },
    { hash: '/prospeccao/transicao', label: 'Transição Regime', icon: '↻' },
    { hash: '/parceiros', label: 'Parceiros B2B2B', icon: '⇄' },
    { hash: '/configuracoes', label: 'Configurações', icon: '⚙' },
    { hash: '/legacy', label: 'UI legada (temp.)', icon: '⏪' },
  ]},
];

export function renderSidebar(el, currentPath) {
  const overdue = store.count('activities', (a) => a.status === 'atrasada');
  const leads = store.count('leads');
  const deals = store.count('deals');

  el.innerHTML =
    '<div class="l2-brand">' +
      '<div class="brand-icon">AFS</div>' +
      '<div><strong>Market Intelligence</strong><small>Asset Flow Solutions</small></div>' +
    '</div>' +
    '<div class="l2-sidebar-stats">' +
      '<span>' + leads + ' leads</span><span>' + deals + ' negócios</span>' +
    '</div>' +
    NAV.map(function (sec) {
      return '<div class="l2-nav-section"><div class="l2-nav-title">' + sec.section + '</div>' +
        sec.items.map(function (item) {
          const active = currentPath === item.hash || currentPath.startsWith(item.hash + '/');
          const badge = item.hash === '/tarefas' && overdue > 0 ? '<span class="l2-badge">' + overdue + '</span>' : '';
          return '<a class="l2-nav-item' + (active ? ' active' : '') + '" href="#' + item.hash + '">' +
            '<span class="l2-nav-icon">' + item.icon + '</span>' + item.label + badge + '</a>';
        }).join('') +
      '</div>';
    }).join('') +
    '<div class="l2-sidebar-foot">' +
      '<div class="l2-onboarding"><small>Guias do usuário</small><div class="l2-progress"><div style="width:35%"></div></div></div>' +
      '<a class="l2-nav-item" href="#">Central de ajuda</a>' +
    '</div>';
}
