/**
 * Import único do Firestore na primeira carga (opcional).
 */
import * as store from '../core/store.js';

export async function importFirestoreOnceIfNeeded() {
  const db = store.getDb();
  if (db.meta.firestoreImportedAt) return { skipped: true };

  try {
    await import('../browser-api.js');
    const api = window.AFSMarketAPI;
    if (!api || !api.get) return { skipped: true, reason: 'no-api' };

    const [leadsRes, partnersRes] = await Promise.all([
      api.get('/leads?limite=500').catch(() => ({ leads: [] })),
      api.get('/parceiros').catch(() => ({ parceiros: [] })),
    ]);

    const leads = (leadsRes.leads || []).map((l) => ({
      ...l,
      id: l.id || ('fs_' + (l.cnpj_basico || Math.random().toString(36).slice(2))),
      atualizado_em: new Date().toISOString(),
    }));

    const partners = (partnersRes.parceiros || partnersRes || []).map((p) => ({
      ...p,
      id: p.id || ('fs_p_' + Math.random().toString(36).slice(2)),
    }));

    if (leads.length) store.bulkUpsert('leads', leads);
    if (partners.length) store.bulkUpsert('partners', partners);

    store.setMeta({ firestoreImportedAt: new Date().toISOString() });
    return { imported: true, leads: leads.length, partners: partners.length };
  } catch (e) {
    console.warn('[AFS] import Firestore ignorado', e);
    store.setMeta({ firestoreImportedAt: 'skipped-error' });
    return { error: true };
  }
}
