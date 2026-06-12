import * as store from '../core/store.js';
import { initDealKanban } from '../components/kanban.js';
import { openDrawer, closeDrawer } from '../components/drawer.js';
import { openModal, closeModal, bindModalCloses } from '../components/modal.js';

const STAGE_TO_FUNIL = {
  st_prosp: 'prospectado',
  st_contato: 'contato_feito',
  st_prop: 'proposta_enviada',
  st_neg: 'negociacao',
  st_ganho: 'fechado',
  st_perd: 'perdido',
};

let state = { pipelineId: 'pipe_vendas', view: 'kanban', destroyKanban: null };

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function money(v) {
  if (!v) return 'R$ 0';
  return 'R$ ' + Number(v).toLocaleString('pt-BR');
}

function pipelines() {
  return store.list('pipelines', { filter: (p) => p.ativo !== false }).rows;
}

function stagesFor(pipeId) {
  return store.list('stages', { filter: (s) => s.pipeline_id === pipeId })
    .rows.sort((a, b) => a.ordem - b.ordem);
}

function dealsFor(pipeId) {
  return store.list('deals', { filter: (d) => d.pipeline_id === pipeId && d.status === 'aberto' }).rows;
}

function userName(id) {
  return store.get('users', id)?.nome || '—';
}

function leadFor(id) {
  return id ? store.get('leads', id) : null;
}

function computeMetrics(pipeId) {
  const stages = stagesFor(pipeId);
  const deals = dealsFor(pipeId);
  const totalValor = deals.reduce((s, d) => s + (Number(d.valor) || 0), 0);
  const byStage = stages.map((st) => {
    const inStage = deals.filter((d) => d.stage_id === st.id);
    const valor = inStage.reduce((s, d) => s + (Number(d.valor) || 0), 0);
    return { stage: st, count: inStage.length, valor };
  });
  const won = deals.filter((d) => stages.find((s) => s.id === d.stage_id)?.is_won).length;
  const conv = deals.length ? ((won / deals.length) * 100).toFixed(1) : '0';
  return { total: deals.length, totalValor, byStage, conv };
}

function moveDeal(dealId, stageId) {
  const deal = store.get('deals', dealId);
  const stage = store.get('stages', stageId);
  if (!deal || !stage) return;
  const patch = { stage_id: stageId };
  if (stage.is_won) patch.status = 'ganho';
  if (stage.is_lost) patch.status = 'perdido';
  store.update('deals', dealId, patch);
  if (deal.lead_id && STAGE_TO_FUNIL[stageId]) {
    store.update('leads', deal.lead_id, { status_funil: STAGE_TO_FUNIL[stageId] });
  }
  store.create('activities', {
    tipo: 'tarefa',
    titulo: 'Negócio movido para ' + stage.nome,
    deal_id: dealId,
    lead_id: deal.lead_id,
    responsavel_id: deal.responsavel_id,
    agendado_para: new Date().toISOString(),
    status: 'concluida',
    outcome: 'movimento_etapa',
  });
  window.AFSToast?.success('Etapa atualizada');
}

function renderKanban(pipeId) {
  const stages = stagesFor(pipeId);
  const deals = dealsFor(pipeId);
  return '<div class="kanban-board" id="deal-kanban">' + stages.map((st) => {
    const cards = deals.filter((d) => d.stage_id === st.id);
    const sum = cards.reduce((s, d) => s + (Number(d.valor) || 0), 0);
    return '<div class="kanban-col">' +
      '<div class="kanban-col-head" style="border-top:3px solid ' + esc(st.cor) + '">' +
        '<strong>' + esc(st.nome) + '</strong>' +
        '<span class="kanban-col-meta">' + cards.length + ' · ' + money(sum) + '</span>' +
      '</div>' +
      '<div class="kanban-col-body" data-stage-id="' + esc(st.id) + '">' +
        cards.map((d) => renderCard(d)).join('') +
      '</div></div>';
  }).join('') + '</div>';
}

function renderCard(d) {
  const lead = leadFor(d.lead_id);
  return '<div class="kanban-card" data-deal-id="' + esc(d.id) + '">' +
    '<div class="kanban-card-title">' + esc(d.titulo) + '</div>' +
    '<div class="kanban-card-val">' + money(d.valor) + '</div>' +
    (lead ? '<div class="kanban-card-sub">' + esc(lead.razao_social) + '</div>' : '') +
    '<div class="kanban-card-foot"><span>' + esc(userName(d.responsavel_id)) + '</span></div>' +
  '</div>';
}

function renderList(pipeId) {
  const deals = dealsFor(pipeId);
  const stages = stagesFor(pipeId);
  const stageMap = Object.fromEntries(stages.map((s) => [s.id, s.nome]));
  return '<table class="data-table compact"><thead><tr><th>Negócio</th><th>Etapa</th><th>Valor</th><th>Responsável</th><th>Empresa</th></tr></thead><tbody>' +
    deals.map((d) => {
      const lead = leadFor(d.lead_id);
      return '<tr data-deal-row="' + esc(d.id) + '"><td>' + esc(d.titulo) + '</td><td>' + esc(stageMap[d.stage_id] || '—') + '</td><td>' + money(d.valor) + '</td><td>' + esc(userName(d.responsavel_id)) + '</td><td>' + esc(lead?.razao_social || '—') + '</td></tr>';
    }).join('') +
  '</tbody></table>';
}

