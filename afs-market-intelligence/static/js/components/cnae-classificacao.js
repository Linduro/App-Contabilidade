/**
 * Classificacao CNAE quente / neutro / frio — sync localStorage + API.
 */
import { httpMarketGet, httpMarketPost, getHttpApiBase } from '../adapters/http-market-api.js';

const LS_KEY = 'afs_cnae_classificacao';

export const CNAE_STATUS = {
  quente: { label: 'Quente', cls: 'pm-tag-quente' },
  neutro: { label: 'Neutro', cls: 'pm-tag-neutro' },
  frio: { label: 'Frio', cls: 'pm-tag-frio' },
};

export function loadLocalClassificacao() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveLocalClassificacao(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

export async function fetchClassificacao() {
  if (getHttpApiBase()) {
    try {
      const data = await httpMarketGet('/cnae/classificacao');
      saveLocalClassificacao(data);
      return data;
    } catch (_) {}
  }
  try {
    const r = await fetch('./data/cnae_classificacao.json');
    if (r.ok) {
      const data = await r.json();
      const local = loadLocalClassificacao();
      return { ...data, ...local };
    }
  } catch (_) {}
  return loadLocalClassificacao() || { quente: {}, frio: {}, totais: {} };
}

export async function setDivisaoStatus(codigo, status, nota) {
  if (getHttpApiBase()) {
    try {
      const data = await httpMarketPost('/cnae/classificacao', { codigo, status, nota: nota || '' });
      saveLocalClassificacao(data);
      return data;
    } catch (e) {
      window.AFSToast?.error(e.message || 'Falha ao salvar classificacao');
    }
  }
  const raw = loadLocalClassificacao();
  const quente = { ...(raw.quente || {}) };
  const frio = { ...(raw.frio || {}) };
  const c = String(codigo).padStart(2, '0').slice(0, 2);
  delete quente[c];
  delete frio[c];
  if (status === 'quente') quente[c] = nota || '';
  if (status === 'frio') frio[c] = nota || '';
  const next = { ...raw, quente, frio };
  saveLocalClassificacao(next);
  return next;
}

export function statusForDivisao(codigo, classificacaoData) {
  const c = String(codigo).padStart(2, '0').slice(0, 2);
  if (classificacaoData?.quente?.[c] != null) return 'quente';
  if (classificacaoData?.frio?.[c] != null) return 'frio';
  return 'neutro';
}

export function renderStatusBadge(status) {
  const m = CNAE_STATUS[status] || CNAE_STATUS.neutro;
  return '<span class="pm-tag ' + m.cls + '">' + m.label + '</span>';
}

export function renderPagination(prefix, page, pageSize, total, onPage) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const cur = page + 1;
  const from = total ? page * pageSize + 1 : 0;
  const to = Math.min((page + 1) * pageSize, total);
  return (
    '<div class="pagination-row" data-pager="' + prefix + '">' +
      '<button type="button" class="btn sm" data-page="prev"' + (page <= 0 ? ' disabled' : '') + '>← Anterior</button>' +
      '<span>Página ' + cur + ' de ' + pages + ' · ' + from + '–' + to + ' de ' + total.toLocaleString('pt-BR') + '</span>' +
      '<button type="button" class="btn sm" data-page="next"' + (cur >= pages ? ' disabled' : '') + '>Próxima →</button>' +
    '</div>'
  );
}

export function bindPagination(root, prefix, getPage, setPage, reload) {
  root.querySelector('[data-pager="' + prefix + '"]')?.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    const page = getPage();
    if (btn.getAttribute('data-page') === 'prev' && page > 0) setPage(page - 1);
    if (btn.getAttribute('data-page') === 'next') setPage(page + 1);
    reload();
  });
}

export function formatCnaeCell(cnae, desc) {
  const code = cnae || '—';
  const raw = desc ? String(desc) : '';
  const d = raw.slice(0, 72);
  return '<td class="pm-cnae-cell"><code>' + code + '</code>' +
    (d ? '<br><small class="hint">' + d + (raw.length > 72 ? '…' : '') + '</small>' : '') + '</td>';
}
