let drawerEl = null;

export function ensureDrawer() {
  if (drawerEl) return drawerEl;
  const wrap = document.createElement('div');
  wrap.innerHTML =
    '<div id="l2-drawer-overlay" class="l2-drawer-overlay"></div>' +
    '<aside id="l2-drawer" class="l2-drawer">' +
      '<div class="l2-drawer-head"><h3 id="l2-drawer-title"></h3><button type="button" class="l2-icon-btn" id="l2-drawer-close">✕</button></div>' +
      '<div id="l2-drawer-body" class="l2-drawer-body"></div>' +
    '</aside>';
  document.body.appendChild(wrap.firstElementChild);
  document.body.appendChild(wrap.lastElementChild);
  drawerEl = document.getElementById('l2-drawer');
  document.getElementById('l2-drawer-close')?.addEventListener('click', closeDrawer);
  document.getElementById('l2-drawer-overlay')?.addEventListener('click', closeDrawer);
  return drawerEl;
}

export function openDrawer(title, html) {
  ensureDrawer();
  document.getElementById('l2-drawer-title').textContent = title;
  document.getElementById('l2-drawer-body').innerHTML = html;
  document.getElementById('l2-drawer-overlay')?.classList.add('open');
  drawerEl?.classList.add('open');
}

export function closeDrawer() {
  document.getElementById('l2-drawer-overlay')?.classList.remove('open');
  drawerEl?.classList.remove('open');
}
