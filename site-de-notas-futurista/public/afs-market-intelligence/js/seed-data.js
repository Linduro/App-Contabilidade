import * as store from './core/store.js';

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

function lead(id, data) {
  return {
    id,
    cnpj_basico: data.cnpj,
    razao_social: data.razao,
    cnae_codigo: data.cnae,
    cnae_descricao: data.cnaeDesc,
    regime_tributario: data.regime,
    porte_empresa: data.porte,
    capital_social: data.capital,
    receita_anual_estimada: data.receita,
    uf: data.uf,
    municipio: data.cidade,
    qtd_filiais: data.filiais || 0,
    situacao_cadastral: 'ATIVA',
    telefone: data.tel,
    email: data.email,
    score: data.score,
    status_funil: data.status || 'prospectado',
    perfil_icp: 'patrimonial',
    transicao_regime: data.transicao || null,
    dead_zone: data.dead_zone || null,
    tags: data.tags || [],
    responsavel_id: 'u_owner',
    origem: data.origem || 'prospecção',
    criado_em: new Date(Date.now() - (data.daysAgo || 10) * 86400000).toISOString(),
  };
}

const LEADS = [
  lead('ld_1', { cnpj: '12345678000190', razao: 'Holding Patrimonial Alfa Ltda', cnae: '6422-1/00', cnaeDesc: 'Holdings', regime: 'LR', porte: 'MEDIO', capital: 2500000, receita: 18000000, uf: 'SP', cidade: 'São Paulo', filiais: 3, tel: '(11) 3456-7890', email: 'contato@holdingalfa.com.br', score: 8.5, status: 'prospectado', daysAgo: 2 }),
  lead('ld_2', { cnpj: '98765432000111', razao: 'Indústria Beta S.A.', cnae: '2511-0/00', cnaeDesc: 'Fabricação estruturas metálicas', regime: 'LP', porte: 'GRANDE', capital: 8000000, receita: 45000000, uf: 'MG', cidade: 'Belo Horizonte', filiais: 5, tel: '(31) 3333-4444', email: 'fiscal@betaind.com.br', score: 9.2, status: 'contato_feito', transicao: { de: 'LP', para: 'LR', data: new Date().toISOString() }, daysAgo: 5 }),
  lead('ld_3', { cnpj: '11223344000155', razao: 'Comércio Gamma ME', cnae: '4711-3/01', cnaeDesc: 'Comércio varejista', regime: 'SN', porte: 'EPP', capital: 150000, receita: 2400000, uf: 'RJ', cidade: 'Rio de Janeiro', tel: '(21) 2222-3333', email: 'invalido@', score: 4.1, status: 'dead_zone', dead_zone: { motivo: 'E-mail inválido', rota: 'linkedin', prioridade: 'alta' }, daysAgo: 15 }),
  lead('ld_4', { cnpj: '55667788000122', razao: 'Serviços Delta Ltda', cnae: '6201-5/01', cnaeDesc: 'Desenvolvimento de software', regime: 'SN', porte: 'ME', capital: 50000, receita: 980000, uf: 'SC', cidade: 'Florianópolis', tel: '(48) 9999-8888', email: 'ceo@delta.tech', score: 6.8, status: 'proposta_enviada', daysAgo: 8 }),
  lead('ld_5', { cnpj: '33445566000177', razao: 'Logística Épsilon EIRELI', cnae: '4930-2/02', cnaeDesc: 'Transporte rodoviário', regime: 'LP', porte: 'MEDIO', capital: 600000, receita: 8200000, uf: 'PR', cidade: 'Curitiba', filiais: 2, tel: '(41) 3555-6666', email: 'financeiro@epsilonlog.com.br', score: 7.4, status: 'negociacao', daysAgo: 12 }),
];

const DEALS = [
  { id: 'deal_1', titulo: 'BPO + Transição LR — Beta', lead_id: 'ld_2', pipeline_id: 'pipe_vendas', stage_id: 'st_neg', valor: 85000, responsavel_id: 'u_owner', status: 'aberto', produtos: [{ product_id: 'prod_bpo', qtd: 1, preco: 4500 }, { product_id: 'prod_trans', qtd: 1, preco: 12000 }] },
  { id: 'deal_2', titulo: 'Consultoria Fiscal — Delta', lead_id: 'ld_4', pipeline_id: 'pipe_vendas', stage_id: 'st_prop', valor: 12000, responsavel_id: 'u_gabriel', status: 'aberto', produtos: [{ product_id: 'prod_consult', qtd: 12, preco: 350 }] },
  { id: 'deal_3', titulo: 'BPO Patrimonial — Alfa', lead_id: 'ld_1', pipeline_id: 'pipe_vendas', stage_id: 'st_prosp', valor: 54000, responsavel_id: 'u_owner', status: 'aberto', produtos: [{ product_id: 'prod_bpo', qtd: 1, preco: 4500 }] },
  { id: 'deal_4', titulo: 'Abertura filial — Épsilon', lead_id: 'ld_5', pipeline_id: 'pipe_vendas', stage_id: 'st_contato', valor: 2800, responsavel_id: 'u_gabriel', status: 'aberto', produtos: [{ product_id: 'prod_abertura', qtd: 1, preco: 2800 }] },
];

