import * as store from '../core/store.js';

const ROTAS = ['email', 'linkedin', 'telefone', 'whatsapp', 'parceiro'];

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function deadZoneLeads() {
  return store.list('leads', {
    filter: (l) => l.status_funil === 'dead_zone' || l.dead_zone,
    sort: { key: 'score', dir: 'desc' },
  }).rows;
}

let state = { motivo: '', prioridade: '', rota: '' };

function applyDzFilters(rows) {
  return rows.filter((l) => {
    const dz = l.dead_zone || {};
    if (state.motivo && !String(dz.motivo || '').toLowerCase().includes(state.motivo.toLowerCase())) return false;
    if (state.prioridade && dz.prioridade !== state.prioridade) return false;
    if (state.rota && dz.rota !== state.rota) return false;
    return true;
  });
}

function reativarLead(id) {
  store.update('leads', id, {
    status_funil: 'prospectado',
    dead_zone: null,
  });
  window.AFSToast?.success('Lead reativado');
}

export async function renderDeadZone({ mount }) {
  function paint() {
    const rows = applyDzFilters(deadZoneLeads());
    mount.querySelector('#dz-table-wrap').innerHTML =
      '<table class="data-table" id="dz-table"><thead><tr>' +
        '<th>Empresa</th><th>Motivo</th><th>Rota recomendada</th><th>Prioridade</th><th>Contato</th><th></th>' +
      '</tr></thead><tbody>' +
      (rows.length ? rows.map((l) => {
        const dz = l.dead_zone || {};
        return '<tr><td>' + esc(l.razao_social) + '</td><td>' + esc(dz.motivo || '—') + '</td>' +
          '<td><strong>' + esc(dz.rota || '—') + '</strong></td>' +
          '<td>' + esc(dz.prioridade || '—') + '</td>' +
          '<td>' + esc(l.telefone || l.email || '—') + '</td>' +
          '<td><button type="button" class="btn sm" data-reativar="' + esc(l.id) + '">Reativar</button></td></tr>';
      }).join('') : '<tr><td colspan="6" class="hint">Nenhum lead em dead zone.</td></tr>') +
      '</tbody></table>';

    mount.querySelectorAll('[data-reativar]').forEach((btn) => {
      btn.addEventListener('click', () => { reativarLead(btn.dataset.reativar); paint(); });
    });
  }

  mount.innerHTML =
    '<div class="crm-toolbar"><div><h2 style="margin:0">Dead Zone</h2>' +
    '<p class="hint">Leads sem canal digital direto — rotas alternativas de abordagem</p></div></div>' +
    '<div class="l2-card">' +
      '<div class="leads-filters-grid">' +
        '<label class="l2-field"><span>Motivo contém</span><input id="dz-motivo" value="' + esc(state.motivo) + '"></label>' +
        '<label class="l2-field"><span>Prioridade</span><select id="dz-prioridade" class="l2-select"><option value="">Todas</option>' +
          ['alta', 'media', 'baixa'].map((p) => '<option value="' + p + '"' + (state.prioridade === p ? ' selected' : '') + '>' + p + '</option>').join('') +
        '</select></label>' +
        '<label class="l2-field"><span>Rota</span><select id="dz-rota" class="l2-select"><option value="">Todas</option>' +
          ROTAS.map((r) => '<option value="' + r + '"' + (state.rota === r ? ' selected' : '') + '>' + r + '</option>').join('') +
        '</select></label>' +
      '</div>' +
      '<button type="button" class="btn sm" id="dz-filter" style="margin-top:0.75rem">Filtrar</button>' +
    '</div>' +
    '<div class="l2-card" style="margin-top:1rem" id="dz-table-wrap"></div>';

  mount.querySelector('#dz-filter')?.addEventListener('click', () => {
    state.motivo = mount.querySelector('#dz-motivo')?.value.trim() || '';
    state.prioridade = mount.querySelector('#dz-prioridade')?.value || '';
    state.rota = mount.querySelector('#dz-rota')?.value || '';
    paint();
  });
  paint();
}
