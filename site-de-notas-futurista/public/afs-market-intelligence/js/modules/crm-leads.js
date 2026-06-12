import * as store from '../core/store.js';
import { openDrawer, closeDrawer } from '../components/drawer.js';
import { openModal, closeModal, bindModalCloses } from '../components/modal.js';
import { toCSV, downloadFile, copyText, exportExcel, LEAD_EXPORT_COLS } from '../components/export.js';

const PAGE_SIZE = 25;
const REGIME_LABELS = { SN: 'Simples Nacional', LP: 'Lucro Presumido', LR: 'Lucro Real' };
const FUNIL_LABELS = {
  prospectado: 'Prospectado', contato_feito: 'Contato Feito', proposta_enviada: 'Proposta',
  negociacao: 'Negociação', fechado: 'Fechado', perdido: 'Perdido', dead_zone: 'Dead Zone',
};

let state = { page: 1, selected: new Set(), filters: defaultFilters() };

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

function nextActivity(leadId) {
  const acts = store.list('activities', {
    filter: (a) => a.lead_id === leadId && a.status !== 'concluida',
    sort: { key: 'agendado_para', dir: 'asc' },
  }).rows;
  return acts[0] || null;
}

function tagLabels(tags) {
  if (!tags?.length) return '—';
  const all = store.list('tags').rows;
  return tags.map((id) => all.find((t) => t.id === id)?.nome || id).join(', ');
}

function applyFilters(leads) {
  const f = state.filters;
  return leads.filter((l) => {
    if (f.q) {
      const q = f.q.toLowerCase();
      if (!(String(l.razao_social || '').toLowerCase().includes(q) || String(l.cnpj_basico || '').includes(q))) return false;
    }
    if (f.uf && l.uf !== f.uf) return false;
    if (f.regime && l.regime_tributario !== f.regime) return false;
    if (f.porte && l.porte_empresa !== f.porte) return false;
    if (f.cnae && f.cnae !== 'Todos' && l.cnae_codigo !== f.cnae) return false;
    const score = Number(l.score) || 0;
    if (score < f.scoreMin || score > f.scoreMax) return false;
    if (f.capitalMin && (Number(l.capital_social) || 0) < Number(f.capitalMin)) return false;
    if (f.capitalMax && (Number(l.capital_social) || 0) > Number(f.capitalMax)) return false;
    if (f.transicao && !l.transicao_regime) return false;
    if (f.emailValido && (!l.email || !String(l.email).includes('@'))) return false;
    if (f.situacaoAtiva && l.situacao_cadastral && l.situacao_cadastral !== 'ATIVA') return false;
    return true;
  });
}

function readFiltersFromForm(mount) {
  const g = (id) => mount.querySelector('#' + id);
  state.filters = {
    q: g('lead-filter-q')?.value.trim() || '',
    uf: g('lead-filter-uf')?.value || '',
    regime: g('lead-filter-regime')?.value || '',
    porte: g('lead-filter-porte')?.value || '',
    scoreMin: Number(g('lead-filter-score-min')?.value || 0),
    scoreMax: Number(g('lead-filter-score-max')?.value || 10),
    capitalMin: g('lead-filter-capital-min')?.value || '',
    capitalMax: g('lead-filter-capital-max')?.value || '',
    cnae: g('lead-filter-cnae')?.value || '',
    transicao: g('lead-filter-transicao')?.checked || false,
    emailValido: g('lead-filter-email')?.checked || false,
    situacaoAtiva: g('lead-filter-situacao')?.checked !== false,
  };
  state.page = 1;
}

function ufsFromLeads(leads) {
  return [...new Set(leads.map((l) => l.uf).filter(Boolean))].sort();
}

function cnaesFromLeads(leads) {
  return [...new Set(leads.map((l) => l.cnae_codigo).filter(Boolean))].sort();
}

