/**
 * Stub legado — catálogo sempre vazio (evita cache antigo com SEEDS demo).
 */
export function getCatalog() { return []; }
export function localCount() { return { todas: 0, nao_enriquecidas: 0, enriquecidas: 0, novas: 0 }; }
export function localSearch() { return { total: 0, page: 1, page_size: 25, rows: [] }; }
export function localEnrich() { return { status: 'ok', enfileirados: 0, processamento: { processados: 0, erros: 0 }, total: 0 }; }
export function localContatos() { return []; }
export async function localExecutar() {
  return { status: 'ok', message: 'Base vazia.', processados: 0, enriquecidos_ok: 0, contatos_coletados: 0, empresas: [], counts: { todas: 0, nao_enriquecidas: 0, enriquecidas: 0, novas: 0 } };
}
export async function loadCnaeSetoresLocal() { return { meta: {}, secoes: [], divisoes: [], total: 0 }; }
export function localFetchCnaes() { return []; }
export function localFetchMunicipios() { return []; }
export function localFetchNaturezas() { return []; }
export function localSaveSegmentacao(nome, filtros) { return { id: 'local_' + Date.now(), nome, filtros }; }
export function purgeDemoProspectStorage() {
  try {
    localStorage.removeItem('afs_prospect_enrichment');
    localStorage.removeItem('afs_prospect_segmentacoes');
    localStorage.removeItem('afs_prospect_catalog');
  } catch (_) {}
}
