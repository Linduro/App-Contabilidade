/**
 * Camada de dados AFS Market v2 — localStorage + pub/sub.
 */
const STORAGE_KEY = 'afs_market_v2';

const COLLECTIONS = [
  'leads', 'deals', 'pipelines', 'stages', 'activities', 'contacts', 'companies',
  'products', 'quotes', 'orders', 'clients', 'conversations', 'messages',
  'segmentations', 'emailTemplates', 'messageTemplates', 'automations', 'automationRuns',
  'campaigns', 'goals', 'reports', 'partners', 'users', 'tags', 'customFields',
  'landingPages', 'forms', 'documents',
];

const listeners = new Set();

function emptyDb() {
  const collections = {};
  COLLECTIONS.forEach((c) => { collections[c] = []; });
  return {
    meta: { version: 2, seededAt: null, firestoreImportedAt: null },
    settings: {
      scoring: { capital: 5, filiais: 5, regime: 5, cnae: 5, porte: 5 },
      theme: 'dark',
    },
    collections,
  };
}

function loadRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('[AFS-ERROR] store.load', e);
    return null;
  }
}

function saveRaw(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  listeners.forEach((fn) => {
    try { fn(db); } catch (e) { console.error('[AFS-ERROR] store listener', e); }
  });
}

let _db = loadRaw() || emptyDb();

export function getDb() {
  return _db;
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function list(collection, opts) {
  opts = opts || {};
  let rows = [...(_db.collections[collection] || [])];
  if (opts.filter && typeof opts.filter === 'function') {
    rows = rows.filter(opts.filter);
  }
  if (opts.sort) {
    const { key, dir } = opts.sort;
    rows.sort((a, b) => {
      const av = a[key]; const bv = b[key];
      if (av < bv) return dir === 'desc' ? 1 : -1;
      if (av > bv) return dir === 'desc' ? -1 : 1;
      return 0;
    });
  }
  const total = rows.length;
  const page = opts.page || 1;
  const limit = opts.limit || total;
  const start = (page - 1) * limit;
  if (opts.limit) rows = rows.slice(start, start + limit);
  return { rows, total, page, limit };
}

export function get(collection, id) {
  return (_db.collections[collection] || []).find((r) => r.id === id) || null;
}

export function create(collection, doc) {
  const row = { ...doc, id: doc.id || uid(collection), criado_em: doc.criado_em || new Date().toISOString(), atualizado_em: new Date().toISOString() };
  _db.collections[collection] = _db.collections[collection] || [];
  _db.collections[collection].push(row);
  saveRaw(_db);
  return row;
}

export function update(collection, id, patch) {
  const arr = _db.collections[collection] || [];
  const i = arr.findIndex((r) => r.id === id);
  if (i < 0) return null;
  arr[i] = { ...arr[i], ...patch, atualizado_em: new Date().toISOString() };
  saveRaw(_db);
  return arr[i];
}

export function remove(collection, id) {
  const arr = _db.collections[collection] || [];
  const next = arr.filter((r) => r.id !== id);
  if (next.length === arr.length) return false;
  _db.collections[collection] = next;
  saveRaw(_db);
  return true;
}

export function bulkUpsert(collection, docs) {
  const arr = _db.collections[collection] || [];
  const byId = new Map(arr.map((r) => [r.id, r]));
  docs.forEach((d) => {
    const id = d.id || uid(collection);
    byId.set(id, { ...byId.get(id), ...d, id, atualizado_em: new Date().toISOString() });
  });
  _db.collections[collection] = [...byId.values()];
  saveRaw(_db);
}

export function setMeta(patch) {
  _db.meta = { ..._db.meta, ...patch };
  saveRaw(_db);
}

export function getSettings() {
  return _db.settings || {};
}

export function setSettings(patch) {
  _db.settings = { ..._db.settings, ...patch };
  saveRaw(_db);
}

export function replaceDb(db) {
  _db = db;
  saveRaw(_db);
}

export function count(collection, filter) {
  return list(collection, { filter }).total;
}

export function searchGlobal(term) {
  const q = String(term || '').toLowerCase().trim();
  if (!q) return { leads: [], deals: [], contacts: [] };
  const match = (s) => String(s || '').toLowerCase().includes(q);
  return {
    leads: list('leads', { filter: (l) => match(l.razao_social) || match(l.cnpj_basico) }).rows.slice(0, 8),
    deals: list('deals', { filter: (d) => match(d.titulo) }).rows.slice(0, 8),
    contacts: list('contacts', { filter: (c) => match(c.nome) || match(c.email) }).rows.slice(0, 8),
  };
}

window.AFSStore = { list, get, create, update, remove, bulkUpsert, count, searchGlobal, onChange, getDb, setMeta, getSettings, setSettings };
