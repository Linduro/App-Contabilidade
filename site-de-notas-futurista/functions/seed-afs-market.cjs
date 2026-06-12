/**
 * Seed AFS Market Intelligence no Firestore.
 * Uso: node seed-afs-market.cjs
 */
const admin = require("firebase-admin")

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: "contabilidade-ebed6",
  })
}

const db = admin.firestore()
const now = admin.firestore.Timestamp.now()
const daysAgo = (n) =>
  admin.firestore.Timestamp.fromDate(new Date(Date.now() - n * 86400000))

const sampleLeads = [
  {
    cnpj_basico: "12345678",
    razao_social: "Holding Patrimonial Alfa Ltda",
    cnae_codigo: "6422-1/00",
    cnae_descricao: "Bancos múltiplos",
    regime_tributario: "LR",
    capital_social: 5000000,
    receita_anual_estimada: 12000000,
    porte_empresa: "MEDIO",
    qtd_filiais: 3,
    situacao_cadastral: "ATIVA",
    data_abertura: daysAgo(1200),
    uf: "SP",
    municipio: "São Paulo",
    cep: "01310-100",
    telefone: "(11) 3000-0001",
    email: "contato@holdingalfa.com.br",
    site: "https://holdingalfa.com.br",
    linkedin_url: "https://linkedin.com/company/holding-alfa",
    socios: [
      {
        nome: "João Silva",
        cpf_cnpj: "***",
        qualificacao: "Sócio-Administrador",
        email_socio: "joao@holdingalfa.com.br",
      },
    ],
    cluster: "Patrimonial",
    score: 8.5,
    transicao_regime: true,
    perfil_icp: "patrimonial",
    status_funil: "prospectado",
    criado_em: daysAgo(15),
    atualizado_em: now,
  },
  {
    cnpj_basico: "87654321",
    razao_social: "Indústria Beta EPP",
    cnae_codigo: "2511-0/00",
    cnae_descricao: "Fabricação de estruturas metálicas",
    regime_tributario: "LP",
    capital_social: 800000,
    receita_anual_estimada: 3500000,
    porte_empresa: "EPP",
    qtd_filiais: 1,
    situacao_cadastral: "ATIVA",
    uf: "MG",
    municipio: "Belo Horizonte",
    cep: "30130-000",
    telefone: "(31) 3200-0002",
    email: "financeiro@betaind.com.br",
    cluster: "Industrial",
    score: 6.2,
    transicao_regime: false,
    perfil_icp: "generico",
    status_funil: "contato_feito",
    criado_em: daysAgo(30),
    atualizado_em: now,
  },
  {
    cnpj_basico: "11223344",
    razao_social: "Comércio Gama ME",
    cnae_codigo: "4711-3/01",
    cnae_descricao: "Comércio varejista",
    regime_tributario: "SN",
    capital_social: 50000,
    receita_anual_estimada: 480000,
    porte_empresa: "ME",
    qtd_filiais: 0,
    situacao_cadastral: "ATIVA",
    uf: "RJ",
    municipio: "Rio de Janeiro",
    telefone: "(21) 2500-0003",
    email: "",
    cluster: "Varejo",
    score: 3.1,
    transicao_regime: false,
    perfil_icp: "generico",
    status_funil: "dead_zone",
    motivo_dead_zone: "Sem e-mail válido",
    rota_recomendada: "LinkedIn",
    prioridade: "Média",
    criado_em: daysAgo(45),
    atualizado_em: now,
  },
  {
    cnpj_basico: "99887766",
    razao_social: "Agro Delta Lucro Real SA",
    cnae_codigo: "0111-3/01",
    cnae_descricao: "Cultivo de cereais",
    regime_tributario: "LR",
    capital_social: 12000000,
    receita_anual_estimada: 45000000,
    porte_empresa: "GRANDE",
    qtd_filiais: 8,
    situacao_cadastral: "ATIVA",
    uf: "GO",
    municipio: "Goiânia",
    telefone: "(62) 3300-0004",
    email: "cfo@agrodelta.com.br",
    cluster: "Agro",
    score: 9.1,
    transicao_regime: true,
    data_transicao: daysAgo(12),
    perfil_icp: "transicao_regime",
    status_funil: "prospectado",
    criado_em: daysAgo(10),
    atualizado_em: now,
  },
]

async function seed() {
  console.log("Seeding AFS Market Intelligence...")
  for (const lead of sampleLeads) {
    const ref = await db.collection("leads").add(lead)
    console.log("  + lead", ref.id, lead.razao_social)
  }
  const pRef = await db.collection("parceiros").add({
    nome: "Audit Partners SP",
    rede: "Rede Nacional",
    uf_sede: "SP",
    website: "https://auditpartners.com.br",
    email_contato: "parcerias@auditpartners.com.br",
    telefone: "(11) 4000-1000",
    status_parceria: "ativo",
    criado_em: now,
  })
  console.log("  + parceiro", pRef.id)
  await db.collection("configuracoes").doc("status").set({ online: true, updated_at: now }, { merge: true })
  await db.collection("configuracoes").doc("scoring").set(
    { pesos_scoring: { capital: 5, filiais: 5, regime: 5, cnae: 5, porte: 5 } },
    { merge: true },
  )
  console.log("Seed concluído.")
}

seed().catch((err) => {
  console.error("[AFS-ERROR]", err.message || err)
  process.exit(1)
})
