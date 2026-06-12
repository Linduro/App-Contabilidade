import * as store from '../core/store.js';
import { openModal, closeModal, bindModalCloses } from '../components/modal.js';

const TABS = [
  { path: '/marketing/segmentacoes', label: 'Segmentações' },
  { path: '/marketing/templates', label: 'Templates' },
  { path: '/marketing/landing-pages', label: 'Landing pages' },
  { path: '/marketing/formularios', label: 'Formulários' },
];

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function tabNav(path) {
  return '<nav class="l2-subnav">' + TABS.map((t) =>
    '<a href="#' + t.path + '" class="' + (path === t.path || path.startsWith(t.path + '/') ? 'active' : '') + '">' + t.label + '</a>'
  ).join('') + '</nav>';
}

function countSegment(seg) {
  const f = seg.filtros || {};
  return store.list('leads', {
    filter: (l) => {
      if (f.uf && l.uf !== f.uf) return false;
      if (f.regime && l.regime_tributario !== f.regime) return false;
      if (f.scoreMin && (Number(l.score) || 0) < Number(f.scoreMin)) return false;
      return true;
    },
  }).total;
}

function renderSegmentacoes(mount, path) {
  const rows = store.list('segmentations').rows;
  mount.innerHTML =
    '<div class="crm-toolbar"><h2 style="margin:0">Marketing</h2>' +
    '<button type="button" class="btn primary sm" id="seg-new">+ Segmentação</button></div>' +
    tabNav(path) +
    '<div class="l2-card" style="margin-top:1rem">' +
    '<table class="data-table"><thead><tr><th>Nome</th><th>Filtros</th><th>Leads</th><th>Status</th><th></th></tr></thead><tbody>' +
    (rows.length ? rows.map((s) => {
      const n = countSegment(s);
      const filt = Object.entries(s.filtros || {}).map(([k, v]) => k + ': ' + v).join(', ') || '—';
      return '<tr data-seg="' + esc(s.id) + '"><td>' + esc(s.nome) + '</td><td>' + esc(filt) + '</td><td>' + n + '</td>' +
        '<td>' + (s.ativo ? 'Ativa' : 'Inativa') + '</td>' +
        '<td><button type="button" class="btn sm" data-toggle="' + esc(s.id) + '">' + (s.ativo ? 'Pausar' : 'Ativar') + '</button></td></tr>';
    }).join('') : '<tr><td colspan="5" class="hint">Nenhuma segmentação.</td></tr>') +
    '</tbody></table></div>' +
    '<div id="modal-seg" class="l2-modal-overlay"><div class="l2-modal">' +
      '<h3>Nova segmentação</h3>' +
      '<label class="l2-field"><span>Nome</span><input id="seg-nome"></label>' +
      '<label class="l2-field"><span>UF</span><input id="seg-uf" placeholder="SP"></label>' +
      '<label class="l2-field"><span>Score mínimo</span><input type="number" id="seg-score" min="0" max="10" step="0.1" value="7"></label>' +
      '<div class="l2-modal-actions"><button type="button" class="btn" data-close-modal>Cancelar</button><button type="button" class="btn primary" id="seg-save">Salvar</button></div>' +
    '</div></div>';

  bindModalCloses(mount);
  mount.querySelector('#seg-new')?.addEventListener('click', () => openModal('modal-seg'));
  mount.querySelector('#seg-save')?.addEventListener('click', () => {
    const nome = mount.querySelector('#seg-nome')?.value.trim();
    if (!nome) return window.AFSToast?.error('Informe o nome');
    const uf = mount.querySelector('#seg-uf')?.value.trim();
    const scoreMin = Number(mount.querySelector('#seg-score')?.value || 0);
    store.create('segmentations', { nome, filtros: { uf: uf || undefined, scoreMin }, ativo: true });
    closeModal('modal-seg');
    renderSegmentacoes(mount, path);
    window.AFSToast?.success('Segmentação criada');
  });
  mount.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const s = store.get('segmentations', btn.dataset.toggle);
      if (s) store.update('segmentations', s.id, { ativo: !s.ativo });
      renderSegmentacoes(mount, path);
    });
  });
}

