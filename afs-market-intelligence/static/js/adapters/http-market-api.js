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
    // Flask direto (app.py porta 5001) expõe /api
    if (location.port === '5001') {
      return '/api';
    }
    // Next.js dev: proxy em next.config → /afs-market-api
    return (siteBase ? siteBase : '') + '/afs-market-api';
  }
  return null;
}

export function backendConfigHint() {
  const base = getHttpApiBase();
  if (base) return null;
  if (location.hostname.includes('github.io')) {
    return (
      'Backend Python offline. Ative ENABLE_GCP_CLOUD_RUN=true em GitHub Settings → Variables ' +
      '(repositório Linduro/App-Contabilidade) e rode o workflow "Deploy AFS Market Intelligence (Cloud Run)". ' +
      'Ou execute: .\\scripts\\setup-afs-market-github.ps1 após gh auth login.'
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
