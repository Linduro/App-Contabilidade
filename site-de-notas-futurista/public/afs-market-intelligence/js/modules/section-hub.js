/**
 * Landing pages leves para seções (Laboratório, Estratégia, Operação).
 */
import { NAV_SECTIONS } from '../shell/nav-config.js';

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function hubCards(sectionId) {
  const sec = NAV_SECTIONS.find((s) => s.id === sectionId);
  if (!sec) return '';
  return sec.items.map(function (item) {
    return '<a class="l2-onboard-card pm-hub-card" href="#' + item.hash + '">' +
      '<span class="pm-hub-icon">' + item.icon + '</span>' +
      '<h4>' + esc(item.label) + '</h4>' +
      '<small>Abrir →</small></a>';
  }).join('');
}

export async function renderLabHub({ mount }) {
  mount.innerHTML =
    '<div class="pm-section-page">' +
      '<div class="pm-section-banner lab"><span>① Laboratório</span> Captação, análises, filtros, raspagem e mapas</div>' +
      '<p class="hint">Centro de inteligência: base RF (~230k LR), mapas do Brasil, auditorias, patrimonial e CNAE.</p>' +
      '<div class="l2-onboard-grid">' + hubCards('lab') + '</div>' +
      '<section class="l2-card" style="margin-top:1.5rem">' +
        '<h3>Mapas disponíveis</h3>' +
        '<ul class="pm-info-list">' +
          '<li><a href="#/lab/mapa">Mapa de calor</a> — densidade Lucro Real por UF/município</li>' +
          '<li><a href="#/lab/auditorias">Auditorias</a> — bancas e raio de atuação no Brasil</li>' +
          '<li><a href="#/lab/patrimonial">Patrimonial</a> — prestadores de controle patrimonial</li>' +
        '</ul>' +
      '</section>' +
    '</div>';
}

export async function renderEstrategiaHub({ mount }) {
  mount.innerHTML =
    '<div class="pm-section-page">' +
      '<div class="pm-section-banner estrategia"><span>② CRM & Estratégia</span> Topo, meio e fundo de funil</div>' +
      '<div class="l2-onboard-grid">' + hubCards('estrategia') + '</div>' +
    '</div>';
}

export async function renderOperacaoHub({ mount }) {
  mount.innerHTML =
    '<div class="pm-section-page">' +
      '<div class="pm-section-banner operacao"><span>③ Operação</span> Executar cold mail, call e LinkedIn</div>' +
      '<div class="l2-onboard-grid">' + hubCards('operacao') + '</div>' +
    '</div>';
}