function openLeadDrawer(lead) {
  const act = nextActivity(lead.id);
  const deals = store.list('deals', { filter: (d) => d.lead_id === lead.id }).rows;
  openDrawer(lead.razao_social, '<div class="drawer-grid">' +
    '<div><span class="hint">CNPJ</span><br>' + esc(lead.cnpj_basico) + '</div>' +
    '<div><span class="hint">Regime</span><br>' + esc(REGIME_LABELS[lead.regime_tributario] || lead.regime_tributario) + '</div>' +
    '<div><span class="hint">Score</span><br>' + (lead.score || 0) + '</div>' +
    '<div><span class="hint">Status</span><br>' + esc(FUNIL_LABELS[lead.status_funil] || lead.status_funil) + '</div>' +
    '<div><span class="hint">Capital</span><br>' + money(lead.capital_social) + '</div>' +
    '<div><span class="hint">UF</span><br>' + esc(lead.uf) + '</div>' +
    '</div>' +
    '<p style="margin-top:0.75rem"><span class="hint">E-mail</span> ' + esc(lead.email || '—') + '<br>' +
    '<span class="hint">Telefone</span> ' + esc(lead.telefone || '—') + '</p>' +
    '<p class="hint">Origem: ' + esc(lead.origem || '—') + ' · Tags: ' + esc(tagLabels(lead.tags)) + '</p>' +
    (act ? '<p class="hint">Próxima atividade: ' + esc(act.titulo) + ' (' + esc(act.status) + ')</p>' : '') +
    (deals.length ? '<p class="hint">' + deals.length + ' negócio(s) vinculado(s)</p>' : '') +
    '<div style="margin-top:1rem;display:flex;flex-wrap:wrap;gap:0.5rem">' +
      '<button type="button" class="btn sm primary" data-drawer-action="funil" data-id="' + esc(lead.id) + '">+ Funil</button>' +
      '<button type="button" class="btn sm" data-drawer-action="contato" data-id="' + esc(lead.id) + '">Marcar contatado</button>' +
      '<button type="button" class="btn sm" data-drawer-action="deal" data-id="' + esc(lead.id) + '">Criar negócio</button>' +
      '<button type="button" class="btn sm" id="drawer-close-lead">Fechar</button>' +
    '</div>');

  document.getElementById('drawer-close-lead')?.addEventListener('click', closeDrawer);
  document.querySelectorAll('[data-drawer-action]').forEach((btn) => {
    btn.addEventListener('click', () => leadAction(btn.dataset.drawerAction, btn.dataset.id, mountRef));
  });
}

let mountRef = null;

function leadAction(action, id, mount) {
  if (action === 'funil') {
    store.update('leads', id, { status_funil: 'prospectado' });
    window.AFSToast?.success('Adicionado ao funil');
  } else if (action === 'contato') {
    store.update('leads', id, { status_funil: 'contato_feito' });
    store.create('activities', { tipo: 'ligacao', titulo: 'Contato registrado', lead_id: id, status: 'concluida', agendado_para: new Date().toISOString(), responsavel_id: 'u_owner' });
    window.AFSToast?.success('Marcado como contatado');
  } else if (action === 'deal') {
    const lead = store.get('leads', id);
    store.create('deals', {
      titulo: 'Negócio — ' + (lead?.razao_social || id),
      lead_id: id,
      pipeline_id: 'pipe_vendas',
      stage_id: 'st_prosp',
      valor: 0,
      responsavel_id: 'u_owner',
      status: 'aberto',
      produtos: [],
    });
    window.AFSToast?.success('Negócio criado — ver Pipelines');
  }
  closeDrawer();
  if (mount) renderLeads({ mount });
}

function parseCsvImport(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  let count = 0;
  lines.slice(1).forEach((line) => {
    const cols = line.split(sep).map((c) => c.replace(/^"|"$/g, '').trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = cols[i]; });
    if (!row.cnpj_basico && !row.cnpj && !row.razao_social) return;
    store.create('leads', {
      cnpj_basico: row.cnpj || row.cnpj_basico || '',
      razao_social: row.razao_social || row.nome || row.empresa || 'Sem nome',
      cnae_codigo: row.cnae || row.cnae_codigo || '',
      regime_tributario: row.regime || row.regime_tributario || 'SN',
      porte_empresa: row.porte || row.porte_empresa || 'ME',
      capital_social: Number(row.capital || row.capital_social) || 0,
      uf: row.uf || 'SP',
      email: row.email || '',
      telefone: row.telefone || '',
      score: Number(row.score) || 5,
      status_funil: 'prospectado',
      perfil_icp: 'patrimonial',
      origem: 'importação CSV',
      situacao_cadastral: 'ATIVA',
    });
    count++;
  });
  return count;
}

function getFilteredLeads() {
  return applyFilters(store.list('leads').rows);
}

