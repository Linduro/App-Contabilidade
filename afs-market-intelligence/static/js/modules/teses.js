/**
 * Teses & hipóteses comerciais (Parte 2 — antes do funil operacional).
 */
const TESES_LS = 'afs_market_teses';

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function loadTeses() {
  try { return JSON.parse(localStorage.getItem(TESES_LS) || '[]'); } catch { return []; }
}

function saveTeses(list) {
  localStorage.setItem(TESES_LS, JSON.stringify(list));
}

export async function renderTeses({ mount }) {
  mount.innerHTML =
    '<div class="pm-section-page">' +
      '<div class="pm-section-banner estrategia"><span>② Estratégia</span> Teses & hipóteses comerciais</div>' +
      '<section class="l2-card">' +
        '<h3>Antes do funil → depois do funil</h3>' +
        '<div class="pm-tese-flow">' +
          '<div class="pm-tese-step"><strong>1 · Base</strong><span>Laboratório: massa, filtros, mapas, CNAE</span></div>' +
          '<div class="pm-tese-arrow">→</div>' +
          '<div class="pm-tese-step"><strong>2 · Hipóteses</strong><span>Teses aqui → cold mail / LinkedIn</span></div>' +
          '<div class="pm-tese-arrow">→</div>' +
          '<div class="pm-tese-step"><strong>3 · Funil</strong><span>CRM → pipeline → fechamento</span></div>' +
        '</div>' +
        '<div class="pm-tese-form">' +
          '<input type="text" id="pm-tese-nome" placeholder="Nome (ex: Agro SP capital 2–10 mi)">' +
          '<textarea id="pm-tese-desc" rows="3" placeholder="Hipótese, canal, meta de reuniões…"></textarea>' +
          '<div class="pm-tese-form-row">' +
            '<select id="pm-tese-canal"><option value="cold_mail">Cold mail</option><option value="linkedin">LinkedIn</option><option value="misto">Misto</option></select>' +
            '<input type="text" id="pm-tese-faturamento" placeholder="Faturamento alvo (ex: até 100 mi)">' +
            '<button type="button" id="pm-tese-add" class="btn sm primary">Salvar tese</button>' +
          '</div>' +
        '</div>' +
        '<div id="pm-tese-list"></div>' +
        '<p class="hint" style="margin-top:1rem">Próxima fase: fluxograma visual (estilo n8n) ligando export → raspagem → e-mail.</p>' +
      '</section>' +
    '</div>';

  function renderList() {
    const list = loadTeses();
    const el = mount.querySelector('#pm-tese-list');
    if (!list.length) { el.innerHTML = '<p class="hint">Nenhuma tese salva.</p>'; return; }
    el.innerHTML = list.map(function (t, i) {
      return '<article class="pm-tese-card">' +
        '<header><strong>' + esc(t.nome) + '</strong> · <span class="pm-tag">' + esc(t.canal) + '</span></header>' +
        '<p>' + esc(t.desc) + '</p>' +
        (t.faturamento ? '<p class="hint">Faturamento: ' + esc(t.faturamento) + '</p>' : '') +
        '<button type="button" class="btn xs" data-tese-del="' + i + '">Remover</button></article>';
    }).join('');
    el.querySelectorAll('[data-tese-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        const arr = loadTeses();
        arr.splice(Number(b.getAttribute('data-tese-del')), 1);
        saveTeses(arr);
        renderList();
      });
    });
  }
  renderList();

  mount.querySelector('#pm-tese-add')?.addEventListener('click', function () {
    const nome = mount.querySelector('#pm-tese-nome')?.value.trim();
    if (!nome) { window.AFSToast?.warn('Informe o nome da tese'); return; }
    const arr = loadTeses();
    arr.unshift({
      nome,
      desc: mount.querySelector('#pm-tese-desc')?.value.trim() || '',
      canal: mount.querySelector('#pm-tese-canal')?.value || 'cold_mail',
      faturamento: mount.querySelector('#pm-tese-faturamento')?.value.trim() || '',
      criado_em: new Date().toISOString(),
    });
    saveTeses(arr);
    mount.querySelector('#pm-tese-nome').value = '';
    mount.querySelector('#pm-tese-desc').value = '';
    renderList();
    window.AFSToast?.success('Tese salva');
  });
}
