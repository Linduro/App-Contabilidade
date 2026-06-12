import * as store from '../core/store.js';

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
];

const ACTIVITIES = [
  { id: 'act_1', tipo: 'ligacao', titulo: 'Ligar para CFO Beta', lead_id: 'ld_2', deal_id: 'deal_1', responsavel_id: 'u_owner', agendado_para: new Date().toISOString(), status: 'pendente' },
  { id: 'act_2', tipo: 'reuniao', titulo: 'Apresentação proposta Delta', lead_id: 'ld_4', deal_id: 'deal_2', responsavel_id: 'u_gabriel', agendado_para: new Date(Date.now() - 86400000).toISOString(), status: 'atrasada' },
  { id: 'act_3', tipo: 'email', titulo: 'Follow-up Holding Alfa', lead_id: 'ld_1', responsavel_id: 'u_owner', agendado_para: new Date(Date.now() + 86400000).toISOString(), status: 'pendente' },
];

const PARTNERS = [
  { id: 'par_1', nome: 'Auditoria Horizonte', rede: 'Independente', uf: 'SP', website: 'horizonteaudit.com.br', email: 'parcerias@horizonteaudit.com.br', telefone: '(11) 4000-1000', status_parceria: 'ativo' },
];

export function seedIfEmpty() {
  const db = store.getDb();
  if (db.meta.seededAt) return false;

  const collections = { ...db.collections };
  collections.users = USERS;
  collections.pipelines = [PIPELINE_VENDAS];
  collections.stages = STAGES;
  collections.products = PRODUCTS;
  collections.leads = LEADS;
  collections.deals = DEALS;
  collections.activities = ACTIVITIES;
  collections.partners = PARTNERS;
  collections.tags = [{ id: 'tag_quente', nome: 'Quente', cor: '#e8681a' }, { id: 'tag_trans', nome: 'Transição LR', cor: '#3b82f6' }];
  collections.emailTemplates = [{ id: 'tpl_1', nome: 'Abordagem patrimonial', assunto: 'Conformidade patrimonial — {{razao_social}}', corpo: 'Olá,\n\nIdentificamos oportunidade de otimização fiscal para {{razao_social}} ({{regime_tributario}}).\n\nAtt,\n{{responsavel}}' }];

  store.replaceDb({
    ...db,
    meta: { ...db.meta, seededAt: new Date().toISOString() },
    collections,
  });
  return true;
}
