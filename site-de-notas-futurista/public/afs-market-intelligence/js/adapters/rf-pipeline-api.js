/**
 * API do pipeline RF em massa (Cloud Run / local Python).
 */
import {
  getHttpApiBase, httpMarketGet, httpMarketPost, pingHttpBackend,
  backendConfigHint, downloadUrl,
} from './http-market-api.js';

export { pingHttpBackend, getHttpApiBase, backendConfigHint, downloadUrl };

export async function fetchRfStatus() {
  try {
    return await httpMarketGet('/rf/status');
  } catch (_) {
    return null;
  }
}

export async function startRfIngest(opts = {}) {
  if (!getHttpApiBase()) {
    throw new Error(backendConfigHint() || 'API offline — inicie o backend Python (porta 5001) ou configure Cloud Run');
  }
  return httpMarketPost('/rf/ingest', {
    skip_download: opts.skipDownload ?? false,
    modo: opts.modo ?? 'completo',
    versao: opts.versao || null,
  });
}

export async function pollJob(jobId, onTick) {
  if (!getHttpApiBase()) return null;
  return new Promise(function (resolve, reject) {
    const iv = setInterval(async function () {
      try {
        const job = await httpMarketGet('/jobs/' + jobId);
        onTick?.(job);
        if (job.status === 'done') { clearInterval(iv); resolve(job); }
        if (job.status === 'error') { clearInterval(iv); reject(new Error(job.error || job.message || 'Job falhou')); }
      } catch (e) {
        clearInterval(iv);
        reject(e);
      }
    }, 4000);
  });
}

export async function fetchProspectos(params = {}) {
  if (!getHttpApiBase()) return { total: 0, prospectos: [] };
  const q = new URLSearchParams();
  if (params.uf) q.set('uf', params.uf);
  if (params.cluster) q.set('cluster', params.cluster);
  if (params.q) q.set('q', params.q);
  q.set('limite', String(params.limite ?? 100));
  q.set('offset', String(params.offset ?? 0));
  return httpMarketGet('/prospectos?' + q.toString());
}

export async function exportProspectosExcel(opts = {}) {
  const result = await httpMarketPost('/export/prospectos', {
    uf: opts.uf || null,
    cluster: opts.cluster || null,
    limite: opts.limite ?? 50000,
    q: opts.q || null,
  });
  if (result.status !== 'ok') throw new Error(result.message || 'Falha na exportação');
  const url = downloadUrl(result.filename);
  if (url) {
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.click();
  }
  return result;
}

export function mapProspectoToStore(p) {
  return {
    cnpj_basico: p.cnpj_basico,
    cnpj: p.cnpj_matriz || p.cnpj_basico,
    razao_social: p.razao_social,
    nome: p.razao_social,
    cnae_codigo: p.cnae,
    cnae_descricao: p.cnae_descricao,
    regime_tributario: 'LR',
    porte_empresa: p.porte || '',
    capital_social: p.capital_social,
    uf: p.uf,
    municipio: p.municipio,
    telefone: p.telefone_matriz,
    email: p.email_matriz || (p.emails_encontrados || '').split(';')[0]?.trim(),
    endereco: p.endereco_matriz,
    socios: p.socios_chave,
    qtd_filiais: p.qtd_filiais,
    score: p.score,
    cluster: p.cluster,
    fonte_rf: 'receita_federal_bulk',
    rf_consultado_em: new Date().toISOString(),
    origem: 'receita_federal',
    perfil_icp: 'patrimonial',
    status_funil: 'prospectado',
    responsavel_id: 'u_owner',
  };
}

export const PROSPECT_EXPORT_COLS = [
  { key: 'cnpj_basico', label: 'CNPJ' },
  { key: 'cnpj_matriz', label: 'CNPJ Matriz' },
  { key: 'razao_social', label: 'Razão Social' },
  { key: 'cnae', label: 'CNAE' },
  { key: 'cnae_descricao', label: 'Descrição CNAE' },
  { key: 'cluster', label: 'Cluster' },
  { key: 'capital_social', label: 'Capital Social' },
  { key: 'uf', label: 'UF' },
  { key: 'municipio', label: 'Município' },
  { key: 'email_matriz', label: 'E-mail' },
  { key: 'telefone_matriz', label: 'Telefone' },
  { key: 'endereco_matriz', label: 'Endereço' },
  { key: 'socios_chave', label: 'Sócios' },
  { key: 'qtd_filiais', label: 'Filiais' },
  { key: 'score', label: 'Score' },
];