const ACTIVITIES = [
  { id: 'act_1', tipo: 'ligacao', titulo: 'Ligar para CFO Beta', lead_id: 'ld_2', deal_id: 'deal_1', responsavel_id: 'u_owner', agendado_para: new Date().toISOString(), status: 'pendente', criado_em: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: 'act_2', tipo: 'reuniao', titulo: 'Apresentação proposta Delta', lead_id: 'ld_4', deal_id: 'deal_2', responsavel_id: 'u_gabriel', agendado_para: new Date(Date.now() - 86400000).toISOString(), status: 'atrasada', criado_em: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: 'act_3', tipo: 'email', titulo: 'Follow-up Holding Alfa', lead_id: 'ld_1', responsavel_id: 'u_owner', agendado_para: new Date(Date.now() + 86400000).toISOString(), status: 'pendente', criado_em: new Date(Date.now() - 86400000).toISOString() },
  { id: 'act_4', tipo: 'whatsapp', titulo: 'WhatsApp Épsilon logística', lead_id: 'ld_5', responsavel_id: 'u_gabriel', agendado_para: new Date(Date.now() + 3 * 86400000).toISOString(), status: 'pendente', criado_em: new Date().toISOString() },
  { id: 'act_5', tipo: 'followup', titulo: 'Retorno proposta Beta', lead_id: 'ld_2', deal_id: 'deal_1', responsavel_id: 'u_owner', agendado_para: new Date(Date.now() + 5 * 86400000).toISOString(), status: 'pendente', criado_em: new Date().toISOString() },
];

const PARTNERS = [
  { id: 'par_1', nome: 'Auditoria Horizonte', rede: 'Independente', uf: 'SP', website: 'horizonteaudit.com.br', email: 'parcerias@horizonteaudit.com.br', telefone: '(11) 4000-1000', status_parceria: 'ativo' },
  { id: 'par_2', nome: 'Contábil Sul', rede: 'Rede AFS', uf: 'RS', website: 'contabilsul.com.br', email: 'b2b@contabilsul.com.br', telefone: '(51) 3000-2000', status_parceria: 'ativo' },
];

const COMPANIES = [
  { id: 'co_1', cnpj: '99887766000133', nome: 'Investimentos Zeta Ltda', cnae_codigo: '6619-3/02', cnae_descricao: 'Corretoras de valores', regime_tributario: 'LR', porte_empresa: 'MEDIO', capital_social: 1200000, uf: 'SP', municipio: 'Campinas', score: 7.8, situacao_cadastral: 'ATIVA' },
  { id: 'co_2', cnpj: '44332211000144', nome: 'Metalúrgica Omega S.A.', cnae_codigo: '2599-3/99', cnae_descricao: 'Metalurgia', regime_tributario: 'LP', porte_empresa: 'GRANDE', capital_social: 15000000, uf: 'RS', municipio: 'Porto Alegre', score: 8.9, situacao_cadastral: 'ATIVA' },
];

const CONVERSATIONS = [
  { id: 'conv_1', lead_id: 'ld_2', canal: 'email', assunto: 'Proposta BPO + Transição LR', status: 'aberta', nao_lidas: 2, ultima_msg_em: new Date(Date.now() - 3600000).toISOString(), ultima_preview: 'Podemos agendar uma call esta semana?' },
  { id: 'conv_2', lead_id: 'ld_4', canal: 'whatsapp', assunto: 'Consultoria Delta', status: 'aberta', nao_lidas: 0, ultima_msg_em: new Date(Date.now() - 86400000).toISOString(), ultima_preview: 'Recebi a proposta, vou analisar.' },
  { id: 'conv_3', lead_id: 'ld_1', canal: 'email', assunto: 'Holding Alfa — primeiro contato', status: 'lida', nao_lidas: 0, ultima_msg_em: new Date(Date.now() - 3 * 86400000).toISOString(), ultima_preview: 'Obrigado pelo retorno.' },
];

