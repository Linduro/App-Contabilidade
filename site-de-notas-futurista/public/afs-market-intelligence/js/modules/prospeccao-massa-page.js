/** Loader — redireciona para prospeccao-massa-live.js (quebra cache do page antigo). */
export async function renderProspeccaoMassa(ctx) {
  const v = window.__AFS_BUILD__ || Date.now();
  const mod = await import('./prospeccao-massa-live.js?b=' + encodeURIComponent(String(v)) + '&t=' + Date.now());
  return mod.renderProspeccaoMassa(ctx);
}
