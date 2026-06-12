import * as store from '../core/store.js';
import { openDrawer } from '../components/drawer.js';
import { toCSV, downloadFile } from '../components/export.js';
import { fetchCnpjRf, fetchCnpjBatch, onlyDigits, parseCnpjList } from '../adapters/brasilapi-cnpj.js';
import { computeScore } from '../core/scoring.js';

const REGIME_LABELS = { SN: 'Simples Nacional', LP: 'Lucro Presumido', LR: 'Lucro Real' };
const PAGE_SIZE = 25;

let state = { page: 1, filtersOpen: true, filters: defaultFilters(), source: 'all', rfBusy: false };
let rfAbort = null;

function defaultFilters() {
  return {
    q: '', uf: '', regime: '', porte: '', scoreMin: 0, scoreMax: 10,
    capitalMin: '', capitalMax: '', cnae: '', transicao: false,
    emailValido: false, situacaoAtiva: true,
  };
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function money(v) {
  if (!v) return '—';
  return 'R$ ' + Number(v).toLocaleString('pt-BR');
}

function allProspectRows() {
  const leads = store.list('leads').rows.map((l) => ({ ...l, _tipo: 'lead', _id: l.id }));
  const companies = store.list('companies').rows.map((c) => ({ ...c, _tipo: 'company', _id: c.id }));
  return [...leads, ...companies];
}

function applyFilters(rows) {
  const f = state.filters;
  return rows.filter((r) => {
    const nome = r.razao_social || r.nome || '';
    const cnpj = r.cnpj_basico || r.cnpj || '';
    if (f.q) {
      const q = f.q.toLowerCase();
      if (!(nome.toLowerCase().includes(q) || String(cnpj).includes(q))) return false;
    }
    if (f.uf && r.uf !== f.uf) return false;
    if (f.regime && r.regime_tributario !== f.regime) return false;
    if (f.porte && r.porte_empresa !== f.porte) return false;
    if (f.cnae && f.cnae !== 'Todos' && r.cnae_codigo !== f.cnae) return false;
    const score = Number(r.score) || 0;
    if (score < f.scoreMin || score > f.scoreMax) return false;
    if (f.capitalMin && (Number(r.capital_social) || 0) < Number(f.capitalMin)) return false;
    if (f.capitalMax && (Number(r.capital_social) || 0) > Number(f.capitalMax)) return false;
    if (f.transicao && !r.transicao_regime) return false;
    if (f.emailValido && (!r.email || !String(r.email).includes('@'))) return false;
    if (f.situacaoAtiva && r.situacao_cadastral && r.situacao_cadastral !== 'ATIVA') return false;
    if (state.source === 'leads' && r._tipo !== 'lead') return false;
    if (state.source === 'companies' && r._tipo !== 'company') return false;
    return true;
  });
}

function ufsFrom(rows) {
  return [...new Set(rows.map((r) => r.uf).filter(Boolean))].sort();
}

function cnaesFrom(rows) {
  return [...new Set(rows.map((r) => r.cnae_codigo).filter(Boolean))].sort();
}

function readFilters(mount) {
  const g = (id) => mount.querySelector('#' + id);
  state.filters = {
    q: g('prosp-q')?.value.trim() || '',
    uf: g('prosp-uf')?.value || '',
    regime: g('prosp-regime')?.value || '',
    porte: g('prosp-porte')?.value || '',
    scoreMin: Number(g('prosp-score-min')?.value || 0),
    scoreMax: Number(g('prosp-score-max')?.value || 10),
    capitalMin: g('prosp-capital-min')?.value || '',
    capitalMax: g('prosp-capital-max')?.value || '',
    cnae: g('prosp-cnae')?.value || '',
    transicao: g('prosp-transicao')?.checked || false,
    emailValido: g('prosp-email')?.checked || false,
    situacaoAtiva: g('prosp-situacao')?.checked !== false,
  };
  state.page = 1;
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
  const coPayload = {
    cnpj: row.cnpj_basico,
    nome: row.razao_social,
    ...payload,
    score: payload.score,
  };
  if (existingCo) {
    store.update('companies', existingCo.id, coPayload);
    return { action: 'updated', id: existingCo.id };
  }
  return { action: 'created', row: store.create('companies', coPayload) };
}

function convertToLead(company) {
  const existing = store.list('leads', { filter: (l) => onlyDigits(l.cnpj_basico) === onlyDigits(company.cnpj) }).rows[0];
  if (existing) return existing;
  const lead = store.create('leads', {
    cnpj_basico: company.cnpj,
    razao_social: company.nome || company.razao_social,
    cnae_codigo: company.cnae_codigo,
    cnae_descricao: company.cnae_descricao,
    regime_tributario: company.regime_tributario,
    porte_empresa: company.porte_empresa,
    capital_social: company.capital_social,
    uf: company.uf,
    municipio: company.municipio,
    telefone: company.telefone,
    email: company.email,
    situacao_cadastral: company.situacao_cadastral,
    score: company.score || computeScore(company),
    status_funil: 'prospectado',
    origem: company.fonte_rf ? 'receita_federal' : 'prospecção',
    responsavel_id: 'u_owner',
    perfil_icp: 'patrimonial',
  });
  if (company.fonte_rf) store.remove('companies', company.id);
  return lead;
}

function renderRfPanel() {
  return '<section class="l2-card prosp-rf-panel" style="margin-bottom:1rem">' +
    '<h3 style="margin:0 0 0.35rem">Ingestão Receita Federal (gratuita)</h3>' +
    '<p class="hint">Consulta em tempo real via <a href="https://brasilapi.com.br" target="_blank" rel="noopener">BrasilAPI</a> — dados abertos oficiais da RF. ' +
    'Para milhões de registros use o pipeline Python com <code>dados_abertos_cnpj</code> (Cloud Run/local).</p>' +
    '<div class="prosp-rf-row">' +
      '<label class="l2-field" style="flex:1"><span>CNPJ</span>' +
        '<input id="prosp-rf-cnpj" placeholder="00.000.000/0001-00" inputmode="numeric"></label>' +
      '<label class="l2-field"><span>Destino</span>' +
        '<select id="prosp-rf-dest" class="l2-select">' +
          '<option value="company">Empresa (prospecção)</option>' +
          '<option value="lead">Lead direto</option>' +
        '</select></label>' +
      '<button type="button" class="btn primary sm" id="prosp-rf-one">Consultar RF</button>' +
    '</div>' +
    '<label class="l2-field" style="margin-top:0.75rem"><span>Lote de CNPJs (um por linha ou separados por vírgula)</span>' +
      '<textarea id="prosp-rf-batch" rows="3" placeholder="00000000000191&#10;12345678000190"></textarea></label>' +
    '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">' +
      '<button type="button" class="btn sm" id="prosp-rf-batch-run">Importar lote</button>' +
      '<button type="button" class="btn sm hidden" id="prosp-rf-cancel">Cancelar</button>' +
      '<span class="hint" id="prosp-rf-status"></span>' +
    '</div>' +
    '<div class="pipe-bar-row hidden" id="prosp-rf-progress-wrap" style="margin-top:0.5rem">' +
      '<div class="pipe-bar-track" style="flex:1"><div class="pipe-bar-fill" id="prosp-rf-progress" style="width:0%;background:var(--afs-orange-500)"></div></div>' +
      '<span id="prosp-rf-progress-lbl">0%</span></div>' +
    '<div id="prosp-rf-preview" class="hint" style="margin-top:0.5rem"></div>' +
  '</section>';
}

function setRfBusy(mount, busy, msg) {
  state.rfBusy = busy;
  mount.querySelector('#prosp-rf-one')?.toggleAttribute('disabled', busy);
  mount.querySelector('#prosp-rf-batch-run')?.toggleAttribute('disabled', busy);
  mount.querySelector('#prosp-rf-cancel')?.classList.toggle('hidden', !busy);
  if (msg != null && mount.querySelector('#prosp-rf-status')) {
    mount.querySelector('#prosp-rf-status').textContent = msg;
  }
}

function updateRfProgress(mount, current, total) {
  const pct = total ? Math.round((current / total) * 100) : 0;
  const wrap = mount.querySelector('#prosp-rf-progress-wrap');
  const bar = mount.querySelector('#prosp-rf-progress');
  const lbl = mount.querySelector('#prosp-rf-progress-lbl');
  if (wrap) wrap.classList.remove('hidden');
  if (bar) bar.style.width = pct + '%';
  if (lbl) lbl.textContent = current + '/' + total + ' (' + pct + '%)';
}

function bindRfPanel(mount) {
  mount.querySelector('#prosp-rf-one')?.addEventListener('click', async () => {
    const cnpj = mount.querySelector('#prosp-rf-cnpj')?.value;
    const asLead = mount.querySelector('#prosp-rf-dest')?.value === 'lead';
    const preview = mount.querySelector('#prosp-rf-preview');
    setRfBusy(mount, true, 'Consultando RF…');
    try {
      const row = await fetchCnpjRf(cnpj);
      if (!row) {
        preview.textContent = 'CNPJ não encontrado na base da Receita Federal.';
        return;
      }
      const saved = saveRfRecord(row, asLead);
      preview.innerHTML = '<strong>' + esc(row.razao_social) + '</strong> · ' + esc(row.uf) + ' · ' +
        esc(row.regime_tributario) + ' · Score ' + computeScore(row) + ' · ' + saved.action;
      window.AFSToast?.success('Dados RF importados');
      paintTable(mount);
    } catch (e) {
      preview.textContent = 'Erro: ' + (e.message || e);
      window.AFSToast?.error(preview.textContent);
    } finally {
      setRfBusy(mount, false, '');
      mount.querySelector('#prosp-rf-progress-wrap')?.classList.add('hidden');
    }
  });

  mount.querySelector('#prosp-rf-batch-run')?.addEventListener('click', async () => {
    const list = parseCnpjList(mount.querySelector('#prosp-rf-batch')?.value);
    if (!list.length) return window.AFSToast?.error('Informe ao menos um CNPJ válido');
    const asLead = mount.querySelector('#prosp-rf-dest')?.value === 'lead';
    rfAbort = new AbortController();
    setRfBusy(mount, true, 'Importando 0/' + list.length + '…');
    updateRfProgress(mount, 0, list.length);
    try {
      const result = await fetchCnpjBatch(list, {
        delayMs: 1200,
        signal: rfAbort.signal,
        onProgress: (cur, tot) => {
          setRfBusy(mount, true, 'Importando ' + cur + '/' + tot + '…');
          updateRfProgress(mount, cur, tot);
        },
      });
      let created = 0;
      let updated = 0;
      result.ok.forEach((row) => {
        const s = saveRfRecord(row, asLead);
        if (s.action === 'created') created++;
        else updated++;
      });
      const preview = mount.querySelector('#prosp-rf-preview');
      preview.textContent =
        'Lote: ' + result.ok.length + ' importados (' + created + ' novos, ' + updated + ' atualizados), ' +
        result.skipped.length + ' não encontrados, ' + result.errors.length + ' erros.';
      if (result.errors.length) {
        preview.textContent += ' ' + result.errors.slice(0, 3).map((e) => e.cnpj + ': ' + e.error).join('; ');
      }
      window.AFSToast?.success('Lote RF concluído');
      paintTable(mount);
    } catch (e) {
      if (e.name !== 'AbortError') window.AFSToast?.error(e.message || String(e));
    } finally {
      rfAbort = null;
      setRfBusy(mount, false, '');
    }
  });

  mount.querySelector('#prosp-rf-cancel')?.addEventListener('click', () => {
    rfAbort?.abort();
    setRfBusy(mount, false, 'Cancelado');
  });
}

function renderAccordion(mount, allRows) {
  const ufs = ufsFrom(allRows);
  const cnaes = cnaesFrom(allRows);
  const f = state.filters;
  return '<details class="prosp-accordion l2-card"' + (state.filtersOpen ? ' open' : '') + '>' +
    '<summary>Filtros de prospecção</summary>' +
    '<div class="leads-filters-grid" style="margin-top:0.75rem">' +
      '<label class="l2-field"><span>Buscar empresa / CNPJ</span><input id="prosp-q" value="' + esc(f.q) + '" placeholder="Razão social ou CNPJ"></label>' +
      '<label class="l2-field"><span>UF</span><select id="prosp-uf" class="l2-select"><option value="">Todas</option>' +
        ufs.map((u) => '<option value="' + u + '"' + (f.uf === u ? ' selected' : '') + '>' + u + '</option>').join('') + '</select></label>' +
      '<label class="l2-field"><span>Regime</span><select id="prosp-regime" class="l2-select"><option value="">Todos</option>' +
        Object.entries(REGIME_LABELS).map(([k, v]) => '<option value="' + k + '"' + (f.regime === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>' +
      '<label class="l2-field"><span>Porte</span><select id="prosp-porte" class="l2-select"><option value="">Todos</option>' +
        ['ME', 'EPP', 'MEDIO', 'GRANDE'].map((p) => '<option value="' + p + '"' + (f.porte === p ? ' selected' : '') + '>' + p + '</option>').join('') + '</select></label>' +
      '<label class="l2-field"><span>CNAE</span><select id="prosp-cnae" class="l2-select"><option value="">Todos</option>' +
        cnaes.map((c) => '<option value="' + c + '"' + (f.cnae === c ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></label>' +
      '<label class="l2-field"><span>Score mín.</span><input type="number" id="prosp-score-min" min="0" max="10" step="0.1" value="' + f.scoreMin + '"></label>' +
      '<label class="l2-field"><span>Score máx.</span><input type="number" id="prosp-score-max" min="0" max="10" step="0.1" value="' + f.scoreMax + '"></label>' +
      '<label class="l2-field"><span>Capital mín.</span><input type="number" id="prosp-capital-min" value="' + esc(f.capitalMin) + '"></label>' +
      '<label class="l2-field"><span>Capital máx.</span><input type="number" id="prosp-capital-max" value="' + esc(f.capitalMax) + '"></label>' +
    '</div>' +
    '<div class="leads-filter-toggles">' +
      '<label><input type="checkbox" id="prosp-transicao"' + (f.transicao ? ' checked' : '') + '> Em transição de regime</label>' +
      '<label><input type="checkbox" id="prosp-email"' + (f.emailValido ? ' checked' : '') + '> E-mail validado</label>' +
      '<label><input type="checkbox" id="prosp-situacao"' + (f.situacaoAtiva ? ' checked' : '') + '> Situação ativa</label>' +
    '</div>' +
    '<div style="margin-top:0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap">' +
      '<button type="button" class="btn primary sm" id="prosp-apply">Buscar</button>' +
      '<button type="button" class="btn sm" id="prosp-clear">Limpar</button>' +
      '<button type="button" class="btn sm" id="prosp-export">Exportar CSV</button>' +
    '</div></details>';
}

function paintTable(mount) {
  const allRows = allProspectRows();
  const filtered = applyFilters(allRows);
  const total = filtered.length;
  const start = (state.page - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  mount.querySelector('#prosp-results').innerHTML =
    '<div class="crm-toolbar" style="margin-top:1rem">' +
      '<span class="hint">' + total + ' empresa(s) encontrada(s) — dados locais (sem API RF paga)</span>' +
      '<div class="view-toggle">' +
        '<button type="button" class="btn sm' + (state.source === 'all' ? ' primary' : '') + '" data-src="all">Todas</button>' +
        '<button type="button" class="btn sm' + (state.source === 'leads' ? ' primary' : '') + '" data-src="leads">Leads</button>' +
        '<button type="button" class="btn sm' + (state.source === 'companies' ? ' primary' : '') + '" data-src="companies">Empresas novas</button>' +
      '</div></div>' +
    '<table class="data-table leads-inbox-table"><thead><tr>' +
      '<th>Empresa</th><th>CNPJ</th><th>UF</th><th>Regime</th><th>Score</th><th>Capital</th><th>Origem</th><th></th>' +
    '</tr></thead><tbody>' +
    (pageRows.length ? pageRows.map((r) => {
      const nome = r.razao_social || r.nome || '—';
      const cnpj = r.cnpj_basico || r.cnpj || '—';
      const origem = r._tipo === 'lead' ? (r.origem || 'lead') : 'empresa';
      const action = r._tipo === 'company'
        ? '<button type="button" class="btn sm" data-convert="' + esc(r._id) + '">→ Lead</button>'
        : '<button type="button" class="btn sm" data-view="' + esc(r._id) + '">Ver</button>';
      return '<tr data-row="' + esc(r._id) + '"><td>' + esc(nome) + '</td><td>' + esc(cnpj) + '</td><td>' + esc(r.uf) + '</td>' +
        '<td>' + esc(REGIME_LABELS[r.regime_tributario] || r.regime_tributario || '—') + '</td>' +
        '<td>' + esc(r.score ?? '—') + '</td><td>' + money(r.capital_social) + '</td><td>' + esc(origem) + '</td><td>' + action + '</td></tr>';
    }).join('') : '<tr><td colspan="8" class="hint">Nenhum resultado. Ajuste os filtros.</td></tr>') +
    '</tbody></table>' +
    '<div class="pagination-row">' +
      '<button type="button" class="btn sm" id="prosp-prev"' + (state.page <= 1 ? ' disabled' : '') + '>Anterior</button>' +
      '<span>Página ' + state.page + ' de ' + Math.max(1, Math.ceil(total / PAGE_SIZE)) + '</span>' +
      '<button type="button" class="btn sm" id="prosp-next"' + (start + PAGE_SIZE >= total ? ' disabled' : '') + '>Próxima</button>' +
    '</div>';

  mount.querySelectorAll('[data-src]').forEach((btn) => {
    btn.addEventListener('click', () => { state.source = btn.dataset.src; state.page = 1; paintTable(mount); });
  });
  mount.querySelector('#prosp-prev')?.addEventListener('click', () => { if (state.page > 1) { state.page--; paintTable(mount); } });
  mount.querySelector('#prosp-next')?.addEventListener('click', () => { state.page++; paintTable(mount); });
  mount.querySelectorAll('[data-convert]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const co = store.get('companies', btn.dataset.convert);
      if (!co) return;
      convertToLead(co);
      store.remove('companies', co.id);
      window.AFSToast?.success('Empresa convertida em lead');
      paintTable(mount);
    });
  });
  mount.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lead = store.get('leads', btn.dataset.view);
      if (!lead) return;
      openDrawer(lead.razao_social, '<dl class="drawer-grid">' +
        '<dt>CNPJ</dt><dd>' + esc(lead.cnpj_basico) + '</dd>' +
        '<dt>Score</dt><dd>' + esc(lead.score) + '</dd>' +
        '<dt>Status</dt><dd>' + esc(lead.status_funil) + '</dd></dl>');
    });
  });
}

