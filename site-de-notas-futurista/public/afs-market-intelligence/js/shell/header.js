import * as store from '../core/store.js';

export function renderHeader(el, title, currentPath) {
  const user = store.list('users').rows[0];
  el.innerHTML =
    '<div class="l2-header-left">' +
      '<button type="button" class="l2-icon-btn" id="l2-toggle-sidebar" aria-label="Menu">☰</button>' +
      '<nav class="l2-header-tabs">' +
        '<a href="#/apps" class="' + (currentPath === '/apps' ? 'active' : '') + '">Apps</a>' +
        '<a href="#/prospeccao">Prospecção</a>' +
        '<a href="#/crm/pipelines">Pipelines</a>' +
      '</nav>' +
    '</div>' +
    '<div class="l2-header-center">' +
      '<input type="search" id="l2-global-search" placeholder="Buscar leads, negócios, contatos…" autocomplete="off" />' +
      '<div id="l2-search-results" class="l2-search-dropdown hidden"></div>' +
    '</div>' +
    '<div class="l2-header-right">' +
      '<button type="button" class="l2-icon-btn l2-btn-plus" id="l2-quick-create" title="Criar">+</button>' +
      '<button type="button" class="l2-icon-btn" title="IA (em breve)">✦</button>' +
      '<button type="button" class="l2-icon-btn" title="WhatsApp (registro manual)">💬</button>' +
      '<a href="#/configuracoes" class="l2-icon-btn" title="Configurações">⚙</a>' +
      '<span class="l2-avatar" title="' + (user?.email || '') + '">' + (user?.nome?.[0] || 'A') + '</span>' +
    '</div>';

  const search = el.querySelector('#l2-global-search');
  const dropdown = el.querySelector('#l2-search-results');
  let timer;
  search?.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () {
      const q = search.value.trim();
      if (!q) { dropdown.classList.add('hidden'); return; }
      const r = store.searchGlobal(q);
      const html = ['leads', 'deals', 'contacts'].map(function (kind) {
        const rows = r[kind];
        if (!rows.length) return '';
        return '<div class="l2-search-group">' + kind.toUpperCase() + rows.map(function (row) {
          const label = row.razao_social || row.titulo || row.nome || row.id;
          return '<a href="#/crm/leads" class="l2-search-item">' + label + '</a>';
        }).join('') + '</div>';
      }).join('');
      dropdown.innerHTML = html || '<div class="l2-search-item muted">Nenhum resultado</div>';
      dropdown.classList.remove('hidden');
    }, 200);
  });

  el.querySelector('#l2-toggle-sidebar')?.addEventListener('click', function () {
    document.getElementById('l2-sidebar')?.classList.toggle('collapsed');
  });

  el.querySelector('#l2-quick-create')?.addEventListener('click', function () {
    window.AFSToast?.info('Criação rápida — módulo CRM em construção');
  });
}
