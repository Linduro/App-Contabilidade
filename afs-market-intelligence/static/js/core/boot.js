import * as store from './store.js';
import { register, registerPrefix, start, isLegacyRoute, parseHash } from './router.js';
import { seedIfEmpty } from './seed-data.js';
import { importFirestoreOnceIfNeeded } from '../adapters/firestore-adapter.js';
import { renderSidebar } from '../shell/sidebar.js';
import { renderHeader } from '../shell/header.js';
import { mountLegacy, unmountLegacy } from '../legacy/legacy-boot.js';

const TITLES = {
  '/apps': 'Home',
  '/prospeccao': 'Prospecção',
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

const ROUTE_LOADERS = {
  '/apps': () => import('../modules/home.js').then((m) => m.renderHome),
  '/prospeccao': () => import('../modules/prospeccao.js').then((m) => m.renderProspeccao),
  '/prospeccao/dead-zone': () => import('../modules/prospeccao-dead-zone.js').then((m) => m.renderDeadZone),
  '/prospeccao/transicao': () => import('../modules/prospeccao-transicao.js').then((m) => m.renderTransicao),
  '/crm/pipelines': () => import('../modules/crm-pipelines.js').then((m) => m.renderPipelines),
  '/crm/leads': () => import('../modules/crm-leads.js').then((m) => m.renderLeads),
  '/crm/oportunidades': () => import('../modules/crm-oportunidades.js').then((m) => m.renderOportunidades),
  '/tarefas': () => import('../modules/atividades.js').then((m) => m.renderAtividades),
  '/comunicacao/inbox': () => import('../modules/comunicacao-inbox.js').then((m) => m.renderComunicacaoInbox),
  '/parceiros': () => import('../modules/parceiros.js').then((m) => m.renderParceiros),
  '/configuracoes': () => import('../modules/configuracoes.js').then((m) => m.renderConfiguracoes),
};

function lazy(loaderFn) {
  return async function (ctx) {
    const handler = await loaderFn();
    return handler(ctx);
  };
}

function titleFor(path) {
  if (TITLES[path]) return TITLES[path];
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
    () => import('../modules/comunicacao-inbox.js').then((m) => m.renderComunicacaoInbox),
  ));
  registerPrefix('/marketing/', lazy(
    () => import('../modules/marketing.js').then((m) => m.renderMarketing),
  ));
  registerPrefix('/automacao/', lazy(
    () => import('../modules/automacao.js').then((m) => m.renderAutomacao),
  ));
  registerPrefix('/analises/', lazy(
    () => import('../modules/analises.js').then((m) => m.renderAnalises),
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
  seedIfEmpty();
  const imp = await importFirestoreOnceIfNeeded();
  if (imp.imported && window.AFSToast) {
    window.AFSToast.success('Importados ' + imp.leads + ' leads do Firestore');
  }

  registerAllRoutes();

  const go = await start(function (path) {
    refreshChrome(path);
    if (isLegacyRoute(path)) {
      document.getElementById('app-root')?.classList.add('hidden');
    }
  });

  store.onChange(function () {
    const { path } = parseHash();
    if (!isLegacyRoute(path)) refreshChrome(path);
  });

  await go();
}

window.AFS_BOOT = bootApp;