function renderMetrics(pipeId) {
  const m = computeMetrics(pipeId);
  return '<div class="pipe-metrics l2-card">' +
    '<h4>Pipe Metrics</h4>' +
    '<div class="pipe-metrics-row">' +
      '<span><strong>' + m.total + '</strong> negócios abertos</span>' +
      '<span><strong>' + money(m.totalValor) + '</strong> em pipeline</span>' +
      '<span><strong>' + m.conv + '%</strong> conversão (ganhos)</span>' +
    '</div>' +
    '<div class="pipe-metrics-bars">' + m.byStage.map((b) => {
      const pct = m.total ? Math.round((b.count / m.total) * 100) : 0;
      return '<div class="pipe-bar-row"><span>' + esc(b.stage.nome) + '</span>' +
        '<div class="pipe-bar-track"><div class="pipe-bar-fill" style="width:' + pct + '%;background:' + esc(b.stage.cor) + '"></div></div>' +
        '<span>' + b.count + '</span></div>';
    }).join('') + '</div></div>';
}

function modalsHtml(pipeId) {
  const stages = stagesFor(pipeId);
  const leads = store.list('leads').rows;
  const users = store.list('users').rows;
  const products = store.list('products').rows;
  return '<div class="l2-modal-overlay" id="modal-novo-negocio">' +
    '<div class="l2-modal"><h3>Novo Negócio</h3>' +
    '<form id="form-novo-negocio">' +
      '<label class="l2-field"><span>Nome do negócio</span><input name="titulo" required></label>' +
      '<label class="l2-field"><span>Lead / Empresa</span><select name="lead_id"><option value="">—</option>' +
        leads.map((l) => '<option value="' + l.id + '">' + esc(l.razao_social) + '</option>').join('') +
      '</select></label>' +
      '<label class="l2-field"><span>Etapa</span><select name="stage_id">' +
        stages.filter((s) => !s.is_won && !s.is_lost).map((s) => '<option value="' + s.id + '">' + esc(s.nome) + '</option>').join('') +
      '</select></label>' +
      '<label class="l2-field"><span>Responsável</span><select name="responsavel_id">' +
        users.map((u) => '<option value="' + u.id + '">' + esc(u.nome) + '</option>').join('') +
      '</select></label>' +
      '<label class="l2-field"><span>Valor (R$)</span><input name="valor" type="number" min="0" step="100"></label>' +
      '<label class="l2-field"><span>Produto</span><select name="product_id"><option value="">—</option>' +
        products.map((p) => '<option value="' + p.id + '">' + esc(p.nome) + ' — ' + money(p.preco) + '</option>').join('') +
      '</select></label>' +
      '<div class="l2-modal-actions">' +
        '<button type="button" class="btn" data-close-modal="modal-novo-negocio">Cancelar</button>' +
        '<button type="submit" class="btn primary">Novo Negócio</button>' +
        '<button type="button" class="btn" id="btn-criar-outro">Criar e Adicionar Outro</button>' +
      '</div></form></div></div>' +
    '<div class="l2-modal-overlay" id="modal-config-funil">' +
    '<div class="l2-modal wide"><h3>Configuração de Funil</h3>' +
      '<p class="hint">Etapas do pipeline selecionado (cor, probabilidade, ganho/perda).</p>' +
      '<table class="data-table compact"><thead><tr><th>Ordem</th><th>Nome</th><th>Cor</th><th>Prob. %</th><th>Ganho</th><th>Perda</th></tr></thead><tbody>' +
      stages.map((s) => '<tr><td>' + s.ordem + '</td><td>' + esc(s.nome) + '</td><td><span style="color:' + esc(s.cor) + '">●</span></td><td>' + s.probabilidade + '%</td><td>' + (s.is_won ? '✓' : '') + '</td><td>' + (s.is_lost ? '✓' : '') + '</td></tr>').join('') +
      '</tbody></table>' +
      '<p class="hint">Edição completa em Configurações (próxima fase).</p>' +
      '<button type="button" class="btn" data-close-modal="modal-config-funil">Fechar</button>' +
    '</div></div>';
}

