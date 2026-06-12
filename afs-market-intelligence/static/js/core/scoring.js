import * as store from './store.js';

const DEFAULT_PESOS = { capital: 5, filiais: 5, regime: 5, cnae: 5, porte: 5 };

const REGIME_BONUS = { LR: 2, LP: 1, SN: 0 };
const PORTE_BONUS = { GRANDE: 1.5, MEDIO: 1, EPP: 0.5, ME: 0.2, MEI: 0 };

export function getPesos() {
  return { ...DEFAULT_PESOS, ...(store.getSettings().scoring || {}) };
}

export function computeScore(lead, pesos) {
  pesos = pesos || getPesos();
  const cap = Number(lead.capital_social) || 0;
  const filiais = Number(lead.qtd_filiais) || 0;
  const regime = lead.regime_tributario || '';
  const porte = lead.porte_empresa || '';

  let score =
    (cap > 0 ? Math.log10(cap + 1) : 0) * (pesos.capital / 5) +
    filiais * 0.35 * (pesos.filiais / 5) +
    (REGIME_BONUS[regime] || 0) * (pesos.regime / 5) +
    (PORTE_BONUS[porte] || 0) * (pesos.porte / 5);

  if (lead.transicao_regime) score += 1.5 * (pesos.regime / 5);
  if (lead.email && String(lead.email).includes('@')) score += 0.5;
  if (lead.situacao_cadastral === 'ATIVA') score += 0.3;

  const cnae = String(lead.cnae_codigo || '');
  if (/^64|^66|^68/.test(cnae.replace(/\D/g, ''))) score += 0.8 * (pesos.cnae / 5);

  return Math.min(10, Math.round(score * 10) / 10);
}

export function recalculateAllScores() {
  const pesos = getPesos();
  const leads = store.list('leads').rows;
  leads.forEach((l) => {
    store.update('leads', l.id, { score: computeScore(l, pesos) });
  });
  return leads.length;
}
