/**
 * Detecta e remove leads/empresas fictícios (seed demo, catálogo local antigo, Firestore demo).
 */
import * as store from './store.js';

const DEMO_SEED_NAMES = [
  'agro norte', 'indústria modelo', 'industria modelo', 'supermercados central',
  'techflow software', 'construtora horizonte', 'logtrans cargas', 'hospital vida',
  'banco regional', 'hotel praia', 'energia sul', 'mineração vale verde', 'mineracao vale verde',
  'consultoria alpha', 'metalúrgica forte', 'metalurgica forte', 'distribuidora abc',
  'farmácia popular', 'farmacia popular', 'clínica saúde', 'clinica saude',
  'usina agroíndustrial', 'usina agroindustrial', 'autopeças br', 'autopecas br',
  'seguros protege', 'restaurante sabor',
  'holding patrimonial alfa', 'indústria beta', 'industria beta', 'comércio gamma', 'comercio gamma',
  'serviços delta', 'servicos delta', 'logística épsilon', 'logistica epsilon',
  'investimentos zeta', 'metalúrgica omega', 'metalurgica omega',
  'agro brasil', 'indústria nacional', 'industria nacional', 'rede varejo plus',
];

const DEMO_CNPJ_BASES = new Set([
  '12345678', '98765432', '11223344', '55667788', '33445566',
  '99887766', '44332211', '87654321', '23456789', '34567890',
]);

export function isFictitiousCnpj(cnpj) {
  const b = String(cnpj || '').replace(/\D/g, '').slice(0, 8);
  if (!b || b.length < 8) return false;
  if (DEMO_CNPJ_BASES.has(b)) return true;
  const n = parseInt(b, 10);
  // Catálogo demo gerado: 10000001–10000120
  if (n >= 10000001 && n <= 10000200) return true;
  return false;
}

export function isFictitiousCompany(row) {
  if (!row || typeof row !== 'object') return false;
  if (/^ld_[1-9]$/.test(String(row.id || ''))) return true;
  if (/^co_[12]$/.test(String(row.id || ''))) return true;
  if (isFictitiousCnpj(row.cnpj_basico || row.cnpj)) return true;
  const razao = String(row.razao_social || row.nome || row.nome_fantasia || '').toLowerCase().trim();
  if (!razao) return false;
  if (DEMO_SEED_NAMES.some(function (n) { return razao.includes(n); })) return true;
  // Variantes numeradas do catálogo demo: "Restaurante Sabor 2 LTDA", "Agro Norte 3 LTDA"
  if (/ \d{1,2} ltda$/.test(razao) && DEMO_SEED_NAMES.some(function (n) {
    const base = n.replace(/\s+\d+$/, '');
    return razao.startsWith(base);
  })) return true;
  if (/^[\w\s]+ \d{1,2} ltda$/.test(razao) && isFictitiousCnpj(row.cnpj_basico || row.cnpj)) return true;
  return false;
}

function filterCollection(name, predicate) {
  const db = store.getDb();
  const arr = db.collections[name] || [];
  const kept = arr.filter(function (r) { return !predicate(r); });
  const removed = arr.length - kept.length;
  if (removed) db.collections[name] = kept;
  return removed;
}

function purgeRelatedRecords(db) {
  const leadIds = new Set((db.collections.leads || []).map(function (l) { return l.id; }));
  let n = 0;

  ['deals', 'activities', 'conversations'].forEach(function (col) {
    const before = (db.collections[col] || []).length;
    db.collections[col] = (db.collections[col] || []).filter(function (r) {
      if (/^deal_[1-4]$/.test(String(r.id || ''))) return false;
      if (/^act_[1-5]$/.test(String(r.id || ''))) return false;
      if (/^conv_[1-3]$/.test(String(r.id || ''))) return false;
      if (r.lead_id && !leadIds.has(r.lead_id)) return false;
      return true;
    });
    n += before - db.collections[col].length;
  });

  const convIds = new Set((db.collections.conversations || []).map(function (c) { return c.id; }));
  const beforeMsg = (db.collections.messages || []).length;
  db.collections.messages = (db.collections.messages || []).filter(function (m) {
    if (/^msg_[1-4]$/.test(String(m.id || ''))) return false;
    return convIds.has(m.conversation_id);
  });
  n += beforeMsg - db.collections.messages.length;
  return n;
}

export function purgeEnrichmentStorage() {
  const key = 'afs_prospect_enrichment';
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const data = JSON.parse(raw);
    let n = 0;
    let hasDemo = false;
    Object.keys(data).forEach(function (cnpj) {
      if (isFictitiousCnpj(cnpj)) {
        delete data[cnpj];
        n++;
        hasDemo = true;
      }
    });
    // Se havia demo, apaga tudo — enriquecimento local era simulado
    if (hasDemo || n > 0) {
      localStorage.removeItem(key);
      return Math.max(n, 1);
    }
    return 0;
  } catch (_) {
    try { localStorage.removeItem(key); } catch (_) {}
    return 0;
  }
}

/** Limpa todo armazenamento de prospecção demo no navegador. */
export function purgeAllProspectDemoStorage() {
  let n = 0;
  ['afs_prospect_enrichment', 'afs_prospect_segmentacoes', 'afs_prospect_catalog'].forEach(function (k) {
    try {
      if (localStorage.getItem(k)) {
        localStorage.removeItem(k);
        n++;
      }
    } catch (_) {}
  });
  return n;
}

/** Remove fictícios do CRM local e enriquecimento demo. Retorna totais removidos. */
export function purgeFictitiousData() {
  const stats = { leads: 0, companies: 0, related: 0, enrichment: 0, storage: 0 };

  stats.leads = filterCollection('leads', isFictitiousCompany);
  stats.companies = filterCollection('companies', isFictitiousCompany);

  const db = store.getDb();
  stats.related = purgeRelatedRecords(db);

  if (stats.leads || stats.companies || stats.related) {
    store.replaceDb(db);
  }

  stats.enrichment = purgeEnrichmentStorage();
  stats.storage = purgeAllProspectDemoStorage();
  return stats;
}

export function filterRealLeads(rows) {
  return (rows || []).filter(function (r) { return !isFictitiousCompany(r); });
}
