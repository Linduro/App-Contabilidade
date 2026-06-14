import * as store from '../core/store.js';
import { NAV_SECTIONS } from '../shell/nav-config.js';

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
  const hot = store.list('leads', { filter: (l) => (l.score || 0) >= 7 && l.status_funil === 'prospectado', limit: 5 }).rows;

  const now = new Date();
  const clock = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  const sectionCards = NAV_SECTIONS.map(function (sec) {
    const first = sec.items[0];
    const hubHash = sec.id === 'lab' ? '/lab' : sec.id === 'estrategia' ? '/estrategia' : sec.id === 'operacao' ? '/operacao' : first.hash;
    return '<a class="l2-onboard-card pm-home-section pm-home-' + sec.id + '" href="#' + hubHash + '">' +
      '<h4>' + esc(sec.title) + '</h4>' +
      '<p class="hint">' + esc(sec.subtitle) + '</p>' +
      '<small>' + sec.items.length + ' ferramentas · Abrir →</small></a>';
  }).join('');

  mount.innerHTML =
    '<div class="l2-home">' +
      '<div class="l2-home-hero">' +
        '<h1>' + clock + '</h1>' +
        '<p class="hint">' + date + '</p>' +
        '<p class="hint pm-home-flow">Fluxo: Laboratório → Estratégia → Operação → Comunicação → Análises</p>' +
      '</div>' +
      '<div class="l2-onboard-grid pm-home-grid">' + sectionCards + '</div>' +
      '<div class="l2-onboard-grid" style="margin-top:0.75rem">' +
        quickCard('Mapa do Brasil · LR', '/lab/mapa', 'Heatmap ~230k empresas') +
        quickCard('Auditorias no mapa', '/lab/auditorias', 'Bancas e raio de atuação') +
        quickCard('Patrimonial no mapa', '/lab/patrimonial', 'Prestadores terceirizados') +
        quickCard('Busca de Leads', '/prospeccao/busca', 'Filtros RF + CNPJ') +
        quickCard('Leads & ICP', '/crm/leads', leads + ' leads') +
        quickCard('Pipelines', '/crm/pipelines', deals + ' negócios') +
        quickCard('Atividades', '/tarefas', activities + ' pendentes' + (overdue ? ' · ' + overdue + ' atrasadas' : '')) +
        quickCard('Cold mail', '/operacao/coldmail', 'Priorização regional') +
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

function quickCard(title, hash, sub) {
  return '<a class="l2-onboard-card" href="#' + hash + '">' +
    '<h4>' + title + '</h4><small>' + sub + '</small></a>';
}
