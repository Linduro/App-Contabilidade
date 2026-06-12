import * as store from '../core/store.js';
import { openModal, closeModal, bindModalCloses } from '../components/modal.js';
import { recalculateAllScores } from '../core/scoring.js';

const SCORING_KEYS = [
  { key: 'capital', label: 'Capital social' },
  { key: 'filiais', label: 'Quantidade de filiais' },
  { key: 'regime', label: 'Regime tributário' },
  { key: 'cnae', label: 'CNAE estratégico' },
  { key: 'porte', label: 'Porte da empresa' },
];

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function renderScoring(mount) {
  const scoring = store.getSettings().scoring || {};
  mount.querySelector('#cfg-scoring').innerHTML = SCORING_KEYS.map((s) =>
    '<label class="l2-field config-slider"><span>' + s.label + ' (' + (scoring[s.key] ?? 5) + ')</span>' +
    '<input type="range" min="0" max="10" step="1" data-score-key="' + s.key + '" value="' + (scoring[s.key] ?? 5) + '"></label>'
  ).join('');

  mount.querySelectorAll('[data-score-key]').forEach((input) => {
    input.addEventListener('input', () => {
      const key = input.dataset.scoreKey;
      const val = Number(input.value);
      input.previousElementSibling.textContent = SCORING_KEYS.find((x) => x.key === key).label + ' (' + val + ')';
      const current = store.getSettings().scoring || {};
      store.setSettings({ scoring: { ...current, [key]: val } });
    });
  });
}

function renderPipelines(mount) {
  const pipes = store.list('pipelines').rows;
  const stages = store.list('stages', { sort: { key: 'ordem', dir: 'asc' } }).rows;
  mount.querySelector('#cfg-pipelines').innerHTML = pipes.map((p) => {
    const st = stages.filter((s) => s.pipeline_id === p.id);
    return '<div class="config-pipe-block"><h4>' + esc(p.nome) + '</h4><ol class="config-stage-list">' +
      st.map((s) => '<li><span class="stage-dot" style="background:' + esc(s.cor) + '"></span>' +
        esc(s.nome) + ' <small class="hint">' + s.probabilidade + '%</small></li>').join('') +
      '</ol></div>';
  }).join('') || '<p class="hint">Nenhum pipeline.</p>';
}

function renderTags(mount) {
  const tags = store.list('tags').rows;
  mount.querySelector('#cfg-tags').innerHTML =
    '<div class="config-tag-chips">' + tags.map((t) =>
      '<span class="tag-chip" style="border-color:' + esc(t.cor) + '">' + esc(t.nome) +
      '<button type="button" data-del-tag="' + esc(t.id) + '" aria-label="Remover">×</button></span>'
    ).join('') + '</div>';

  mount.querySelectorAll('[data-del-tag]').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.remove('tags', btn.dataset.delTag);
      renderTags(mount);
    });
  });
}

function renderUsers(mount) {
  const users = store.list('users').rows;
  mount.querySelector('#cfg-users').innerHTML =
    '<table class="data-table compact"><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th></tr></thead><tbody>' +
    users.map((u) => '<tr><td>' + esc(u.nome) + '</td><td>' + esc(u.email) + '</td><td>' + esc(u.papel) + '</td></tr>').join('') +
    '</tbody></table>';
}

export async function renderConfiguracoes({ mount }) {
  mount.innerHTML =
    '<div class="crm-toolbar"><h2 style="margin:0">Configurações</h2></div>' +
    '<div class="config-grid">' +
      '<section class="l2-card"><h3>Scoring ICP</h3><p class="hint">Pesos para cálculo do score (0–10)</p><div id="cfg-scoring"></div>' +
      '<button type="button" class="btn sm" id="cfg-recalc-scores" style="margin-top:0.75rem">Recalcular scores dos leads</button></section>' +
      '<section class="l2-card"><h3>Pipelines</h3><div id="cfg-pipelines"></div></section>' +
      '<section class="l2-card"><h3>Tags <button type="button" class="btn sm" id="tag-new">+ Tag</button></h3><div id="cfg-tags"></div></section>' +
      '<section class="l2-card"><h3>Usuários autorizados</h3><div id="cfg-users"></div></section>' +
    '</div>' +
    '<div id="modal-tag" class="l2-modal-overlay"><div class="l2-modal">' +
      '<h3>Nova tag</h3>' +
      '<label class="l2-field"><span>Nome</span><input id="tag-nome"></label>' +
      '<label class="l2-field"><span>Cor</span><input type="color" id="tag-cor" value="#e8681a"></label>' +
      '<div class="l2-modal-actions"><button type="button" class="btn" data-close-modal>Cancelar</button><button type="button" class="btn primary" id="tag-save">Salvar</button></div></div></div>';

  bindModalCloses(mount);
  renderScoring(mount);
  renderPipelines(mount);
  renderTags(mount);
  renderUsers(mount);

  mount.querySelector('#cfg-recalc-scores')?.addEventListener('click', () => {
    const n = recalculateAllScores();
    window.AFSToast?.success('Scores recalculados em ' + n + ' leads');
  });

  mount.querySelector('#tag-new')?.addEventListener('click', () => openModal('modal-tag'));
  mount.querySelector('#tag-save')?.addEventListener('click', () => {
    const nome = mount.querySelector('#tag-nome')?.value.trim();
    if (!nome) return window.AFSToast?.error('Informe o nome');
    store.create('tags', { nome, cor: mount.querySelector('#tag-cor')?.value || '#e8681a' });
    closeModal('modal-tag');
    renderTags(mount);
    window.AFSToast?.success('Tag criada');
  });
}
