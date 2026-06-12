/**
 * Consulta CNPJ via BrasilAPI (dados abertos da Receita Federal — gratuito).
 * https://brasilapi.com.br/docs#tag/CNPJ
 */

const BASE = 'https://brasilapi.com.br/api/cnpj/v1';

export function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatCnae(code) {
  if (!code) return '';
  const s = String(code).replace(/\D/g, '').padStart(7, '0');
  return s.slice(0, 4) + '-' + s[4] + '/' + s.slice(5);
}

function mapPorte(data) {
  const map = { 1: 'ME', 3: 'EPP', 5: 'GRANDE' };
  if (data.opcao_pelo_mei) return 'MEI';
  const code = data.codigo_porte;
  if (map[code]) return map[code];
  const cap = Number(data.capital_social) || 0;
  if (cap >= 5000000) return 'GRANDE';
  if (cap >= 500000) return 'MEDIO';
  return 'ME';
}

function mapRegime(data) {
  if (data.opcao_pelo_simples) return 'SN';
  const hist = Array.isArray(data.regime_tributario) ? data.regime_tributario : [];
  const latest = hist.length ? hist[hist.length - 1] : null;
  const forma = String(latest?.forma_de_tributacao || '').toUpperCase();
  if (forma.includes('REAL')) return 'LR';
  if (forma.includes('PRESUMIDO')) return 'LP';
  if (forma.includes('SIMPLES')) return 'SN';
  return 'LP';
}

function mapSituacao(data) {
  const s = String(data.descricao_situacao_cadastral || '').toUpperCase();
  if (s.includes('ATIVA')) return 'ATIVA';
  if (s.includes('BAIXADA')) return 'BAIXADA';
  if (s.includes('INAPTA')) return 'INAPTA';
  if (s.includes('SUSPENSA')) return 'SUSPENSA';
  return s || 'ATIVA';
}

function pickPhone(data) {
  const raw = String(data.ddd_telefone_1 || data.ddd_fax || '').replace(/\D/g, '');
  if (raw.length < 10) return null;
  const ddd = raw.slice(0, 2);
  const num = raw.slice(2);
  return '(' + ddd + ') ' + num.slice(0, num.length - 4) + '-' + num.slice(-4);
}

function mapQsa(qsa) {
  if (!Array.isArray(qsa)) return [];
  return qsa.map((q) => ({
    nome: q.nome_socio,
    qualificacao: q.qualificacao_socio || String(q.codigo_qualificacao_socio || ''),
  }));
}

export function mapBrasilApiToAfs(data) {
  const cnpj = onlyDigits(data.cnpj);
  return {
    cnpj_basico: cnpj,
    cnpj,
    razao_social: data.razao_social || data.nome_fantasia || '',
    nome: data.razao_social || data.nome_fantasia || '',
    nome_fantasia: data.nome_fantasia || '',
    cnae_codigo: formatCnae(data.cnae_fiscal),
    cnae_descricao: data.cnae_fiscal_descricao || '',
    regime_tributario: mapRegime(data),
    porte_empresa: mapPorte(data),
    capital_social: Number(data.capital_social) || 0,
    uf: data.uf || '',
    municipio: data.municipio || '',
    cep: data.cep || '',
    logradouro: data.logradouro || '',
    situacao_cadastral: mapSituacao(data),
    telefone: pickPhone(data),
    email: data.email && String(data.email).includes('@') ? data.email.trim().toLowerCase() : '',
    data_abertura: data.data_inicio_atividade || null,
    socios: mapQsa(data.qsa),
    natureza_juridica: data.natureza_juridica || '',
    matriz_filial: data.descricao_identificador_matriz_filial || '',
    fonte_rf: 'brasilapi',
    rf_consultado_em: new Date().toISOString(),
    dados_brutos_rf: data,
  };
}

export async function fetchCnpjRf(cnpj, opts) {
  opts = opts || {};
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) {
    throw new Error('CNPJ deve ter 14 dígitos');
  }

  const url = BASE + '/' + digits;
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: opts.signal,
  });

  if (response.status === 404) return null;
  if (response.status === 429) {
    throw new Error('Limite da BrasilAPI atingido — aguarde e tente de novo');
  }
  if (!response.ok) {
    throw new Error('BrasilAPI HTTP ' + response.status);
  }

  const data = await response.json();
  return mapBrasilApiToAfs(data);
}

export function parseCnpjList(text) {
  const found = new Set();
  String(text || '').split(/[\s,;]+/).forEach((chunk) => {
    const d = onlyDigits(chunk);
    if (d.length === 14) found.add(d);
  });
  return [...found];
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Importa lista de CNPJs com intervalo entre chamadas (evita 429). */
export async function fetchCnpjBatch(cnpjs, opts) {
  opts = opts || {};
  const delayMs = opts.delayMs ?? 1200;
  const onProgress = opts.onProgress || (() => {});
  const results = { ok: [], skipped: [], errors: [] };

  for (let i = 0; i < cnpjs.length; i++) {
    if (opts.signal?.aborted) break;
    const cnpj = cnpjs[i];
    try {
      const row = await fetchCnpjRf(cnpj, { signal: opts.signal });
      if (row) results.ok.push(row);
      else results.skipped.push({ cnpj, reason: 'não encontrado' });
    } catch (e) {
      results.errors.push({ cnpj, error: e.message || String(e) });
    }
    onProgress(i + 1, cnpjs.length, results);
    if (i < cnpjs.length - 1) await sleep(delayMs);
  }
  return results;
}