function renderTableRows(slice, mount) {
  return slice.map((l) => {
    const act = nextActivity(l.id);
    const checked = state.selected.has(l.id) ? ' checked' : '';
    return '<tr data-lead-id="' + esc(l.id) + '">' +
      '<td><input type="checkbox" class="lead-row-cb" data-id="' + esc(l.id) + '"' + checked + '></td>' +
      '<td><strong>' + esc(l.razao_social) + '</strong><br><small class="hint">' + esc(l.cnpj_basico) + '</small></td>' +
      '<td><div class="action-icons-inline">' +
        '<button type="button" class="btn sm" data-act="view" data-id="' + esc(l.id) + '">👁</button>' +
        '<button type="button" class="btn sm" data-act="funil" data-id="' + esc(l.id) + '">+</button>' +
      '</td>' +
      '<td>' + esc(l.origem || '—') + '</td>' +
      '<td>' + (act ? esc(act.titulo) + ' <small class="hint">' + esc(act.status) + '</small>' : '—') + '</td>' +
      '<td>' + esc(tagLabels(l.tags)) + '</td>' +
      '<td>' + esc(FUNIL_LABELS[l.status_funil] || l.status_funil || '—') + '</td>' +
      '<td>' + esc(l.uf) + '</td>' +
      '<td>' + (l.score || 0).toFixed(1) + '</td>' +
      '<td>' + esc(REGIME_LABELS[l.regime_tributario] || l.regime_tributario || '—') + '</td>' +
    '</tr>';
  }).join('');
}

