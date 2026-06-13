/**
 * API do pipeline RF em massa (Cloud Run / local).
 * Complementa BrasilAPI (consulta unitária) com ingestão dos ~230k Lucro Real.
 */

function api() {
  return window.AFSMarketAPI || null;
}

export async function fetchRfStatus() {
  const A = api();
  if (!A) return null;
  return A.get('/rf/status');
}

export async function startRfIngest(opts = {}) {
  const A = api();
  if (!A) throw new Error('API offline — inicie o backend Python (porta 5001) ou configure Cloud Run');
  return A.post('/rf/ingest', {
    skip_download: opts.skipDownload ?? false,
    modo: opts.modo ?? 'completo',
    versao: opts.versao || null,
  });
}

export async function pollJob(jobId, onTick) {
  const A = api();
  if (!A) return null;
  return new Promise((resolve, reject) => {
    const iv = setInterval(async () => {
      try {
        const job = await A.get('/jobs/' + jobId);
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
  const A = api();
  if (!A) return { total: 0, prospectos: [] };
  const q = new URLSearchParams();
  if (params.uf) q.set('uf', params.uf);
  if (params.cluster) q.set('cluster', params.cluster);
  if (params.q) q.set('q', params.q);
  q.set('limite', String(params.limite ?? 100));
  q.set('offset', String(params.offset ?? 0));
  return A.get('/prospectos?' + q.toString());
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