function renderTemplates(mount, path) {
  const rows = store.list('emailTemplates').rows;
  mount.innerHTML =
    '<div class="crm-toolbar"><h2 style="margin:0">Marketing</h2>' +
    '<button type="button" class="btn primary sm" id="tpl-new">+ Template</button></div>' +
    tabNav(path) +
    '<div class="l2-card" style="margin-top:1rem">' +
    '<table class="data-table"><thead><tr><th>Nome</th><th>Assunto</th><th></th></tr></thead><tbody>' +
    rows.map((t) => '<tr><td>' + esc(t.nome) + '</td><td>' + esc(t.assunto) + '</td>' +
      '<td><button type="button" class="btn sm" data-preview="' + esc(t.id) + '">Preview</button></td></tr>').join('') +
    '</tbody></table></div>' +
    '<div id="modal-tpl" class="l2-modal-overlay"><div class="l2-modal wide">' +
      '<h3 id="tpl-modal-title">Template</h3><pre id="tpl-modal-body" style="white-space:pre-wrap;font-size:0.82rem"></pre>' +
      '<div class="l2-modal-actions"><button type="button" class="btn" data-close-modal>Fechar</button></div></div></div>' +
    '<div id="modal-tpl-new" class="l2-modal-overlay"><div class="l2-modal wide">' +
      '<h3>Novo template</h3>' +
      '<label class="l2-field"><span>Nome</span><input id="tpl-nome"></label>' +
      '<label class="l2-field"><span>Assunto</span><input id="tpl-assunto"></label>' +
      '<label class="l2-field"><span>Corpo</span><textarea id="tpl-corpo" rows="6"></textarea></label>' +
      '<div class="l2-modal-actions"><button type="button" class="btn" data-close-modal>Cancelar</button><button type="button" class="btn primary" id="tpl-save">Salvar</button></div></div></div>';

  bindModalCloses(mount);
  mount.querySelector('#tpl-new')?.addEventListener('click', () => openModal('modal-tpl-new'));
  mount.querySelector('#tpl-save')?.addEventListener('click', () => {
    store.create('emailTemplates', {
      nome: mount.querySelector('#tpl-nome')?.value.trim() || 'Sem nome',
      assunto: mount.querySelector('#tpl-assunto')?.value.trim() || '',
      corpo: mount.querySelector('#tpl-corpo')?.value || '',
    });
    closeModal('modal-tpl-new');
    renderTemplates(mount, path);
    window.AFSToast?.success('Template salvo');
  });
  mount.querySelectorAll('[data-preview]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = store.get('emailTemplates', btn.dataset.preview);
      mount.querySelector('#tpl-modal-title').textContent = t?.nome || '';
      mount.querySelector('#tpl-modal-body').textContent = 'Assunto: ' + (t?.assunto || '') + '\n\n' + (t?.corpo || '');
      openModal('modal-tpl');
    });
  });
}

function renderLandingPages(mount, path) {
  const rows = store.list('landingPages').rows;
  mount.innerHTML =
    '<div class="crm-toolbar"><h2 style="margin:0">Marketing</h2></div>' + tabNav(path) +
    '<div class="opp-summary-grid" style="margin-top:1rem">' +
    rows.map((lp) => '<div class="opp-summary-card" style="--accent:var(--afs-orange-500)">' +
      '<span>' + esc(lp.nome) + '</span><strong>' + (lp.views || 0) + '</strong><small>views · ' + (lp.conversoes || 0) + ' conversões</small>' +
      '<div class="hint" style="margin-top:0.5rem">/' + esc(lp.slug) + '</div></div>').join('') +
    '</div><p class="hint" style="margin-top:1rem">Publicação real requer hospedagem externa — dados locais para planejamento.</p>';
}

function renderFormularios(mount, path) {
  const forms = store.list('forms').rows;
  const lps = store.list('landingPages').rows;
  mount.innerHTML =
    '<div class="crm-toolbar"><h2 style="margin:0">Marketing</h2></div>' + tabNav(path) +
    '<div class="l2-card" style="margin-top:1rem"><table class="data-table"><thead><tr><th>Formulário</th><th>LP vinculada</th><th>Respostas</th></tr></thead><tbody>' +
    forms.map((f) => {
      const lp = lps.find((l) => l.id === f.landing_page_id);
      return '<tr><td>' + esc(f.nome) + '</td><td>' + esc(lp?.nome || '—') + '</td><td>' + (f.respostas || 0) + '</td></tr>';
    }).join('') +
    '</tbody></table></div>';
}

export async function renderMarketing({ path, mount }) {
  if (path.startsWith('/marketing/templates')) return renderTemplates(mount, path);
  if (path.startsWith('/marketing/landing-pages')) return renderLandingPages(mount, path);
  if (path.startsWith('/marketing/formularios')) return renderFormularios(mount, path);
  return renderSegmentacoes(mount, path);
}
