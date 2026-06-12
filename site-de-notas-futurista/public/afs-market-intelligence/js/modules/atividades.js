import * as store from '../core/store.js';
import { openModal, closeModal, bindModalCloses } from '../components/modal.js';
import { toCSV, downloadFile } from '../components/export.js';

const TIPOS = [
  { id: 'ligacao', label: 'Ligação' },
  { id: 'email', label: 'E-mail' },
  { id: 'reuniao', label: 'Reunião' },
  { id: 'followup', label: 'Follow-up' },
  { id: 'tarefa', label: 'Tarefa' },
  { id: 'whatsapp', label: 'WhatsApp (manual)' },
];

const STATUS_LABELS = { pendente: 'Pendente', atrasada: 'Atrasada', concluida: 'Concluída' };

let state = { view: 'lista', quickFilter: 'todas', tipoFilter: '', statusFilter: '' };

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function fmtDateShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function syncOverdue() {
  const now = new Date();
  store.list('activities', { filter: (a) => a.status === 'pendente' }).rows.forEach((a) => {
    const when = new Date(a.agendado_para);
    if (!isNaN(when.getTime()) && when < now) {
      store.update('activities', a.id, { status: 'atrasada' });
    }
  });
}

function leadName(id) {
  return store.get('leads', id)?.razao_social || '—';
}

function userName(id) {
  return store.get('users', id)?.nome || '—';
}

function matchesQuickFilter(a, qf) {
  const when = new Date(a.agendado_para);
  const now = new Date();
  const today0 = startOfDay(now);
  const today1 = endOfDay(now);
  const tomorrow0 = startOfDay(new Date(now.getTime() + 86400000));
  const tomorrow1 = endOfDay(new Date(now.getTime() + 86400000));
  const weekEnd = endOfDay(new Date(now.getTime() + 7 * 86400000));
  const monthEnd = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  if (qf === 'atrasadas') return a.status === 'atrasada';
  if (qf === 'fazer') return a.status === 'pendente' || a.status === 'atrasada';
  if (qf === 'hoje') return when >= today0 && when <= today1;
  if (qf === 'amanha') return when >= tomorrow0 && when <= tomorrow1;
  if (qf === 'semana') return when >= today0 && when <= weekEnd;
  if (qf === 'mes') return when >= today0 && when <= monthEnd;
  return true;
}

function getFiltered() {
  return store.list('activities', {
    filter: (a) => {
      if (!matchesQuickFilter(a, state.quickFilter)) return false;
      if (state.tipoFilter && a.tipo !== state.tipoFilter) return false;
      if (state.statusFilter && a.status !== state.statusFilter) return false;
      return true;
    },
    sort: { key: 'agendado_para', dir: 'asc' },
  }).rows;
}

function completeActivity(id, outcome) {
  const now = new Date().toISOString();
  store.update('activities', id, {
    status: 'concluida',
    concluido_em: now,
    outcome: outcome || 'concluida',
  });
  const act = store.get('activities', id);
  if (act?.lead_id && outcome === 'positivo') {
    const lead = store.get('leads', act.lead_id);
    if (lead?.status_funil === 'prospectado') {
      store.update('leads', act.lead_id, { status_funil: 'contato_feito' });
    }
  }
  window.AFSToast?.success('Atividade concluída');
}

function renderListRows(rows) {
  if (!rows.length) return '<tr><td colspan="8" class="hint">Nenhuma atividade.</td></tr>';
  return rows.map((a) => {
    const statusCls = a.status === 'atrasada' ? 'status-atrasada' : (a.status === 'concluida' ? 'status-ok' : '');
    return '<tr data-act-id="' + esc(a.id) + '">' +
      '<td><span class="act-status ' + statusCls + '">' + esc(STATUS_LABELS[a.status] || a.status) + '</span></td>' +
      '<td>' + fmtDate(a.agendado_para) + '</td>' +
      '<td>' + fmtDateShort(a.criado_em) + '</td>' +
      '<td>' + fmtDateShort(a.concluido_em) + '</td>' +
      '<td>' + esc(leadName(a.lead_id)) + '</td>' +
      '<td>' + esc(TIPOS.find((t) => t.id === a.tipo)?.label || a.tipo) + ' — ' + esc(a.titulo) + '</td>' +
      '<td>' + esc(userName(a.responsavel_id)) + '</td>' +
      '<td class="action-icons-inline">' +
        (a.status !== 'concluida' ? '<button type="button" class="btn sm primary" data-done="' + esc(a.id) + '">✓</button>' : '') +
      '</td></tr>';
  }).join('');
}

