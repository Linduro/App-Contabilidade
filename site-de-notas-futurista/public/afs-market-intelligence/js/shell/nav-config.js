/**
 * Estrutura de navegação — 5 partes do funil AFS.
 * Não remove rotas legadas; apenas organiza o menu lateral.
 */

export const NAV_SECTIONS = [
  {
    id: 'lab',
    title: '① Laboratório',
    subtitle: 'Dados, filtros, mapas, CNAE',
    items: [
      { hash: '/lab/ingestao', label: 'Ingestão & filtros RF', icon: '⬇' },
      { hash: '/lab/mapa', label: 'Mapa do Brasil · LR', icon: '🗺', highlight: true },
      { hash: '/lab/cnae', label: 'CNAE & blacklist', icon: '🏷' },
      { hash: '/lab/auditorias', label: 'Mapa · Auditorias', icon: '◎' },
      { hash: '/lab/patrimonial', label: 'Mapa · Patrimonial', icon: '◈' },
      { hash: '/prospeccao/busca', label: 'Busca & enriquecimento', icon: '🔎' },
      { hash: '/prospeccao/dead-zone', label: 'Dead Zone', icon: '⊘' },
      { hash: '/prospeccao/transicao', label: 'Transição regime', icon: '↻' },
    ],
  },
  {
    id: 'estrategia',
    title: '② CRM & Estratégia',
    subtitle: 'Funil topo, meio e fundo',
    items: [
      { hash: '/crm/leads', label: 'Leads & ICP', icon: '◉' },
      { hash: '/crm/pipelines', label: 'Pipelines', icon: '▦' },
      { hash: '/crm/oportunidades', label: 'Oportunidades', icon: '◇' },
      { hash: '/estrategia/teses', label: 'Teses & hipóteses', icon: '💡' },
      { hash: '/marketing/segmentacoes', label: 'Segmentações', icon: '◈' },
      { hash: '/parceiros', label: 'Parceiros B2B2B', icon: '⇄' },
    ],
  },
  {
    id: 'operacao',
    title: '③ Operação',
    subtitle: 'Cold mail, call, LinkedIn',
    items: [
      { hash: '/operacao/coldmail', label: 'Priorização cold mail', icon: '✉' },
      { hash: '/automacao/jornadas', label: 'Jornadas & fluxos', icon: '⚡' },
      { hash: '/automacao/campanhas', label: 'Campanhas', icon: '📣' },
    ],
  },
  {
    id: 'comunicacao',
    title: '④ Comunicação',
    subtitle: 'Acompanhamento manual',
    items: [
      { hash: '/comunicacao/inbox', label: 'Caixa de entrada', icon: '📥' },
      { hash: '/tarefas', label: 'Atividades & follow-up', icon: '☑' },
    ],
  },
  {
    id: 'analises',
    title: '⑤ Análises',
    subtitle: 'Relatórios e métricas',
    items: [
      { hash: '/analises/relatorios', label: 'Relatórios', icon: '📊' },
      { hash: '/analises/metas', label: 'Metas', icon: '🎯' },
    ],
  },
];

export const SHORTCUTS = [
  { hash: '/apps', label: 'Home', icon: '⌂' },
  { hash: '/lab/ingestao', label: 'Laboratório', icon: '⬡', highlight: true },
  { hash: '/configuracoes', label: 'Configurações', icon: '⚙' },
  { hash: '/legacy', label: 'UI legada', icon: '⏪' },
];

export const LAB_SLUG_TO_TAB = {
  ingestao: 'massa',
  mapa: 'mapa',
  cnae: 'cnaes',
  auditorias: 'auditorias',
  patrimonial: 'patrimonial',
};

export const LAB_SUBNAV = [
  { slug: 'ingestao', label: 'Ingestão RF' },
  { slug: 'mapa', label: 'Mapa LR' },
  { slug: 'cnae', label: 'CNAE' },
  { slug: 'auditorias', label: 'Auditorias' },
  { slug: 'patrimonial', label: 'Patrimonial' },
];

export function titleForPath(path) {
  if (path === '/apps') return 'Home';
  if (path.startsWith('/lab/')) {
    const slug = path.split('/')[2];
    const item = LAB_SUBNAV.find((x) => x.slug === slug);
    return item ? 'Laboratório · ' + item.label : 'Laboratório';
  }
  if (path === '/operacao/coldmail') return 'Operação · Cold mail';
  if (path === '/estrategia/teses') return 'Teses & hipóteses';
  if (path.startsWith('/prospeccao/busca') || path.startsWith('/prospeccao/massa') || path.startsWith('/prospeccao/operacoes')) return 'Busca de Leads';
  if (path.startsWith('/prospeccao')) return 'Prospecção';
  if (path.startsWith('/crm/')) return 'CRM';
  if (path.startsWith('/marketing')) return 'Marketing';
  if (path.startsWith('/automacao')) return 'Automação';
  if (path.startsWith('/comunicacao')) return 'Comunicação';
  if (path.startsWith('/analises')) return 'Análises';
  if (path === '/parceiros') return 'Parceiros';
  if (path === '/configuracoes') return 'Configurações';
  return 'AFS Market';
}
