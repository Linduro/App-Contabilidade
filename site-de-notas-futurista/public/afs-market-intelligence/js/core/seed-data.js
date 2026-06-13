import * as store from './store.js';
import { purgeFictitiousData, filterRealLeads } from './purge-fictitious.js';

const USERS = [
  { id: 'u_owner', nome: 'Cartoon HQ', email: 'cartoonhq@gmail.com', papel: 'admin' },
  { id: 'u_gabriel', nome: 'Gabriel Douran', email: 'gabrieldouran@gmail.com', papel: 'admin' },
];

const PIPELINE_VENDAS = { id: 'pipe_vendas', nome: 'Funil Comercial AFS', tipo: 'vendas', ativo: true };
const STAGES = [
  { id: 'st_prosp', pipeline_id: 'pipe_vendas', nome: 'Prospectado', ordem: 0, cor: '#6b7280', probabilidade: 10, is_won: false, is_lost: false },
  { id: 'st_contato', pipeline_id: 'pipe_vendas', nome: 'Contato Feito', ordem: 1, cor: '#3b82f6', probabilidade: 25, is_won: false, is_lost: false },
  { id: 'st_prop', pipeline_id: 'pipe_vendas', nome: 'Proposta Enviada', ordem: 2, cor: '#e8681a', probabilidade: 50, is_won: false, is_lost: false },
  { id: 'st_neg', pipeline_id: 'pipe_vendas', nome: 'Negociação', ordem: 3, cor: '#f59e0b', probabilidade: 75, is_won: false, is_lost: false },
  { id: 'st_ganho', pipeline_id: 'pipe_vendas', nome: 'Fechado', ordem: 4, cor: '#22c55e', probabilidade: 100, is_won: true, is_lost: false },
  { id: 'st_perd', pipeline_id: 'pipe_vendas', nome: 'Perdido', ordem: 5, cor: '#ef4444', probabilidade: 0, is_won: false, is_lost: true },
];

const PRODUCTS = [
  { id: 'prod_bpo', nome: 'BPO Contábil Completo', preco: 4500, recorrente: true },
  { id: 'prod_trans', nome: 'Transição Lucro Real', preco: 12000, recorrente: false },
  { id: 'prod_abertura', nome: 'Abertura de Empresa', preco: 2800, recorrente: false },
  { id: 'prod_consult', nome: 'Consultoria Fiscal', preco: 350, recorrente: true },
];

const PARTNERS = [
  { id: 'par_1', nome: 'Auditoria Horizonte', rede: 'Independente', uf: 'SP', website: 'horizonteaudit.com.br', email: 'parcerias@horizonteaudit.com.br', telefone: '(11) 4000-1000', status_parceria: 'ativo' },
  { id: 'par_2', nome: 'Contábil Sul', rede: 'Rede AFS', uf: 'RS', website: 'contabilsul.com.br', email: 'b2b@contabilsul.com.br', telefone: '(51) 3000-2000', status_parceria: 'ativo' },
];

const SEGMENTATIONS = [
  { id: 'seg_1', nome: 'ICP Patrimonial SP', filtros: { uf: 'SP', scoreMin: 7 }, ativo: true },
  { id: 'seg_2', nome: 'Transição LR', filtros: { scoreMin: 6 }, ativo: true },
];

const AUTOMATIONS = [
  { id: 'auto_1', nome: 'Boas-vindas lead quente', trigger: 'lead_score_above', trigger_value: 8, ativo: true, steps: [
    { tipo: 'aguardar', config: '1 dia' }, { tipo: 'email', config: 'Abordagem patrimonial' }, { tipo: 'criar_atividade', config: 'Follow-up ligação' },
  ]},
  { id: 'auto_2', nome: 'Alerta atividade atrasada', trigger: 'activity_overdue', trigger_value: 0, ativo: false, steps: [
    { tipo: 'notificacao', config: 'Responsável' }, { tipo: 'criar_atividade', config: 'Reagendar' },
  ]},
];

const GOALS = [
  { id: 'goal_1', titulo: 'Novos negócios fechados Q2', tipo: 'deals_won', meta: 5, atual: 0, periodo: '2026-Q2' },
  { id: 'goal_2', titulo: 'Leads prospectados', tipo: 'leads_created', meta: 50, atual: 0, periodo: '2026-Q2' },
];

const LANDING_PAGES = [
  { id: 'lp_1', nome: 'Diagnóstico Patrimonial', slug: 'patrimonial', views: 0, conversoes: 0 },
  { id: 'lp_2', nome: 'Transição Lucro Real', slug: 'transicao-lr', views: 0, conversoes: 0 },
];

