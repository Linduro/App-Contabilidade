import * as store from './store.js';
import { register, registerPrefix, start, isLegacyRoute, parseHash } from './router.js';
import { seedIfEmpty } from '../seed-data.js';
import { importFirestoreOnceIfNeeded } from '../adapters/firestore-adapter.js';
import { renderSidebar } from '../shell/sidebar.js';
import { renderHeader } from '../shell/header.js';
import { renderHome } from '../modules/home.js';
import { renderPipelines } from '../modules/crm-pipelines.js';
import { renderOportunidades } from '../modules/crm-oportunidades.js';
import { renderLeads } from '../modules/crm-leads.js';
import { renderAtividades } from '../modules/atividades.js';
import { placeholderModule } from '../modules/placeholder.js';
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
  '/parceiros': 'Parceiros B2B2B',
  '/configuracoes': 'Configurações',
  '/legacy': 'UI Legada',
};

function titleFor(path) {
  if (TITLES[path]) return TITLES[path];
  if (path.startsWith('/marketing')) return 'Marketing';
  if (path.startsWith('/comunicacao')) return 'Comunicação';
  if (path.startsWith('/automacao')) return 'Automação';
  if (path.startsWith('/analises')) return 'Análises';
  return 'AFS Market';
}

function registerAllRoutes() {
  const ph = placeholderModule;
  register('/apps', renderHome);
  register('/legacy', async () => { await mountLegacy(); });
  registerPrefix('/legacy/', async () => { await mountLegacy(); });
  register('/prospeccao', ph('Prospecção', 'Filtros accordion + tabela (fase 3).'));
  register('/prospeccao/dead-zone', ph('Dead Zone', 'Use UI legada (#/legacy) até migrar.'));
  register('/prospeccao/transicao', ph('Transição de Regime'));
  register('/crm/pipelines', renderPipelines);
  register('/crm/leads', renderLeads);
  register('/crm/oportunidades', renderOportunidades);
  register('/tarefas', renderAtividades);
  register('/parceiros', ph('Parceiros B2B2B'));
  register('/configuracoes', ph('Configurações', 'Scoring e pipelines.'));
  registerPrefix('/marketing/', ph('Marketing'));
  registerPrefix('/comunicacao/', ph('Comunicação'));
  registerPrefix('/automacao/', ph('Automação'));
  registerPrefix('/analises/', ph('Análises'));
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
