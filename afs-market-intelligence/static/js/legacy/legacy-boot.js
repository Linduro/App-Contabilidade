/**
 * Monta UI legada (#/legacy) — app monolítico anterior.
 */
let legacyReady = false;

export async function mountLegacy() {
  const root = document.getElementById('legacy-root');
  const appRoot = document.getElementById('app-root');
  if (!root) return;

  appRoot?.classList.add('hidden');
  root.classList.remove('hidden');

  if (!legacyReady) {
    const res = await fetch('./legacy/page.html?t=' + Date.now());
    if (!res.ok) throw new Error('legacy/page.html não encontrado');
    root.innerHTML = await res.text();

    await import('../browser-api.js');
    await import('./app.js');
    if (window.AFS_bootApp) await window.AFS_bootApp();
    legacyReady = true;
  }

  const legacyApp = root.querySelector('#afs-app') || root.querySelector('.app-shell');
  legacyApp?.classList.remove('hidden');
}

export function unmountLegacy() {
  document.getElementById('legacy-root')?.classList.add('hidden');
  document.getElementById('app-root')?.classList.remove('hidden');
}