const FORMS = [
  { id: 'form_1', nome: 'Diagnóstico Fiscal Rápido', landing_page_id: 'lp_1', respostas: 0 },
  { id: 'form_2', nome: 'Simulador Transição LR', landing_page_id: 'lp_2', respostas: 0 },
];

const SEED_VERSION = 7;

function mergeCollection(db, key, items) {
  if (!db.collections[key]) db.collections[key] = [];
  const ids = new Set(db.collections[key].map((r) => r.id));
  items.forEach((item) => { if (!ids.has(item.id)) db.collections[key].push(item); });
}

function applyStructureSeed(db) {
  mergeCollection(db, 'partners', PARTNERS);
  mergeCollection(db, 'segmentations', SEGMENTATIONS);
  mergeCollection(db, 'automations', AUTOMATIONS);
  mergeCollection(db, 'campaigns', [{ id: 'camp_1', nome: 'Outreach Transição LR Q2', automation_id: 'auto_1', status: 'rascunho', enviados: 0 }]);
  mergeCollection(db, 'goals', GOALS);
  mergeCollection(db, 'landingPages', LANDING_PAGES);
  mergeCollection(db, 'forms', FORMS);
  if (!db.collections.emailTemplates?.length) {
    db.collections.emailTemplates = [{ id: 'tpl_1', nome: 'Abordagem patrimonial', assunto: 'Conformidade patrimonial — {{razao_social}}', corpo: 'Olá,\n\nIdentificamos oportunidade de otimização fiscal para {{razao_social}} ({{regime_tributario}}).\n\nAtt,\n{{responsavel}}' }];
  }
}

/** Remove leads e dados de demo fictícios do CRM local. */
function purgeFictitiousLeads(db) {
  purgeFictitiousData();
  db.collections.leads = store.getDb().collections.leads || [];
  db.collections.deals = store.getDb().collections.deals || [];
  db.collections.activities = store.getDb().collections.activities || [];
  db.collections.conversations = store.getDb().collections.conversations || [];
  db.collections.messages = store.getDb().collections.messages || [];
  db.collections.companies = store.getDb().collections.companies || [];
  try {
    localStorage.removeItem('afs_prospect_enrichment');
    localStorage.removeItem('afs_prospect_segmentacoes');
  } catch (_) {}
}

export function seedIfEmpty() {
  const db = store.getDb();
  const sv = db.meta.seedVersion;

  if (db.meta.seededAt && sv != null && sv >= SEED_VERSION) {
    purgeFictitiousData();
    return false;
  }

  if (db.meta.seededAt) {
    purgeFictitiousLeads(db);
    applyStructureSeed(db);
    db.meta.seedVersion = SEED_VERSION;
    store.replaceDb(db);
    purgeFictitiousData();
    return true;
  }

  const collections = { ...db.collections };
  collections.users = USERS;
  collections.pipelines = [PIPELINE_VENDAS];
  collections.stages = STAGES;
  collections.products = PRODUCTS;
  collections.leads = [];
  collections.deals = [];
  collections.activities = [];
  collections.partners = PARTNERS;
  collections.companies = [];
  collections.conversations = [];
  collections.messages = [];
  collections.segmentations = SEGMENTATIONS;
  collections.automations = AUTOMATIONS;
  collections.campaigns = [{ id: 'camp_1', nome: 'Outreach Transição LR Q2', automation_id: 'auto_1', status: 'rascunho', enviados: 0 }];
  collections.goals = GOALS;
  collections.landingPages = LANDING_PAGES;
  collections.forms = FORMS;
  collections.tags = [{ id: 'tag_quente', nome: 'Quente', cor: '#e8681a' }, { id: 'tag_trans', nome: 'Transição LR', cor: '#3b82f6' }];
  collections.emailTemplates = [{ id: 'tpl_1', nome: 'Abordagem patrimonial', assunto: 'Conformidade patrimonial — {{razao_social}}', corpo: 'Olá,\n\nIdentificamos oportunidade de otimização fiscal para {{razao_social}} ({{regime_tributario}}).\n\nAtt,\n{{responsavel}}' }];

  store.replaceDb({
    ...db,
    meta: { ...db.meta, seededAt: new Date().toISOString(), seedVersion: SEED_VERSION },
    collections,
  });
  return true;
}

export { purgeFictitiousLeads, SEED_VERSION };