function filtersHtml(allLeads) {
  const ufs = ufsFromLeads(allLeads);
  const cnaes = cnaesFromLeads(allLeads);
  const f = state.filters;
  return '<div class="leads-filters l2-card">' +
    '<div class="leads-filters-grid">' +
      '<label class="l2-field"><span>Buscar</span><input id="lead-filter-q" value="' + esc(f.q) + '" placeholder="Razão social ou CNPJ"></label>' +
      '<label class="l2-field"><span>UF</span><select id="lead-filter-uf"><option value="">Todos</option>' +
        ufs.map((u) => '<option value="' + u + '"' + (f.uf === u ? ' selected' : '') + '>' + u + '</option>').join('') + '</select></label>' +
      '<label class="l2-field"><span>Regime</span><select id="lead-filter-regime"><option value="">Todos</option>' +
        ['SN', 'LP', 'LR'].map((r) => '<option value="' + r + '"' + (f.regime === r ? ' selected' : '') + '>' + (REGIME_LABELS[r]) + '</option>').join('') + '</select></label>' +
      '<label class="l2-field"><span>Porte</span><select id="lead-filter-porte"><option value="">Todos</option>' +
        ['MEI', 'ME', 'EPP', 'MEDIO', 'GRANDE'].map((p) => '<option value="' + p + '"' + (f.porte === p ? ' selected' : '') + '>' + p + '</option>').join('') + '</select></label>' +
      '<label class="l2-field"><span>Score mín.</span><input id="lead-filter-score-min" type="range" min="0" max="10" step="0.5" value="' + f.scoreMin + '"><span id="lead-score-min-lbl">' + f.scoreMin + '</span></label>' +
      '<label class="l2-field"><span>Score máx.</span><input id="lead-filter-score-max" type="range" min="0" max="10" step="0.5" value="' + f.scoreMax + '"><span id="lead-score-max-lbl">' + f.scoreMax + '</span></label>' +
      '<label class="l2-field"><span>CNAE</span><select id="lead-filter-cnae"><option value="">Todos</option>' +
        cnaes.map((c) => '<option value="' + esc(c) + '"' + (f.cnae === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('') + '</select></label>' +
      '<label class="l2-field"><span>Capital mín.</span><input id="lead-filter-capital-min" type="number" value="' + esc(f.capitalMin) + '"></label>' +
      '<label class="l2-field"><span>Capital máx.</span><input id="lead-filter-capital-max" type="number" value="' + esc(f.capitalMax) + '"></label>' +
    '</div>' +
    '<div class="leads-filter-toggles">' +
      '<label><input type="checkbox" id="lead-filter-transicao"' + (f.transicao ? ' checked' : '') + '> Em transição</label>' +
      '<label><input type="checkbox" id="lead-filter-email"' + (f.emailValido ? ' checked' : '') + '> E-mail válido</label>' +
      '<label><input type="checkbox" id="lead-filter-situacao"' + (f.situacaoAtiva ? ' checked' : '') + '> Situação ativa</label>' +
    '</div>' +
    '<div class="crm-toolbar-right" style="margin-top:0.75rem">' +
      '<button type="button" class="btn primary" id="lead-btn-filter">Pesquisar</button>' +
      '<button type="button" class="btn" id="lead-btn-clear">Limpar</button>' +
    '</div></div>';
}

function modalsHtml() {
  return '<div class="l2-modal-overlay" id="modal-novo-lead">' +
    '<div class="l2-modal"><h3>Novo Lead</h3><form id="form-novo-lead">' +
      '<label class="l2-field"><span>CNPJ *</span><input name="cnpj_basico" required></label>' +
      '<label class="l2-field"><span>Razão Social *</span><input name="razao_social" required></label>' +
      '<label class="l2-field"><span>UF</span><input name="uf" maxlength="2" value="SP"></label>' +
      '<label class="l2-field"><span>Regime</span><select name="regime_tributario"><option>SN</option><option>LP</option><option>LR</option></select></label>' +
      '<label class="l2-field"><span>E-mail</span><input name="email" type="email"></label>' +
      '<label class="l2-field"><span>Origem</span><input name="origem" value="manual"></label>' +
      '<div class="l2-modal-actions">' +
        '<button type="button" class="btn" data-close-modal="modal-novo-lead">Cancelar</button>' +
        '<button type="submit" class="btn primary">Salvar</button>' +
      '</div></form></div></div>' +
    '<div class="l2-modal-overlay" id="modal-import-lead">' +
    '<div class="l2-modal"><h3>Importar CSV</h3>' +
      '<p class="hint">Colunas: cnpj_basico, razao_social, uf, regime, email (separador ; ou ,)</p>' +
      '<textarea id="lead-import-text" rows="8" style="width:100%;background:#12121a;color:inherit;border:1px solid var(--border-subtle);border-radius:8px;padding:0.5rem"></textarea>' +
      '<div class="l2-modal-actions">' +
        '<button type="button" class="btn" data-close-modal="modal-import-lead">Cancelar</button>' +
        '<button type="button" class="btn primary" id="lead-import-confirm">Importar</button>' +
      '</div></div></div>';
}

function bindLeadsUI(mount) {
  mountRef = mount;
  bindModalCloses(mount);

  mount.querySelector('#lead-btn-filter')?.addEventListener('click', () => {
    readFiltersFromForm(mount);
    renderLeads({ mount });
  });
  mount.querySelector('#lead-btn-clear')?.addEventListener('click', () => {
    state.filters = defaultFilters();
    state.selected.clear();
    renderLeads({ mount });
  });

  mount.querySelector('#lead-filter-score-min')?.addEventListener('input', (e) => {
    const lbl = mount.querySelector('#lead-score-min-lbl');
    if (lbl) lbl.textContent = e.target.value;
  });
  mount.querySelector('#lead-filter-score-max')?.addEventListener('input', (e) => {
    const lbl = mount.querySelector('#lead-score-max-lbl');
    if (lbl) lbl.textContent = e.target.value;
  });

  mount.querySelector('#lead-btn-novo')?.addEventListener('click', () => openModal('modal-novo-lead'));
  mount.querySelector('#lead-btn-import')?.addEventListener('click', () => openModal('modal-import-lead'));

  mount.querySelector('#form-novo-lead')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    store.create('leads', {
      cnpj_basico: fd.get('cnpj_basico'),
      razao_social: fd.get('razao_social'),
      uf: fd.get('uf'),
      regime_tributario: fd.get('regime_tributario'),
      email: fd.get('email'),
      origem: fd.get('origem'),
      status_funil: 'prospectado',
      perfil_icp: 'patrimonial',
      score: 5,
      situacao_cadastral: 'ATIVA',
    });
    closeModal('modal-novo-lead');
    window.AFSToast?.success('Lead criado');
    e.target.reset();
    renderLeads({ mount });
  });

  mount.querySelector('#lead-import-confirm')?.addEventListener('click', () => {
    const text = mount.querySelector('#lead-import-text')?.value || '';
    const n = parseCsvImport(text).length;
    closeModal('modal-import-lead');
    window.AFSToast?.success(n + ' lead(s) importado(s)');
    renderLeads({ mount });
  });

  const exportRows = () => {
    const ids = state.selected.size ? [...state.selected] : getFilteredLeads().map((l) => l.id);
    return ids.map((id) => store.get('leads', id)).filter(Boolean);
  };

  mount.querySelector('#lead-export-csv')?.addEventListener('click', () => {
    downloadFile('afs-leads.csv', toCSV(exportRows(), LEAD_EXPORT_COLS), 'text/csv');
  });
  mount.querySelector('#lead-export-json')?.addEventListener('click', () => {
    downloadFile('afs-leads.json', JSON.stringify(exportRows(), null, 2), 'application/json');
  });
  mount.querySelector('#lead-export-copy')?.addEventListener('click', async () => {
    await copyText(toCSV(exportRows(), LEAD_EXPORT_COLS));
    window.AFSToast?.success('Copiado');
  });
  mount.querySelector('#lead-export-xlsx')?.addEventListener('click', () => {
    try { exportExcel(exportRows(), LEAD_EXPORT_COLS, 'Leads'); }
    catch { window.AFSToast?.error('Excel indisponível'); }
  });

  mount.querySelector('#lead-select-all')?.addEventListener('change', (e) => {
    const filtered = getFilteredLeads();
    if (e.target.checked) filtered.forEach((l) => state.selected.add(l.id));
    else state.selected.clear();
    renderLeads({ mount });
  });

  mount.querySelector('#leads-prev')?.addEventListener('click', () => {
    if (state.page > 1) { state.page--; renderLeads({ mount }); }
  });
  mount.querySelector('#leads-next')?.addEventListener('click', () => {
    state.page++;
    renderLeads({ mount });
  });

  mount.querySelectorAll('.lead-row-cb').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.selected.add(cb.dataset.id);
      else state.selected.delete(cb.dataset.id);
    });
  });

  mount.querySelectorAll('[data-act]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const lead = store.get('leads', btn.dataset.id);
      if (btn.dataset.act === 'view') openLeadDrawer(lead);
      else leadAction(btn.dataset.act, btn.dataset.id, mount);
    });
  });

  mount.querySelectorAll('tr[data-lead-id]').forEach((tr) => {
    tr.addEventListener('click', (e) => {
      if (e.target.closest('button, input')) return;
      openLeadDrawer(store.get('leads', tr.dataset.leadId));
    });
  });
}

