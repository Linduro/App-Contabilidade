import * as store from '../core/store.js';
import { NAV_SECTIONS, SHORTCUTS } from './nav-config.js';

function navActive(currentPath, itemHash) {
  if (itemHash === '/prospeccao/busca') {
    return currentPath === '/prospeccao' || currentPath === '/prospeccao/busca' ||
      currentPath === '/prospeccao/massa' || currentPath === '/prospeccao/operacoes';
  }
  return currentPath === itemHash || currentPath.startsWith(itemHash + '/');
}

export function renderSidebar(el, currentPath) {
  const overdue = store.count('activities', (a) => a.status === 'atrasada');
  const leads = store.count('leads');
  const deals = store.count('deals');

  function isActive(hash, shortcut) {
    if (hash === '/prospeccao/busca') return navActive(currentPath, hash);
    if (currentPath === hash) return true;
    if (shortcut && hash === '/lab/ingestao' && (currentPath === '/lab' || currentPath.startsWith('/lab/'))) return true;
    if (hash !== '/apps' && hash !== '/lab/ingestao' && currentPath.startsWith(hash + '/')) return true;
    return false;
  }

  function badgeFor(hash) {
    if (hash === '/tarefas' && overdue > 0) return '<span class="l2-badge">' + overdue + '</span>';
    if (hash === '/comunicacao/inbox') {
      const unread = store.count('conversations', (c) => (c.nao_lidas || 0) > 0);
      if (unread > 0) return '<span class="l2-badge">' + unread + '</span>';
    }
    return '';
  }

  el.innerHTML =
    '<div class="l2-brand">' +
      '<div class="brand-icon">AFS</div>' +
      '<div><strong>Market Intelligence</strong><small>Asset Flow Solutions</small></div>' +
    '</div>' +
    '<div class="l2-sidebar-stats">' +
      '<span>' + leads + ' leads</span><span>' + deals + ' negócios</span>' +
    '</div>' +
    '<div class="l2-nav-section"><div class="l2-nav-title">Atalhos</div>' +
      SHORTCUTS.map(function (item) {
        const active = isActive(item.hash, true);
        return '<a class="l2-nav-item' + (active ? ' active' : '') + (item.highlight ? ' l2-nav-highlight' : '') + '" href="#' + item.hash + '">' +
          '<span class="l2-nav-icon">' + item.icon + '</span>' + item.label + '</a>';
      }).join('') +
    '</div>' +
    NAV_SECTIONS.map(function (sec) {
      return '<div class="l2-nav-section l2-nav-section-' + sec.id + '">' +
        '<div class="l2-nav-title" title="' + sec.subtitle + '">' + sec.title + '</div>' +
        sec.items.map(function (item) {
          const active = isActive(item.hash);
          return '<a class="l2-nav-item' + (active ? ' active' : '') + (item.highlight ? ' l2-nav-highlight' : '') + '" href="#' + item.hash + '">' +
            '<span class="l2-nav-icon">' + item.icon + '</span>' + item.label + badgeFor(item.hash) + '</a>';
        }).join('') +
      '</div>';
    }).join('') +
    '<div class="l2-sidebar-foot">' +
      '<div class="l2-onboarding"><small>Guias do usuário</small><div class="l2-progress"><div style="width:35%"></div></div></div>' +
      '<a class="l2-nav-item" href="#">Central de ajuda</a>' +
    '</div>';
}