function renderCalendar(rows) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();

  const byDay = {};
  rows.forEach((a) => {
    const d = new Date(a.agendado_para);
    if (isNaN(d.getTime()) || d.getMonth() !== month || d.getFullYear() !== year) return;
    const key = d.getDate();
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(a);
  });

  const monthName = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  let cells = '';
  for (let i = 0; i < startPad; i++) cells += '<div class="cal-cell empty"></div>';
  for (let day = 1; day <= daysInMonth; day++) {
    const items = byDay[day] || [];
    const isToday = day === now.getDate();
    cells += '<div class="cal-cell' + (isToday ? ' today' : '') + '">' +
      '<div class="cal-day-num">' + day + '</div>' +
      items.slice(0, 3).map((a) =>
        '<div class="cal-event ' + esc(a.status) + '" title="' + esc(a.titulo) + '">' + esc(a.titulo.slice(0, 18)) + '</div>'
      ).join('') +
      (items.length > 3 ? '<div class="cal-more">+' + (items.length - 3) + '</div>' : '') +
    '</div>';
  }

  return '<div class="cal-header"><strong>' + monthName + '</strong></div>' +
    '<div class="cal-weekdays"><span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span></div>' +
    '<div class="cal-grid">' + cells + '</div>';
}

function modalsHtml() {
  const leads = store.list('leads').rows;
  const deals = store.list('deals', { filter: (d) => d.status === 'aberto' }).rows;
  const users = store.list('users').rows;
  const defaultWhen = new Date(Date.now() + 3600000).toISOString().slice(0, 16);

  return '<div class="l2-modal-overlay" id="modal-nova-atividade">' +
    '<div class="l2-modal"><h3>Nova atividade</h3><form id="form-nova-atividade">' +
      '<label class="l2-field"><span>Tipo</span><select name="tipo">' +
        TIPOS.map((t) => '<option value="' + t.id + '">' + t.label + '</option>').join('') +
      '</select></label>' +
      '<label class="l2-field"><span>Título *</span><input name="titulo" required></label>' +
      '<label class="l2-field"><span>Agendamento *</span><input name="agendado_para" type="datetime-local" value="' + defaultWhen + '" required></label>' +
      '<label class="l2-field"><span>Lead</span><select name="lead_id"><option value="">—</option>' +
        leads.map((l) => '<option value="' + l.id + '">' + esc(l.razao_social) + '</option>').join('') +
      '</select></label>' +
      '<label class="l2-field"><span>Negócio</span><select name="deal_id"><option value="">—</option>' +
        deals.map((d) => '<option value="' + d.id + '">' + esc(d.titulo) + '</option>').join('') +
      '</select></label>' +
      '<label class="l2-field"><span>Responsável</span><select name="responsavel_id">' +
        users.map((u) => '<option value="' + u.id + '">' + esc(u.nome) + '</option>').join('') +
      '</select></label>' +
      '<label class="l2-field"><span>Notas</span><textarea name="notas" rows="2"></textarea></label>' +
      '<div class="l2-modal-actions">' +
        '<button type="button" class="btn" data-close-modal="modal-nova-atividade">Cancelar</button>' +
        '<button type="submit" class="btn primary">Salvar</button>' +
      '</div></form></div></div>' +
    '<div class="l2-modal-overlay" id="modal-concluir-atividade">' +
    '<div class="l2-modal"><h3>Concluir atividade</h3>' +
      '<input type="hidden" id="concluir-act-id">' +
      '<label class="l2-field"><span>Outcome</span><select id="concluir-outcome">' +
        '<option value="positivo">Positivo</option><option value="negativo">Negativo</option>' +
        '<option value="sem_resposta">Sem resposta</option><option value="reuniao">Reunião agendada</option>' +
      '</select></label>' +
      '<div class="l2-modal-actions">' +
        '<button type="button" class="btn" data-close-modal="modal-concluir-atividade">Cancelar</button>' +
        '<button type="button" class="btn primary" id="btn-confirmar-conclusao">Concluir</button>' +
      '</div></div></div>';
}

