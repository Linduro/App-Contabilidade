import * as store from '../core/store.js';
import { openDrawer } from '../components/drawer.js';

const CANAIS = { email: 'E-mail', whatsapp: 'WhatsApp', telefone: 'Telefone', linkedin: 'LinkedIn' };

let state = { convId: null, canalFilter: '', statusFilter: '' };

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function leadOf(conv) {
  return store.get('leads', conv.lead_id);
}

function messagesOf(convId) {
  return store.list('messages', {
    filter: (m) => m.conversation_id === convId,
    sort: { key: 'criado_em', dir: 'asc' },
  }).rows;
}

function filteredConversations() {
  return store.list('conversations', {
    filter: (c) => {
      if (state.canalFilter && c.canal !== state.canalFilter) return false;
      if (state.statusFilter && c.status !== state.statusFilter) return false;
      return true;
    },
    sort: { key: 'ultima_msg_em', dir: 'desc' },
  }).rows;
}

function renderConvList(rows) {
  if (!rows.length) return '<p class="hint" style="padding:0.75rem">Nenhuma conversa.</p>';
  return rows.map((c) => {
    const lead = leadOf(c);
    const active = c.id === state.convId ? ' active' : '';
    const unread = c.nao_lidas > 0 ? '<span class="inbox-unread">' + c.nao_lidas + '</span>' : '';
    return '<button type="button" class="inbox-conv-item' + active + '" data-conv="' + esc(c.id) + '">' +
      '<div class="inbox-conv-top"><strong>' + esc(lead?.razao_social || c.assunto || 'Sem título') + '</strong>' + unread + '</div>' +
      '<div class="inbox-conv-sub">' + esc(CANAIS[c.canal] || c.canal) + ' · ' + fmtTime(c.ultima_msg_em) + '</div>' +
      '<div class="inbox-conv-preview">' + esc(c.ultima_preview || '') + '</div>' +
    '</button>';
  }).join('');
}

function renderThread(conv) {
  if (!conv) return '<div class="inbox-thread-empty"><p class="hint">Selecione uma conversa</p></div>';
  const msgs = messagesOf(conv.id);
  const lead = leadOf(conv);
  return '<div class="inbox-thread-head">' +
    '<div><strong>' + esc(lead?.razao_social || conv.assunto) + '</strong>' +
    '<div class="hint">' + esc(CANAIS[conv.canal] || conv.canal) + '</div></div>' +
    '<div class="inbox-thread-actions">' +
      '<button type="button" class="btn sm" id="inbox-mark-read">Marcar lida</button>' +
      '<a class="btn sm" href="#/crm/leads">Ver lead</a>' +
    '</div></div>' +
    '<div class="inbox-messages" id="inbox-messages">' +
      msgs.map((m) => {
        const cls = m.direcao === 'saida' ? 'out' : 'in';
        return '<div class="inbox-msg ' + cls + '">' +
          '<div class="inbox-msg-meta">' + esc(m.autor || '—') + ' · ' + fmtTime(m.criado_em) + '</div>' +
          '<div class="inbox-msg-body">' + esc(m.corpo) + '</div></div>';
      }).join('') +
    '</div>' +
    '<form class="inbox-compose" id="inbox-compose">' +
      '<textarea id="inbox-reply" rows="2" placeholder="Resposta manual (sem gateway real)…"></textarea>' +
      '<button type="submit" class="btn primary sm">Enviar</button>' +
    '</form>';
}

function renderDetails(conv) {
  if (!conv) return '<p class="hint">Detalhes do contato</p>';
  const lead = leadOf(conv);
  if (!lead) return '<p class="hint">Lead não encontrado.</p>';
  return '<h4>Contato</h4>' +
    '<dl class="inbox-details-dl">' +
      '<dt>Empresa</dt><dd>' + esc(lead.razao_social) + '</dd>' +
      '<dt>CNPJ</dt><dd>' + esc(lead.cnpj_basico) + '</dd>' +
      '<dt>E-mail</dt><dd>' + esc(lead.email || '—') + '</dd>' +
      '<dt>Telefone</dt><dd>' + esc(lead.telefone || '—') + '</dd>' +
      '<dt>Score</dt><dd>' + esc(lead.score) + '</dd>' +
      '<dt>Status funil</dt><dd>' + esc(lead.status_funil) + '</dd>' +
    '</dl>' +
    '<button type="button" class="btn sm" id="inbox-open-drawer">Abrir ficha</button>' +
    '<p class="hint" style="margin-top:1rem">Integração omnichannel pronta para gateway futuro (WhatsApp/VoIP/e-mail).</p>';
}

function sendReply(conv, text) {
  const body = String(text || '').trim();
  if (!body) return;
  const now = new Date().toISOString();
  store.create('messages', {
    conversation_id: conv.id,
    direcao: 'saida',
    corpo: body,
    autor: 'Você',
    criado_em: now,
  });
  store.update('conversations', conv.id, {
    ultima_msg_em: now,
    ultima_preview: body.slice(0, 80),
    nao_lidas: 0,
  });
  window.AFSToast?.success('Mensagem registrada (modo manual)');
}