const MESSAGES = [
  { id: 'msg_1', conversation_id: 'conv_1', direcao: 'entrada', corpo: 'Recebemos a proposta. Podemos agendar uma call esta semana?', autor: 'fiscal@betaind.com.br', criado_em: new Date(Date.now() - 3600000).toISOString() },
  { id: 'msg_2', conversation_id: 'conv_1', direcao: 'saida', corpo: 'Claro! Envio opções de horário ainda hoje.', autor: 'Cartoon HQ', criado_em: new Date(Date.now() - 7200000).toISOString() },
  { id: 'msg_3', conversation_id: 'conv_2', direcao: 'entrada', corpo: 'Recebi a proposta, vou analisar com o time.', autor: 'ceo@delta.tech', criado_em: new Date(Date.now() - 86400000).toISOString() },
  { id: 'msg_4', conversation_id: 'conv_3', direcao: 'saida', corpo: 'Olá, identificamos oportunidade de otimização patrimonial.', autor: 'Cartoon HQ', criado_em: new Date(Date.now() - 4 * 86400000).toISOString() },
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

const CAMPAIGNS = [
  { id: 'camp_1', nome: 'Outreach Transição LR Q2', automation_id: 'auto_1', status: 'rascunho', enviados: 0 },
];

const GOALS = [
  { id: 'goal_1', titulo: 'Novos negócios fechados Q2', tipo: 'deals_won', meta: 5, atual: 0, periodo: '2026-Q2' },
  { id: 'goal_2', titulo: 'Leads prospectados', tipo: 'leads_created', meta: 50, atual: 5, periodo: '2026-Q2' },
];

const LANDING_PAGES = [
  { id: 'lp_1', nome: 'Diagnóstico Patrimonial', slug: 'patrimonial', views: 342, conversoes: 18 },
  { id: 'lp_2', nome: 'Transição Lucro Real', slug: 'transicao-lr', views: 128, conversoes: 9 },
];

const FORMS = [
  { id: 'form_1', nome: 'Diagnóstico Fiscal Rápido', landing_page_id: 'lp_1', respostas: 18 },
  { id: 'form_2', nome: 'Simulador Transição LR', landing_page_id: 'lp_2', respostas: 9 },
];

function mergeCollection(db, key, items) {
  if (!db.collections[key]) db.collections[key] = [];
  const ids = new Set(db.collections[key].map((r) => r.id));
  items.forEach((item) => { if (!ids.has(item.id)) db.collections[key].push(item); });
}

function applySeedV4(db) {
  mergeCollection(db, 'deals', DEALS);
  mergeCollection(db, 'activities', ACTIVITIES);
  mergeCollection(db, 'partners', PARTNERS);
  mergeCollection(db, 'companies', COMPANIES);
  mergeCollection(db, 'conversations', CONVERSATIONS);
  mergeCollection(db, 'messages', MESSAGES);
  mergeCollection(db, 'segmentations', SEGMENTATIONS);
  mergeCollection(db, 'automations', AUTOMATIONS);
  mergeCollection(db, 'campaigns', CAMPAIGNS);
  mergeCollection(db, 'goals', GOALS);
  mergeCollection(db, 'landingPages', LANDING_PAGES);
  mergeCollection(db, 'forms', FORMS);
  if (!db.collections.emailTemplates?.length) {
    db.collections.emailTemplates = [{ id: 'tpl_1', nome: 'Abordagem patrimonial', assunto: 'Conformidade patrimonial — {{razao_social}}', corpo: 'Olá,\n\nIdentificamos oportunidade de otimização fiscal para {{razao_social}} ({{regime_tributario}}).\n\nAtt,\n{{responsavel}}' }];
  }
}

export function seedIfEmpty() {
  const db = store.getDb();
  if (db.meta.seededAt && db.meta.seedVersion >= 4) return false;

  if (db.meta.seededAt && db.meta.seedVersion < 4) {
    applySeedV4(db);
    store.setMeta({ seedVersion: 4 });
    store.replaceDb(db);
    return true;
  }

  const collections = { ...db.collections };
  collections.users = USERS;
  collections.pipelines = [PIPELINE_VENDAS];
  collections.stages = STAGES;
  collections.products = PRODUCTS;
  collections.leads = LEADS;
  collections.deals = DEALS;
  collections.activities = ACTIVITIES;
  collections.partners = PARTNERS;
  collections.companies = COMPANIES;
  collections.conversations = CONVERSATIONS;
  collections.messages = MESSAGES;
  collections.segmentations = SEGMENTATIONS;
  collections.automations = AUTOMATIONS;
  collections.campaigns = CAMPAIGNS;
  collections.goals = GOALS;
  collections.landingPages = LANDING_PAGES;
  collections.forms = FORMS;
  collections.tags = [{ id: 'tag_quente', nome: 'Quente', cor: '#e8681a' }, { id: 'tag_trans', nome: 'Transição LR', cor: '#3b82f6' }];
  collections.emailTemplates = [{ id: 'tpl_1', nome: 'Abordagem patrimonial', assunto: 'Conformidade patrimonial — {{razao_social}}', corpo: 'Olá,\n\nIdentificamos oportunidade de otimização fiscal para {{razao_social}} ({{regime_tributario}}).\n\nAtt,\n{{responsavel}}' }];

  store.replaceDb({
    ...db,
    meta: { ...db.meta, seededAt: new Date().toISOString(), seedVersion: 4 },
    collections,
  });
  return true;
}
