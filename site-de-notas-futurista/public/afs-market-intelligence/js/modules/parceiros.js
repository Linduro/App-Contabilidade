import * as store from '../core/store.js';
import { openModal, closeModal, bindModalCloses } from '../components/modal.js';

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function renderTable(mount) {
  const rows = store.list('partners').rows;
  mount.querySelector('#par-table-wrap').innerHTML =
    '<table class="data-table" id="par-table"><thead><tr>' +
      '<th>Parceiro</th><th>Rede</th><th>UF</th><th>Contato</th><th>Status</th><th></th>' +
    '</tr></thead><tbody>' +
    (rows.length ? rows.map((p) =>
      '<tr><td><strong>' + esc(p.nome) + '</strong><br><small class="hint">' + esc(p.website || '') + '</small></td>' +
      '<td>' + esc(p.rede || '—') + '</td><td>' + esc(p.uf || '—') + '</td>' +
      '<td>' + esc(p.email || '—') + '<br>' + esc(p.telefone || '') + '</td>' +
      '<td><span class="act-status' + (p.status_parceria === 'ativo' ? ' status-ok' : '') + '">' + esc(p.status_parceria || '—') + '</span></td>' +
      '<td><button type="button" class="btn sm" data-acionar="' + esc(p.id) + '">Acionar</button></td></tr>'
    ).join('') : '<tr><td colspan="6" class="hint">Nenhum parceiro cadastrado.</td></tr>') +
    '</tbody></table>';

  mount.querySelectorAll('[data-acionar]').forEach((btn) => {
    btn.addEventListener('click', () => openAcionarModal(mount, btn.dataset.acionar));
  });
}

function openAcionarModal(mount, partnerId) {
  const leads = store.list('leads', {
    filter: (l) => l.status_funil !== 'dead_zone' && l.status_funil !== 'perdido',
    sort: { key: 'score', dir: 'desc' },
    limit: 50,
  }).rows;
  const partner = store.get('partners', partnerId);
  mount.querySelector('#modal-acionar-body').innerHTML =
    '<p class="hint">Encaminhar lead para <strong>' + esc(partner?.nome) + '</strong> (registro local B2B2B)</p>' +
    '<label class="l2-field"><span>Lead</span><select id="acionar-lead" class="l2-select">' +
      leads.map((l) => '<option value="' + l.id + '">' + esc(l.razao_social) + ' (score ' + l.score + ')</option>').join('') +
    '</select></label>' +
    '<label class="l2-field"><span>Observações</span><textarea id="acionar-obs" rows="3" placeholder="Contexto para o parceiro…"></textarea></label>' +
    '<input type="hidden" id="acionar-partner" value="' + esc(partnerId) + '">';
  openModal('modal-acionar');
}

export async function renderParceiros({ mount }) {
  mount.innerHTML =
    '<div class="crm-toolbar"><div><h2 style="margin:0">Parceiros B2B2B</h2>' +
    '<p class="hint">Rede de bancas parceiras — canal de indicação</p></div>' +
    '<button type="button" class="btn primary sm" id="par-new">+ Parceiro</button></div>' +
    '<div class="l2-card" id="par-table-wrap"></div>' +
    '<div id="modal-par" class="l2-modal-overlay"><div class="l2-modal">' +
      '<h3>Novo parceiro</h3>' +
      '<label class="l2-field"><span>Nome</span><input id="par-nome"></label>' +
      '<label class="l2-field"><span>Rede</span><input id="par-rede" placeholder="Independente"></label>' +
      '<label class="l2-field"><span>UF</span><input id="par-uf" maxlength="2"></label>' +
      '<label class="l2-field"><span>E-mail</span><input id="par-email" type="email"></label>' +
      '<label class="l2-field"><span>Telefone</span><input id="par-tel"></label>' +
      '<label class="l2-field"><span>Website</span><input id="par-web"></label>' +
      '<div class="l2-modal-actions"><button type="button" class="btn" data-close-modal>Cancelar</button><button type="button" class="btn primary" id="par-save">Salvar</button></div>' +
    '</div></div>' +
    '<div id="modal-acionar" class="l2-modal-overlay"><div class="l2-modal">' +
      '<h3>Acionar parceiro</h3><div id="modal-acionar-body"></div>' +
      '<div class="l2-modal-actions"><button type="button" class="btn" data-close-modal>Cancelar</button>' +
      '<button type="button" class="btn primary" id="acionar-save">Registrar indicação</button></div></div></div>';

  bindModalCloses(mount);
  renderTable(mount);

  mount.querySelector('#par-new')?.addEventListener('click', () => openModal('modal-par'));
  mount.querySelector('#par-save')?.addEventListener('click', () => {
    const nome = mount.querySelector('#par-nome')?.value.trim();
    if (!nome) return window.AFSToast?.error('Informe o nome');
    store.create('partners', {
      nome,
      rede: mount.querySelector('#par-rede')?.value.trim() || 'Independente',
      uf: mount.querySelector('#par-uf')?.value.trim().toUpperCase(),
      email: mount.querySelector('#par-email')?.value.trim(),
      telefone: mount.querySelector('#par-tel')?.value.trim(),
      website: mount.querySelector('#par-web')?.value.trim(),
      status_parceria: 'ativo',
    });
    closeModal('modal-par');
    renderTable(mount);
    window.AFSToast?.success('Parceiro cadastrado');
  });

  mount.querySelector('#acionar-save')?.addEventListener('click', () => {
    const leadId = mount.querySelector('#acionar-lead')?.value;
    const partnerId = mount.querySelector('#acionar-partner')?.value;
    const obs = mount.querySelector('#acionar-obs')?.value.trim();
    const partner = store.get('partners', partnerId);
    const lead = store.get('leads', leadId);
    if (!lead || !partner) return;
    store.create('activities', {
      tipo: 'tarefa',
      titulo: 'Indicação B2B2B — ' + partner.nome,
      lead_id: leadId,
      responsavel_id: 'u_owner',
      agendado_para: new Date().toISOString(),
      status: 'pendente',
      notas: obs,
    });
    store.update('leads', leadId, { status_funil: 'proposta_enviada', parceiro_id: partnerId });
    closeModal('modal-acionar');
    window.AFSToast?.success('Indicação registrada para ' + partner.nome);
    renderTable(mount);
  });
}