function bindInbox(mount) {
  mount.querySelector('#inbox-filter-canal')?.addEventListener('change', (e) => {
    state.canalFilter = e.target.value;
    paint(mount);
  });
  mount.querySelector('#inbox-filter-status')?.addEventListener('change', (e) => {
    state.statusFilter = e.target.value;
    paint(mount);
  });
  mount.querySelectorAll('.inbox-conv-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.convId = btn.dataset.conv;
      const conv = store.get('conversations', state.convId);
      if (conv?.nao_lidas) store.update('conversations', conv.id, { nao_lidas: 0 });
      paint(mount);
    });
  });
  mount.querySelector('#inbox-mark-read')?.addEventListener('click', () => {
    const conv = store.get('conversations', state.convId);
    if (conv) store.update('conversations', conv.id, { nao_lidas: 0, status: 'lida' });
    paint(mount);
  });
  mount.querySelector('#inbox-compose')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const conv = store.get('conversations', state.convId);
    const text = mount.querySelector('#inbox-reply')?.value;
    if (conv) sendReply(conv, text);
    paint(mount);
  });
  mount.querySelector('#inbox-open-drawer')?.addEventListener('click', () => {
    const conv = store.get('conversations', state.convId);
    const lead = leadOf(conv);
    if (!lead) return;
    openDrawer(lead.razao_social, '<dl class="drawer-grid">' +
      '<dt>Regime</dt><dd>' + esc(lead.regime_tributario) + '</dd>' +
      '<dt>UF</dt><dd>' + esc(lead.uf) + '</dd>' +
      '<dt>E-mail</dt><dd>' + esc(lead.email) + '</dd>' +
      '</dl>');
  });
  const box = mount.querySelector('#inbox-messages');
  if (box) box.scrollTop = box.scrollHeight;
}

function paint(mount) {
  const convs = filteredConversations();
  if (!state.convId && convs.length) state.convId = convs[0].id;
  const conv = store.get('conversations', state.convId);
  mount.querySelector('.inbox-col-list').innerHTML =
    '<div class="inbox-filters">' +
      '<select id="inbox-filter-canal" class="l2-select"><option value="">Todos canais</option>' +
        Object.entries(CANAIS).map(([k, v]) => '<option value="' + k + '"' + (state.canalFilter === k ? ' selected' : '') + '>' + v + '</option>').join('') +
      '</select>' +
      '<select id="inbox-filter-status" class="l2-select"><option value="">Todos status</option>' +
        '<option value="aberta"' + (state.statusFilter === 'aberta' ? ' selected' : '') + '>Aberta</option>' +
        '<option value="lida"' + (state.statusFilter === 'lida' ? ' selected' : '') + '>Lida</option>' +
      '</select>' +
    '</div>' + renderConvList(convs);
  mount.querySelector('.inbox-col-thread').innerHTML = renderThread(conv);
  mount.querySelector('.inbox-col-details').innerHTML = renderDetails(conv);
  bindInbox(mount);
}

export async function renderComunicacaoInbox({ mount }) {
  const unread = store.count('conversations', (c) => (c.nao_lidas || 0) > 0);
  mount.innerHTML =
    '<div class="crm-toolbar">' +
      '<div><h2 style="margin:0">Caixa de entrada</h2>' +
      '<p class="hint">Omnichannel local — ' + unread + ' conversa(s) com mensagens não lidas</p></div>' +
      '<button type="button" class="btn primary sm" id="inbox-new">+ Nova conversa</button>' +
    '</div>' +
    '<div class="inbox-3col">' +
      '<div class="inbox-col inbox-col-list l2-card"></div>' +
      '<div class="inbox-col inbox-col-thread l2-card"></div>' +
      '<div class="inbox-col inbox-col-details l2-card"></div>' +
    '</div>';

  mount.querySelector('#inbox-new')?.addEventListener('click', () => {
    const leads = store.list('leads').rows;
    if (!leads.length) return window.AFSToast?.error('Nenhum lead na base');
    const lead = leads[0];
    const conv = store.create('conversations', {
      lead_id: lead.id,
      canal: 'email',
      assunto: 'Nova conversa — ' + lead.razao_social,
      status: 'aberta',
      nao_lidas: 0,
      ultima_msg_em: new Date().toISOString(),
      ultima_preview: 'Conversa iniciada',
    });
    store.create('messages', {
      conversation_id: conv.id,
      direcao: 'saida',
      corpo: 'Olá, gostaríamos de conversar sobre conformidade fiscal.',
      autor: 'Você',
      criado_em: new Date().toISOString(),
    });
    state.convId = conv.id;
    paint(mount);
    window.AFSToast?.success('Conversa criada');
  });

  paint(mount);
}
