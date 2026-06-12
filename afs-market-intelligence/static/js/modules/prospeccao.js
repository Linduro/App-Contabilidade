import * as store from '../core/store.js';
import { openDrawer } from '../components/drawer.js';
import { toCSV, downloadFile } from '../components/export.js';

const REGIME_LABELS = { SN: 'Simples Nacional', LP: 'Lucro Presumido', LR: 'Lucro Real' };
const PAGE_SIZE = 25;

let state = { page: 1, filtersOpen: true, filters: defaultFilters(), source: 'all' };

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

function convertToLead(company) {
  const existing = store.list('leads', { filter: (l) => l.cnpj_basico === company.cnpj }).rows[0];
  if (existing) return existing;
  return store.create('leads', {
    cnpj_basico: company.cnpj,
    razao_social: company.nome || company.razao_social,
    cnae_codigo: company.cnae_codigo,
    cnae_descricao: company.cnae_descricao,
    regime_tributario: company.regime_tributario,
    porte_empresa: company.porte_empresa,
    capital_social: company.capital_social,
    uf: company.uf,
    municipio: company.municipio,
    score: company.score || 5,
    status_funil: 'prospectado',
    origem: 'prospecção',
    responsavel_id: 'u_owner',
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
    '<p class="hint">Busca local com filtros accordion — pronto para integração RF futura</p></div></div>' +
    renderAccordion(mount, allRows) +
    '<div id="prosp-results"></div>';

  bindFilters(mount);
  paintTable(mount);
}
