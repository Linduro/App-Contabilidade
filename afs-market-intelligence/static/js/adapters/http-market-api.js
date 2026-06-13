/**
 * Cliente HTTP para o backend Python (Flask) — ingestão RF, prospectos, export.
 * Separado do browser-api.js (Firestore) usado pelo CRM.
 */

export function getHttpApiBase() {
  const raw = window.__AFS_MARKET_API_BASE__;
  if (raw && String(raw).trim()) {
    const b = String(raw).replace(/\/$/, '');
    return b.endsWith('/api') ? b : b + '/api';
  }
  const siteBase = (window.__AFS_BASE_PATH__ || '').replace(/\/$/, '');
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return siteBase + '/afs-market-api';
  }
  return null;
}

export function backendConfigHint() {
  const base = getHttpApiBase();
  if (base) return null;
  if (location.hostname.includes('github.io')) {
    return (
      'Produção (GitHub Pages): configure a variável AFS_MARKET_API_URL no repositório GitHub ' +
      '(Settings → Secrets and variables → Actions → Variables) com a URL do Cloud Run, ' +
      'ex: https://afs-market-intelligence-xxxxx.run.app. Depois faça redeploy do portal. ' +
      'Também ative ENABLE_GCP_CLOUD_RUN=true para publicar o backend.'
    );
  }
  return (
    'Backend Python não configurado. Local: cd afs-market-intelligence && pip install -r requirements.txt && python app.py'
  );
}

export async function httpMarketGet(path) {
  const base = getHttpApiBase();
  if (!base) return null;
  const p = path.startsWith('/') ? path : '/' + path;
  const res = await fetch(base + p, { credentials: 'same-origin' });
  if (!res.ok) {
    const err = await res.json().catch(function () { return {}; });
    throw new Error(err.message || 'HTTP ' + res.status + ' em ' + p);
  }
  return res.json();
}

export async function httpMarketPost(path, body) {
  const base = getHttpApiBase();
  if (!base) throw new Error(backendConfigHint() || 'API offline');
  const p = path.startsWith('/') ? path : '/' + path;
  const res = await fetch(base + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(function () { return {}; });
    throw new Error(err.message || 'HTTP ' + res.status + ' em ' + p);
  }
  return res.json();
}

export async function pingHttpBackend() {
  try {
    const data = await httpMarketGet('/rf/status');
    const online = Boolean(data && !data.status?.includes?.('error') && !data.message?.includes?.('error'));
    return { online: online || data?.prospectos_carregados != null || data?.universo != null, data };
  } catch (e) {
    return { online: false, error: e.message };
  }
}

export function downloadUrl(filename) {
  const base = getHttpApiBase();
  if (!base || !filename) return null;
  return base + '/export/download/' + encodeURIComponent(filename);
}
