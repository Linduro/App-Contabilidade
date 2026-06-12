import * as store from '../core/store.js';
import { openModal, closeModal, bindModalCloses } from '../components/modal.js';

const TABS = [
  { path: '/automacao/jornadas', label: 'Jornadas' },
  { path: '/automacao/campanhas', label: 'Campanhas' },
];

const TRIGGER_LABELS = {
  lead_score_above: 'Score acima de',
  lead_created: 'Novo lead',
  deal_stage_changed: 'Mudança de etapa',
  activity_overdue: 'Atividade atrasada',
};

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function tabNav(path) {
  return '<nav class="l2-subnav">' + TABS.map((t) =>
    '<a href="#' + t.path + '" class="' + (path.startsWith(t.path) ? 'active' : '') + '">' + t.label + '</a>'
  ).join('') + '</nav>';
}

function renderJourneyCanvas(auto) {
  const steps = auto?.steps || [];
  if (!steps.length) return '<p class="hint">Sem etapas configuradas.</p>';
  return '<div class="journey-canvas">' + steps.map((s, i) => {
    const arrow = i < steps.length - 1 ? '<div class="journey-arrow">→</div>' : '';
    return '<div class="journey-node"><div class="journey-node-icon">' + (i + 1) + '</div>' +
      '<strong>' + esc(s.tipo) + '</strong><small>' + esc(s.config || '') + '</small></div>' + arrow;
  }).join('') + '</div>';
}

function renderJornadas(mount, path) {
  const rows = store.list('automations').rows;
  let selected = rows[0]?.id || null;

  function paint() {
    const auto = store.get('automations', selected);
    mount.querySelector('#auto-list').innerHTML = rows.map((a) =>
      '<button type="button" class="journey-list-item' + (a.id === selected ? ' active' : '') + '" data-id="' + esc(a.id) + '">' +
        '<strong>' + esc(a.nome) + '</strong><small>' + esc(TRIGGER_LABELS[a.trigger] || a.trigger) + '</small>' +
        '<span class="act-status' + (a.ativo ? ' status-ok' : '') + '">' + (a.ativo ? 'Ativa' : 'Pausada') + '</span></button>'
    ).join('') || '<p class="hint">Nenhuma jornada.</p>';
    mount.querySelector('#auto-canvas').innerHTML = auto ? (
      '<h3>' + esc(auto.nome) + '</h3><p class="hint">Gatilho: ' + esc(TRIGGER_LABELS[auto.trigger] || auto.trigger) +
      (auto.trigger_value ? ' ' + auto.trigger_value : '') + '</p>' + renderJourneyCanvas(auto) +
      '<div style="margin-top:1rem;display:flex;gap:0.5rem">' +
        '<button type="button" class="btn sm" id="auto-toggle">' + (auto.ativo ? 'Pausar' : 'Ativar') + '</button>' +
        '<button type="button" class="btn sm" id="auto-run">Simular execução</button></div>'
    ) : '<p class="hint">Selecione uma jornada</p>';

    mount.querySelectorAll('.journey-list-item').forEach((btn) => {
      btn.addEventListener('click', () => { selected = btn.dataset.id; paint(); });
    });
    mount.querySelector('#auto-toggle')?.addEventListener('click', () => {
      if (!auto) return;
      store.update('automations', auto.id, { ativo: !auto.ativo });
      paint();
    });
    mount.querySelector('#auto-run')?.addEventListener('click', () => {
      if (!auto) return;
      store.create('automationRuns', {
        automation_id: auto.id,
        status: 'concluido',
        leads_afetados: store.count('leads', (l) => (l.score || 0) >= (auto.trigger_value || 0)),
        executado_em: new Date().toISOString(),
      });
      window.AFSToast?.success('Simulação registrada (sem envio real)');
      paint();
    });
  }

  mount.innerHTML =
    '<div class="crm-toolbar"><h2 style="margin:0">Automação</h2>' +
    '<button type="button" class="btn primary sm" id="auto-new">+ Jornada</button></div>' +
    tabNav(path) +
    '<div class="journey-layout" style="margin-top:1rem">' +
      '<div class="l2-card" id="auto-list"></div>' +
      '<div class="l2-card" id="auto-canvas"></div>' +
    '</div>' +
    '<div id="modal-auto" class="l2-modal-overlay"><div class="l2-modal">' +
      '<h3>Nova jornada</h3>' +
      '<label class="l2-field"><span>Nome</span><input id="auto-nome"></label>' +
      '<label class="l2-field"><span>Gatilho</span><select id="auto-trigger">' +
        Object.entries(TRIGGER_LABELS).map(([k, v]) => '<option value="' + k + '">' + v + '</option>').join('') +
      '</select></label>' +
      '<label class="l2-field"><span>Valor do gatilho (score)</span><input type="number" id="auto-val" value="8"></label>' +
      '<div class="l2-modal-actions"><button type="button" class="btn" data-close-modal>Cancelar</button><button type="button" class="btn primary" id="auto-save">Criar</button></div></div></div>';

  bindModalCloses(mount);
  mount.querySelector('#auto-new')?.addEventListener('click', () => openModal('modal-auto'));
  mount.querySelector('#auto-save')?.addEventListener('click', () => {
    const a = store.create('automations', {
      nome: mount.querySelector('#auto-nome')?.value.trim() || 'Nova jornada',
      trigger: mount.querySelector('#auto-trigger')?.value,
      trigger_value: Number(mount.querySelector('#auto-val')?.value || 0),
      ativo: true,
      steps: [
        { tipo: 'aguardar', config: '1 dia' },
        { tipo: 'email', config: 'Template abordagem' },
        { tipo: 'criar_atividade', config: 'Follow-up ligação' },
      ],
    });
    selected = a.id;
    closeModal('modal-auto');
    paint();
    window.AFSToast?.success('Jornada criada');
  });
  paint();
}

