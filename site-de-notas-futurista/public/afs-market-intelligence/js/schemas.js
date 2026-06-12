/**
 * Esquemas das coleções AFS Market Intelligence (Bloco 1).
 */
export const AFS_COLLECTIONS = {
  leads: 'leads',
  historico_contato: 'historico_contato',
  parceiros: 'parceiros',
  configuracoes: 'configuracoes',
};

export const LEAD_REQUIRED = ['cnpj_basico', 'razao_social', 'perfil_icp', 'status_funil'];
export const LEAD_REGIMES = ['SN', 'LP', 'LR'];
export const LEAD_PORTES = ['MEI', 'ME', 'EPP', 'MEDIO', 'GRANDE'];
export const LEAD_SITUACOES = ['ATIVA', 'INAPTA', 'BAIXADA', 'SUSPENSA'];
export const FUNIL_STATUS = [
  'prospectado', 'contato_feito', 'proposta_enviada', 'negociacao',
  'fechado', 'perdido', 'dead_zone',
];
export const HISTORICO_OUTCOMES = [
  'positivo', 'negativo', 'sem_resposta', 'reuniao', 'indicacao_b2b2b', 'reativado',
];

export function validateLeadPayload(data) {
  const missing = LEAD_REQUIRED.filter((k) => data[k] == null || data[k] === '');
  if (missing.length) return { ok: false, error: 'Campos obrigatórios: ' + missing.join(', ') };
  if (data.regime_tributario && !LEAD_REGIMES.includes(data.regime_tributario)) {
    return { ok: false, error: 'regime_tributario inválido' };
  }
  if (data.porte_empresa && !LEAD_PORTES.includes(data.porte_empresa)) {
    return { ok: false, error: 'porte_empresa inválido' };
  }
  if (data.status_funil && !FUNIL_STATUS.includes(data.status_funil)) {
    return { ok: false, error: 'status_funil inválido' };
  }
  return { ok: true };
}

export function validateHistoricoPayload(data) {
  if (!data.lead_id && !data.leadId) return { ok: false, error: 'lead_id obrigatório' };
  if (data.outcome && !HISTORICO_OUTCOMES.includes(data.outcome)) {
    return { ok: false, error: 'outcome inválido' };
  }
  return { ok: true };
}

export function validateLeadPartial(data) {
  if (data.regime_tributario && !LEAD_REGIMES.includes(data.regime_tributario)) {
    return { ok: false, error: 'regime_tributario inválido' };
  }
  if (data.porte_empresa && !LEAD_PORTES.includes(data.porte_empresa)) {
    return { ok: false, error: 'porte_empresa inválido' };
  }
  if (data.status_funil && !FUNIL_STATUS.includes(data.status_funil)) {
    return { ok: false, error: 'status_funil inválido' };
  }
  return { ok: true };
}
