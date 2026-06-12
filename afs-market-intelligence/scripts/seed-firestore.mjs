/**
 * Seed de dados de demonstração para AFS Market Intelligence no Firestore.
 * Uso: GOOGLE_APPLICATION_CREDENTIALS=path/to/sa.json node scripts/seed-firestore.mjs
 */
import fs from "fs"
import { initializeApp, cert, applicationDefault } from "firebase-admin/app"
import { getFirestore, Timestamp } from "firebase-admin/firestore"

try {
  const cred = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? cert(JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8")))
    : applicationDefault()
  initializeApp({
    credential: cred,
    projectId: process.env.FIREBASE_PROJECT_ID || "contabilidade-ebed6",
  })
} catch {
  initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || "contabilidade-ebed6" })
}

const db = getFirestore()
const now = Timestamp.now()
const daysAgo = (n) => Timestamp.fromDate(new Date(Date.now() - n * 86400000))

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
    socios: [{ nome: "João Silva", cpf_cnpj: "***", qualificacao: "Sócio-Administrador", email_socio: "joao@holdingalfa.com.br" }],
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
]

const parceiros = [
  {
    nome: "Audit Partners SP",
    rede: "Rede Nacional",
    uf_sede: "SP",
    website: "https://auditpartners.com.br",
    email_contato: "parcerias@auditpartners.com.br",
    telefone: "(11) 4000-1000",
    status_parceria: "ativo",
    criado_em: now,
  },
]

async function seed() {
  console.log("Seeding AFS Market Intelligence...")

  for (const lead of sampleLeads) {
    const ref = await db.collection("leads").add(lead)
    console.log("  lead:", ref.id, lead.razao_social)
  }

  for (const p of parceiros) {
    const ref = await db.collection("parceiros").add(p)
    console.log("  parceiro:", ref.id, p.nome)
  }

  await db.collection("configuracoes").doc("status").set({ online: true, updated_at: now }, { merge: true })
  await db.collection("configuracoes").doc("scoring").set(
    { pesos_scoring: { capital: 5, filiais: 5, regime: 5, cnae: 5, porte: 5 } },
    { merge: true },
  )
  await db.collection("configuracoes").doc("pipeline").set(
    { config: { ufs: ["SP", "MG"], regimes: ["LR", "LP"] } },
    { merge: true },
  )

  console.log("Seed concluído.")
}

seed().catch((err) => {
  console.error("[AFS-ERROR] seed failed:", err)
  process.exit(1)
})