function renderCampanhas(mount, path) {
  const camps = store.list('campaigns').rows;
  const autos = store.list('automations').rows;
  mount.innerHTML =
    '<div class="crm-toolbar"><h2 style="margin:0">Automação</h2>' +
    '<button type="button" class="btn primary sm" id="camp-new">+ Campanha</button></div>' +
    tabNav(path) +
    '<div class="l2-card" style="margin-top:1rem"><table class="data-table"><thead><tr><th>Campanha</th><th>Jornada</th><th>Status</th><th>Enviados</th><th></th></tr></thead><tbody>' +
    (camps.length ? camps.map((c) => {
      const auto = autos.find((a) => a.id === c.automation_id);
      return '<tr><td>' + esc(c.nome) + '</td><td>' + esc(auto?.nome || '—') + '</td><td>' + esc(c.status) + '</td><td>' + (c.enviados || 0) + '</td>' +
        '<td>' + (c.status === 'rascunho' ? '<button type="button" class="btn sm" data-launch="' + esc(c.id) + '">Lançar (sim.)</button>' : '—') + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="hint">Nenhuma campanha.</td></tr>') +
    '</tbody></table></div>' +
    '<div id="modal-camp" class="l2-modal-overlay"><div class="l2-modal">' +
      '<h3>Nova campanha</h3>' +
      '<label class="l2-field"><span>Nome</span><input id="camp-nome"></label>' +
      '<label class="l2-field"><span>Jornada</span><select id="camp-auto">' +
        autos.map((a) => '<option value="' + a.id + '">' + esc(a.nome) + '</option>').join('') +
      '</select></label>' +
      '<div class="l2-modal-actions"><button type="button" class="btn" data-close-modal>Cancelar</button><button type="button" class="btn primary" id="camp-save">Salvar</button></div></div></div>';

  bindModalCloses(mount);
  mount.querySelector('#camp-new')?.addEventListener('click', () => openModal('modal-camp'));
  mount.querySelector('#camp-save')?.addEventListener('click', () => {
    store.create('campaigns', {
      nome: mount.querySelector('#camp-nome')?.value.trim() || 'Campanha',
      automation_id: mount.querySelector('#camp-auto')?.value,
      status: 'rascunho',
      enviados: 0,
    });
    closeModal('modal-camp');
    renderCampanhas(mount, path);
    window.AFSToast?.success('Campanha criada');
  });
  mount.querySelectorAll('[data-launch]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const c = store.get('campaigns', btn.dataset.launch);
      if (!c) return;
      const n = store.count('leads', (l) => (l.score || 0) >= 7);
      store.update('campaigns', c.id, { status: 'ativa', enviados: n, lancada_em: new Date().toISOString() });
      renderCampanhas(mount, path);
      window.AFSToast?.success('Campanha simulada — ' + n + ' leads afetados (sem gateway)');
    });
  });
}

export async function renderAutomacao({ path, mount }) {
  if (path.startsWith('/automacao/campanhas')) return renderCampanhas(mount, path);
  return renderJornadas(mount, path);
}