function bindUI(mount) {
  bindModalCloses(mount);

  mount.querySelector('#view-lista')?.addEventListener('click', () => { state.view = 'lista'; renderAtividades({ mount }); });
  mount.querySelector('#view-calendario')?.addEventListener('click', () => { state.view = 'calendario'; renderAtividades({ mount }); });

  mount.querySelectorAll('[data-qf]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.quickFilter = btn.dataset.qf;
      renderAtividades({ mount });
    });
  });

  mount.querySelector('#filter-tipo')?.addEventListener('change', (e) => {
    state.tipoFilter = e.target.value;
    renderAtividades({ mount });
  });
  mount.querySelector('#filter-status')?.addEventListener('change', (e) => {
    state.statusFilter = e.target.value;
    renderAtividades({ mount });
  });

  mount.querySelector('#btn-nova-atividade')?.addEventListener('click', () => openModal('modal-nova-atividade'));

  mount.querySelector('#form-nova-atividade')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const when = fd.get('agendado_para');
    store.create('activities', {
      tipo: fd.get('tipo'),
      titulo: fd.get('titulo'),
      agendado_para: when ? new Date(when).toISOString() : new Date().toISOString(),
      lead_id: fd.get('lead_id') || null,
      deal_id: fd.get('deal_id') || null,
      responsavel_id: fd.get('responsavel_id'),
      notas: fd.get('notas') || '',
      status: 'pendente',
    });
    closeModal('modal-nova-atividade');
    window.AFSToast?.success('Atividade criada');
    e.target.reset();
    renderAtividades({ mount });
  });

  mount.querySelectorAll('[data-done]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      mount.querySelector('#concluir-act-id').value = btn.dataset.done;
      openModal('modal-concluir-atividade');
    });
  });

  mount.querySelector('#btn-confirmar-conclusao')?.addEventListener('click', () => {
    const id = mount.querySelector('#concluir-act-id')?.value;
    const outcome = mount.querySelector('#concluir-outcome')?.value;
    if (id) completeActivity(id, outcome);
    closeModal('modal-concluir-atividade');
    renderAtividades({ mount });
  });

  mount.querySelector('#btn-export-atividades')?.addEventListener('click', () => {
    const rows = getFiltered().map((a) => ({
      ...a,
      empresa: leadName(a.lead_id),
      responsavel: userName(a.responsavel_id),
    }));
    const cols = [
      { key: 'titulo', label: 'Título' }, { key: 'tipo', label: 'Tipo' }, { key: 'status', label: 'Status' },
      { key: 'agendado_para', label: 'Agendado' }, { key: 'empresa', label: 'Empresa' }, { key: 'responsavel', label: 'Responsável' },
    ];
    downloadFile('afs-atividades.csv', toCSV(rows, cols), 'text/csv');
  });
}

export async function renderAtividades({ mount }) {
  syncOverdue();
  const rows = getFiltered();
  const overdue = store.count('activities', (a) => a.status === 'atrasada');

  const qfActive = (id) => state.quickFilter === id ? ' primary' : '';

  mount.innerHTML =
    '<div class="crm-atividades">' +
      '<div class="crm-toolbar">' +
        '<h3 style="margin:0">Atividades' + (overdue ? ' <span class="l2-badge">' + overdue + ' atrasadas</span>' : '') + '</h3>' +
        '<div class="crm-toolbar-right">' +
          '<div class="view-toggle">' +
            '<button type="button" class="btn sm' + (state.view === 'lista' ? ' primary' : '') + '" id="view-lista">Lista</button>' +
            '<button type="button" class="btn sm' + (state.view === 'calendario' ? ' primary' : '') + '" id="view-calendario">Calendário</button>' +
          '</div>' +
          '<button type="button" class="btn" id="btn-export-atividades">Exportar</button>' +
          '<button type="button" class="btn primary" id="btn-nova-atividade">+ Nova atividade</button>' +
        '</div></div>' +
      '<div class="act-quick-filters">' +
        '<button type="button" class="btn sm' + qfActive('fazer') + '" data-qf="fazer">Para fazer</button>' +
        '<button type="button" class="btn sm' + qfActive('atrasadas') + '" data-qf="atrasadas">Atrasadas</button>' +
        '<button type="button" class="btn sm' + qfActive('hoje') + '" data-qf="hoje">Hoje</button>' +
        '<button type="button" class="btn sm' + qfActive('amanha') + '" data-qf="amanha">Amanhã</button>' +
        '<button type="button" class="btn sm' + qfActive('semana') + '" data-qf="semana">Semana</button>' +
        '<button type="button" class="btn sm' + qfActive('mes') + '" data-qf="mes">Mês</button>' +
        '<button type="button" class="btn sm' + qfActive('todas') + '" data-qf="todas">Todas</button>' +
      '</div>' +
      '<div class="act-filters-row">' +
        '<label class="l2-field inline"><span>Tipo</span><select id="filter-tipo"><option value="">Todos</option>' +
          TIPOS.map((t) => '<option value="' + t.id + '"' + (state.tipoFilter === t.id ? ' selected' : '') + '>' + t.label + '</option>').join('') +
        '</select></label>' +
        '<label class="l2-field inline"><span>Status</span><select id="filter-status"><option value="">Todos</option>' +
          Object.entries(STATUS_LABELS).map(([k, v]) => '<option value="' + k + '"' + (state.statusFilter === k ? ' selected' : '') + '>' + v + '</option>').join('') +
        '</select></label>' +
      '</div>' +
      (state.view === 'lista'
        ? '<div class="l2-card" style="margin-top:1rem"><table class="data-table compact"><thead><tr>' +
          '<th>Status</th><th>Agendamento</th><th>Criação</th><th>Fechamento</th><th>Empresa</th><th>Atividade</th><th>Responsável</th><th></th>' +
          '</tr></thead><tbody>' + renderListRows(rows) + '</tbody></table></div>'
        : '<div class="l2-card cal-wrap" style="margin-top:1rem">' + renderCalendar(rows) + '</div>') +
      modalsHtml() +
    '</div>';

  bindUI(mount);
}