function showDealDrawer(dealId) {
  const d = store.get('deals', dealId);
  if (!d) return;
  const lead = leadFor(d.lead_id);
  const stage = store.get('stages', d.stage_id);
  const acts = store.list('activities', { filter: (a) => a.deal_id === dealId }).rows.slice(-8).reverse();
  openDrawer(d.titulo, '<div class="drawer-grid">' +
    '<div><span class="hint">Valor</span><br>' + money(d.valor) + '</div>' +
    '<div><span class="hint">Etapa</span><br>' + esc(stage?.nome) + '</div>' +
    '<div><span class="hint">Responsável</span><br>' + esc(userName(d.responsavel_id)) + '</div>' +
    '<div><span class="hint">Empresa</span><br>' + esc(lead?.razao_social || '—') + '</div>' +
    '</div>' +
    (lead ? '<p class="hint" style="margin-top:1rem">CNPJ ' + esc(lead.cnpj_basico) + ' · ' + esc(lead.regime_tributario) + ' · Score ' + esc(lead.score) + '</p>' : '') +
    '<h4 style="margin-top:1.25rem">Atividades recentes</h4>' +
    (acts.length ? '<ul class="l2-timeline">' + acts.map((a) => '<li>' + esc(a.titulo) + ' <small>' + esc(a.status) + '</small></li>').join('') + '</ul>' : '<p class="hint">Nenhuma atividade.</p>') +
    '<button type="button" class="btn primary" style="margin-top:1rem" id="drawer-close-deal">Fechar</button>');
  document.getElementById('drawer-close-deal')?.addEventListener('click', closeDrawer);
}

function bindPipelinesUI(mount, pipeId) {
  if (state.destroyKanban) state.destroyKanban();
  state.destroyKanban = null;

  bindModalCloses(mount);

  mount.querySelector('#pipe-select')?.addEventListener('change', (e) => {
    state.pipelineId = e.target.value;
    renderPipelines({ mount });
  });

  mount.querySelector('#btn-novo-negocio')?.addEventListener('click', () => openModal('modal-novo-negocio'));
  mount.querySelector('#btn-config-funil')?.addEventListener('click', () => openModal('modal-config-funil'));
  mount.querySelector('#view-kanban')?.addEventListener('click', () => { state.view = 'kanban'; renderPipelines({ mount }); });
  mount.querySelector('#view-lista')?.addEventListener('click', () => { state.view = 'lista'; renderPipelines({ mount }); });

  const form = mount.querySelector('#form-novo-negocio');
  let addAnother = false;
  mount.querySelector('#btn-criar-outro')?.addEventListener('click', () => { addAnother = true; form?.requestSubmit(); });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const productId = fd.get('product_id');
    const produtos = productId ? [{ product_id: productId, qtd: 1, preco: store.get('products', productId)?.preco || 0 }] : [];
    const stageId = fd.get('stage_id') || stagesFor(pipeId)[0]?.id;
    store.create('deals', {
      titulo: fd.get('titulo'),
      lead_id: fd.get('lead_id') || null,
      pipeline_id: pipeId,
      stage_id: stageId,
      responsavel_id: fd.get('responsavel_id'),
      valor: Number(fd.get('valor')) || 0,
      status: 'aberto',
      produtos,
    });
    window.AFSToast?.success('Negócio criado');
    if (!addAnother) closeModal('modal-novo-negocio');
    else form.reset();
    addAnother = false;
    renderPipelines({ mount });
  });

  mount.querySelectorAll('.kanban-card').forEach((card) => {
    card.addEventListener('click', () => showDealDrawer(card.dataset.dealId));
  });
  mount.querySelectorAll('[data-deal-row]').forEach((row) => {
    row.addEventListener('click', () => showDealDrawer(row.dataset.dealRow));
  });

  const board = mount.querySelector('#deal-kanban');
  if (board && state.view === 'kanban') {
    state.destroyKanban = initDealKanban(board, (dealId, stageId) => {
      moveDeal(dealId, stageId);
      renderPipelines({ mount });
    });
  }
}

export async function renderPipelines({ mount }) {
  const pipes = pipelines();
  if (!pipes.find((p) => p.id === state.pipelineId)) state.pipelineId = pipes[0]?.id || 'pipe_vendas';
  const pipeId = state.pipelineId;
  const pipe = store.get('pipelines', pipeId);

  mount.innerHTML =
    '<div class="crm-pipelines">' +
      '<div class="crm-toolbar">' +
        '<div class="crm-toolbar-left">' +
          '<select id="pipe-select" class="l2-select">' +
            pipes.map((p) => '<option value="' + p.id + '"' + (p.id === pipeId ? ' selected' : '') + '>' + esc(p.nome) + '</option>').join('') +
          '</select>' +
          '<div class="view-toggle">' +
            '<button type="button" class="btn sm' + (state.view === 'kanban' ? ' primary' : '') + '" id="view-kanban">Quadro</button>' +
            '<button type="button" class="btn sm' + (state.view === 'lista' ? ' primary' : '') + '" id="view-lista">Lista</button>' +
          '</div>' +
        '</div>' +
        '<div class="crm-toolbar-right">' +
          '<button type="button" class="btn" id="btn-config-funil">Configuração de Funil</button>' +
          '<button type="button" class="btn primary" id="btn-novo-negocio">+ Negócio</button>' +
        '</div>' +
      '</div>' +
      '<p class="hint">' + esc(pipe?.nome || 'Pipeline') + ' — arraste cards entre etapas</p>' +
      (state.view === 'kanban' ? renderKanban(pipeId) : renderList(pipeId)) +
      renderMetrics(pipeId) +
      modalsHtml(pipeId) +
    '</div>';

  bindPipelinesUI(mount, pipeId);
}