export async function renderLeads({ mount }) {
  const allLeads = store.list('leads').rows;
  const filtered = getFilteredLeads();
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (state.page > pages) state.page = pages;
  const start = (state.page - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);
  const from = filtered.length ? start + 1 : 0;
  const to = Math.min(start + PAGE_SIZE, filtered.length);

  mount.innerHTML =
    '<div class="crm-leads">' +
      '<div class="crm-toolbar">' +
        '<h3 style="margin:0">Leads</h3>' +
        '<div class="crm-toolbar-right">' +
          '<button type="button" class="btn" id="lead-btn-import">Importar</button>' +
          '<button type="button" class="btn" id="lead-export-csv">CSV</button>' +
          '<button type="button" class="btn" id="lead-export-json">JSON</button>' +
          '<button type="button" class="btn" id="lead-export-copy">Copiar</button>' +
          '<button type="button" class="btn" id="lead-export-xlsx">Excel</button>' +
          '<button type="button" class="btn primary" id="lead-btn-novo">+ Novo lead</button>' +
        '</div></div>' +
      filtersHtml(allLeads) +
      '<div class="l2-card" style="margin-top:1rem">' +
        '<table class="data-table compact leads-inbox-table"><thead><tr>' +
          '<th><input type="checkbox" id="lead-select-all"></th>' +
          '<th>Empresa</th><th>Ações</th><th>Origem</th><th>Próxima atividade</th><th>Tags</th><th>Status</th><th>UF</th><th>Score</th><th>Regime</th>' +
        '</tr></thead><tbody>' + renderTableRows(slice, mount) + '</tbody></table>' +
        '<div class="pagination-row">' +
          '<button type="button" class="btn sm" id="leads-prev"' + (state.page <= 1 ? ' disabled' : '') + '>← Anterior</button>' +
          '<span class="hint">Exibindo ' + from + '–' + to + ' de ' + filtered.length + '</span>' +
          '<button type="button" class="btn sm" id="leads-next"' + (state.page >= pages ? ' disabled' : '') + '>Próxima →</button>' +
        '</div></div>' +
      modalsHtml() +
    '</div>';

  bindLeadsUI(mount);
}
