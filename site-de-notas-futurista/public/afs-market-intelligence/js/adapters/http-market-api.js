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
  return (
    'Backend Python não configurado. Opções: (1) Local: na pasta afs-market-intelligence rode ' +
    'pip install -r requirements.txt && python app.py — porta 5001. ' +
    '(2) Portal dev: npm run dev em site-de-notas-futurista (proxy /afs-market-api). ' +
    '(3) Produção: configure apiBase em public/afs-market-intelligence/config.json com a URL do Cloud Run.'
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
