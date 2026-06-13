import * as store from './store.js';
import { register, registerPrefix, start, isLegacyRoute, parseHash } from './router.js';
import { seedIfEmpty } from './seed-data.js';
import { purgeFictitiousData } from './purge-fictitious.js';
import { importFirestoreOnceIfNeeded } from '../adapters/firestore-adapter.js';
import { renderSidebar } from '../shell/sidebar.js';
import { renderHeader } from '../shell/header.js';
import { mountLegacy, unmountLegacy } from '../legacy/legacy-boot.js';

/** Cache-bust em imports dinâmicos (evita JS antigo em cache). */
function importMod(relPath) {
  const v = window.__AFS_BUILD__ || Date.now();
  const sep = relPath.includes('?') ? '&' : '?';
  return import(relPath + sep + 'b=' + encodeURIComponent(v));
}

const TITLES = {
  '/apps': 'Home',
  '/prospeccao': 'Busca de Leads',
  '/prospeccao/busca': 'Busca de Leads',
  '/prospeccao/massa': 'Busca de Leads',
  '/prospeccao/operacoes': 'Busca de Leads',
  '/prospeccao/dead-zone': 'Dead Zone',
  '/prospeccao/transicao': 'Transição de Regime',
  '/crm/pipelines': 'Pipelines',
  '/crm/leads': 'Leads',
  '/crm/oportunidades': 'Oportunidades',
  '/tarefas': 'Atividades',
  '/comunicacao/inbox': 'Caixa de entrada',
  '/parceiros': 'Parceiros B2B2B',
  '/configuracoes': 'Configurações',
  '/legacy': 'UI Legada',
};

const buscaLeadsLoader = () => importMod('../modules/prospeccao-operacoes.js').then((m) => m.renderBuscaLeads);

const ROUTE_LOADERS = {
  '/apps': () => importMod('../modules/home.js').then((m) => m.renderHome),
  '/prospeccao': buscaLeadsLoader,
  '/prospeccao/busca': buscaLeadsLoader,
  '/prospeccao/massa': buscaLeadsLoader,
  '/prospeccao/operacoes': buscaLeadsLoader,
  '/prospeccao/dead-zone': () => importMod('../modules/prospeccao-dead-zone.js').then((m) => m.renderDeadZone),
  '/prospeccao/transicao': () => importMod('../modules/prospeccao-transicao.js').then((m) => m.renderTransicao),
  '/crm/pipelines': () => importMod('../modules/crm-pipelines.js').then((m) => m.renderPipelines),
  '/crm/leads': () => importMod('../modules/crm-leads.js').then((m) => m.renderLeads),
  '/crm/oportunidades': () => importMod('../modules/crm-oportunidades.js').then((m) => m.renderOportunidades),
  '/tarefas': () => importMod('../modules/atividades.js').then((m) => m.renderAtividades),
  '/comunicacao/inbox': () => importMod('../modules/comunicacao-inbox.js').then((m) => m.renderComunicacaoInbox),
  '/parceiros': () => importMod('../modules/parceiros.js').then((m) => m.renderParceiros),
  '/configuracoes': () => importMod('../modules/configuracoes.js').then((m) => m.renderConfiguracoes),
};

function lazy(loaderFn) {
  return async function (ctx) {
    try {
      const handler = await loaderFn();
      await handler(ctx);
    } catch (err) {
      console.error('[AFS route]', ctx.path, err);
      if (ctx.mount) {
        ctx.mount.innerHTML =
          '<div class="route-error" style="padding:2rem;text-align:center">' +
            '<h3 style="color:var(--afs-orange-400)">Erro ao carregar a tela</h3>' +
            '<p class="hint">' + String(err.message || err).replace(/</g, '&lt;') + '</p>' +
            '<button type="button" class="btn primary sm" onclick="location.reload()">Recarregar</button>' +
          '</div>';
      }
      throw err;
    }
  };
}

function titleFor(path) {
  if (TITLES[path]) return TITLES[path];
  if (path.startsWith('/prospeccao/busca') || path.startsWith('/prospeccao/massa') || path.startsWith('/prospeccao/operacoes')) return 'Busca de Leads';
  if (path.startsWith('/prospeccao')) return 'Busca de Leads';
  if (path.startsWith('/marketing')) return 'Marketing';
  if (path.startsWith('/comunicacao')) return 'Comunicação';
  if (path.startsWith('/automacao')) return 'Automação';
  if (path.startsWith('/analises')) return 'Análises';
  return 'AFS Market';
}

function registerAllRoutes() {
  register('/legacy', async () => { await mountLegacy(); });
  registerPrefix('/legacy/', async () => { await mountLegacy(); });

  Object.entries(ROUTE_LOADERS).forEach(([path, loader]) => {
    register(path, lazy(loader));
  });

  registerPrefix('/comunicacao/', lazy(
    () => importMod('../modules/comunicacao-inbox.js').then((m) => m.renderComunicacaoInbox),
  ));
  registerPrefix('/marketing/', lazy(
    () => importMod('../modules/marketing.js').then((m) => m.renderMarketing),
  ));
  registerPrefix('/automacao/', lazy(
    () => importMod('../modules/automacao.js').then((m) => m.renderAutomacao),
  ));
  registerPrefix('/analises/', lazy(
    () => importMod('../modules/analises.js').then((m) => m.renderAnalises),
  ));
}

function refreshChrome(path) {
  if (isLegacyRoute(path)) return;
  unmountLegacy();
  document.getElementById('app-root')?.classList.remove('hidden');
  const sidebar = document.getElementById('l2-sidebar');
  const header = document.getElementById('l2-header');
  if (sidebar) renderSidebar(sidebar, path);
  if (header) renderHeader(header, titleFor(path), path);
}

export async function bootApp() {
  if (!location.hash || location.hash === '#') location.hash = '#/apps';
  purgeFictitiousData();
  seedIfEmpty();
  purgeFictitiousData();
  const imp = await importFirestoreOnceIfNeeded();
  if (imp.imported && window.AFSToast) {
    window.AFSToast.success('Importados ' + imp.leads + ' leads do Firestore');
  }

  registerAllRoutes();

  const navigate = start(function (path) {
    refreshChrome(path);
    if (isLegacyRoute(path)) {
      document.getElementById('app-root')?.classList.add('hidden');
    }
  });
  await navigate();

  store.onChange(function () {
    const { path } = parseHash();
    if (!isLegacyRoute(path)) refreshChrome(path);
  });
}

window.AFS_BOOT = bootApp;
