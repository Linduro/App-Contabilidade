/**
 * Consulta unitária por CNPJ (BrasilAPI) — absorvida pela Busca de Leads.
 */
import * as store from '../core/store.js';
import { fetchCnpjRf, fetchCnpjBatch, onlyDigits, parseCnpjList } from '../adapters/brasilapi-cnpj.js';
import { computeScore } from '../core/scoring.js';

let rfAbort = null;

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function saveRfRecord(row, asLead) {
  const payload = {
    cnpj_basico: row.cnpj_basico,
    razao_social: row.razao_social,
    cnae_codigo: row.cnae_codigo,
    cnae_descricao: row.cnae_descricao,
    regime_tributario: row.regime_tributario,
    porte_empresa: row.porte_empresa,
    capital_social: row.capital_social,
    uf: row.uf,
    municipio: row.municipio,
    telefone: row.telefone,
    email: row.email,
    situacao_cadastral: row.situacao_cadastral,
    data_abertura: row.data_abertura,
    socios: row.socios,
    fonte_rf: row.fonte_rf,
    rf_consultado_em: row.rf_consultado_em,
    perfil_icp: 'patrimonial',
    status_funil: 'prospectado',
    origem: 'receita_federal',
    responsavel_id: 'u_owner',
  };
  payload.score = computeScore(payload);

  if (asLead) {
    const existing = store.list('leads', { filter: (l) => onlyDigits(l.cnpj_basico) === row.cnpj_basico }).rows[0];
    if (existing) {
      store.update('leads', existing.id, { ...payload, status_funil: existing.status_funil });
      return { action: 'updated', id: existing.id };
    }
    return { action: 'created', row: store.create('leads', payload) };
  }

  const existingCo = store.list('companies', { filter: (c) => onlyDigits(c.cnpj) === row.cnpj_basico }).rows[0];
  const coPayload = { cnpj: row.cnpj_basico, nome: row.razao_social, ...payload, score: payload.score };
  if (existingCo) {
    store.update('companies', existingCo.id, coPayload);
    return { action: 'updated', id: existingCo.id };
  }
  return { action: 'created', row: store.create('companies', coPayload) };
}

export function renderUnitPanelHtml() {
  return (
    '<p class="hint" style="margin:0 0 0.5rem">Consulta rápida via BrasilAPI — ideal para 1 CNPJ ou lote pequeno.</p>' +
    '<div class="ps-row2">' +
      '<label class="ps-field" style="flex:1"><span>CNPJ</span>' +
        '<input id="ps-unit-cnpj" placeholder="00.000.000/0001-00" inputmode="numeric"></label>' +
      '<label class="ps-field"><span>Destino</span>' +
        '<select id="ps-unit-dest" class="l2-select">' +
          '<option value="lead">Lead CRM</option>' +
          '<option value="company">Empresa (staging)</option>' +
        '</select></label>' +
    '</div>' +
    '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin:0.5rem 0">' +
      '<button type="button" class="btn primary sm" id="ps-unit-one">Consultar</button>' +
      '<button type="button" class="btn sm hidden" id="ps-unit-cancel">Cancelar</button>' +
    '</div>' +
    '<label class="ps-field"><span>Lote (um CNPJ por linha)</span>' +
      '<textarea id="ps-unit-batch" rows="2" placeholder="00000000000191"></textarea></label>' +
    '<button type="button" class="btn sm" id="ps-unit-batch-run" style="margin-top:0.35rem">Importar lote</button>' +
    '<p class="hint" id="ps-unit-status" style="margin-top:0.5rem"></p>'
  );
}

export function bindUnitPanel(root, onSaved) {
  const status = root.querySelector('#ps-unit-status');
  const asLead = () => root.querySelector('#ps-unit-dest')?.value === 'lead';

  function setBusy(busy, msg) {
    root.querySelector('#ps-unit-one')?.toggleAttribute('disabled', busy);
    root.querySelector('#ps-unit-batch-run')?.toggleAttribute('disabled', busy);
    root.querySelector('#ps-unit-cancel')?.classList.toggle('hidden', !busy);
    if (msg != null && status) status.textContent = msg;
  }

  root.querySelector('#ps-unit-one')?.addEventListener('click', async function () {
    const cnpj = root.querySelector('#ps-unit-cnpj')?.value;
    setBusy(true, 'Consultando…');
    try {
      const row = await fetchCnpjRf(cnpj);
      if (!row) {
        if (status) status.textContent = 'CNPJ não encontrado.';
        return;
      }
      const saved = saveRfRecord(row, asLead());
      if (status) {
        status.innerHTML = '<strong>' + esc(row.razao_social) + '</strong> · ' + esc(row.uf) +
          ' · Score ' + computeScore(row) + ' · ' + saved.action;
      }
      window.AFSToast?.success('CNPJ importado');
      onSaved?.();
    } catch (e) {
      if (status) status.textContent = e.message || String(e);
      window.AFSToast?.error(status.textContent);
    } finally {
      setBusy(false, '');
    }
  });

  root.querySelector('#ps-unit-batch-run')?.addEventListener('click', async function () {
    const list = parseCnpjList(root.querySelector('#ps-unit-batch')?.value);
    if (!list.length) return window.AFSToast?.error('Informe CNPJs válidos');
    rfAbort = new AbortController();
    setBusy(true, '0/' + list.length);
    try {
      const result = await fetchCnpjBatch(list, {
        delayMs: 1200,
        signal: rfAbort.signal,
        onProgress: (cur, tot) => setBusy(true, cur + '/' + tot),
      });
      let n = 0;
      result.ok.forEach(function (row) { saveRfRecord(row, asLead()); n++; });
      if (status) {
        status.textContent = n + ' importados · ' + result.skipped.length + ' não encontrados · ' + result.errors.length + ' erros';
      }
      window.AFSToast?.success('Lote concluído');
      onSaved?.();
    } catch (e) {
      if (e.name !== 'AbortError') window.AFSToast?.error(e.message || String(e));
    } finally {
      rfAbort = null;
      setBusy(false, '');
    }
  });

  root.querySelector('#ps-unit-cancel')?.addEventListener('click', function () {
    rfAbort?.abort();
    setBusy(false, 'Cancelado');
  });
}