function bindFilters(mount) {
  mount.querySelector('#prosp-apply')?.addEventListener('click', () => { readFilters(mount); paintTable(mount); });
  mount.querySelector('#prosp-clear')?.addEventListener('click', () => {
    state.filters = defaultFilters();
    state.page = 1;
    renderProspeccao({ mount });
  });
  mount.querySelector('#prosp-export')?.addEventListener('click', () => {
    readFilters(mount);
    const rows = applyFilters(allProspectRows()).map((r) => ({
      razao_social: r.razao_social || r.nome,
      cnpj: r.cnpj_basico || r.cnpj,
      uf: r.uf,
      regime: r.regime_tributario,
      score: r.score,
      capital: r.capital_social,
    }));
    downloadFile('prospeccao.csv', toCSV(rows), 'text/csv');
  });
  mount.querySelector('.prosp-accordion')?.addEventListener('toggle', (e) => {
    state.filtersOpen = e.target.open;
  });
}

export async function renderProspeccao({ mount }) {
  const allRows = allProspectRows();
  mount.innerHTML =
    '<div class="crm-toolbar"><div><h2 style="margin:0">Prospecção</h2>' +
    '<p class="hint">Dados reais da RF via BrasilAPI + filtros ICP locais</p></div></div>' +
    renderRfPanel() +
    renderAccordion(mount, allRows) +
    '<div id="prosp-results"></div>';

  bindRfPanel(mount);
  bindFilters(mount);
  paintTable(mount);
}
