import { hashPassword } from "better-auth/crypto"
import { eq } from "drizzle-orm"
import { db } from "./index.js"
import { expertisesCatalog, profiles, users } from "./schema.js"
import { enqueueEmbeddingJob } from "../lib/redis.js"
import { closeDb } from "./index.js"
import { closeRedis } from "../lib/redis.js"

const EXPERTISES_POOL = [
  "IFRS",
  "CPC 47",
  "Auditoria",
  "ESG",
  "Transfer Pricing",
  "Direito Tributário",
  "M&A",
  "Valuation",
  "LGPD",
  "Compliance",
  "Contabilidade Societária",
  "Gestão de Riscos",
  "BI Financeiro",
  "Planejamento Tributário",
  "Controladoria",
] as const

const AREAS = [
  "Contabilidade",
  "Auditoria",
  "Finanças",
  "Tributário",
  "Consultoria",
  "Compliance",
  "Controladoria",
] as const

const SEED_USERS = [
  {
    nome: "Ana Paula Mendes",
    email: "ana.mendes@seed.fipecafi.local",
    cargo: "Gerente de Auditoria",
    empresa: "Deloitte",
    turma: "2018",
    areas: ["Auditoria", "Compliance"],
    expertises: ["Auditoria", "IFRS", "ESG", "Compliance"],
    oferece:
      "Mentoria em carreira de auditoria e revisão de relatórios IFRS para equipes juniores.",
    busca: "Parceiros para projetos de due diligence em setor de energia.",
  },
  {
    nome: "Bruno Costa Silva",
    email: "bruno.costa@seed.fipecafi.local",
    cargo: "Analista Sênior Tributário",
    empresa: "PwC",
    turma: "2019",
    areas: ["Tributário", "Consultoria"],
    expertises: ["Planejamento Tributário", "Transfer Pricing", "Direito Tributário"],
    oferece: "Apoio em estruturação de operações e revisão de planejamento tributário.",
    busca: "Contatos em M&A e valuation para projetos integrados.",
  },
  {
    nome: "Carla Ribeiro",
    email: "carla.ribeiro@seed.fipecafi.local",
    cargo: "Controller",
    empresa: "Ambev",
    turma: "2017",
    areas: ["Controladoria", "Finanças"],
    expertises: ["Controladoria", "BI Financeiro", "Contabilidade Societária"],
    oferece: "Troca de experiências em fechamento mensal e dashboards de FP&A.",
    busca: "Especialistas em IFRS 16 e políticas contábeis complexas.",
  },
  {
    nome: "Diego Almeida",
    email: "diego.almeida@seed.fipecafi.local",
    cargo: "Consultor ESG",
    empresa: "EY",
    turma: "2020",
    areas: ["Consultoria", "Compliance"],
    expertises: ["ESG", "Compliance", "Gestão de Riscos"],
    oferece: "Workshops sobre métricas ESG e materialidade para relatórios integrados.",
    busca: "Profissionais de auditoria para validação de indicadores não financeiros.",
  },
  {
    nome: "Elena Ferreira",
    email: "elena.ferreira@seed.fipecafi.local",
    cargo: "Associada M&A",
    empresa: "BTG Pactual",
    turma: "2016",
    areas: ["Finanças", "Consultoria"],
    expertises: ["M&A", "Valuation", "Due Diligence"],
    oferece: "Introdução a modelagem de valuation e análise de targets.",
    busca: "Contadores com experiência em carve-out e reorganizações societárias.",
  },
  {
    nome: "Felipe Nascimento",
    email: "felipe.nascimento@seed.fipecafi.local",
    cargo: "Perito Contábil",
    empresa: "Autônomo",
    turma: "2015",
    areas: ["Contabilidade", "Consultoria"],
    expertises: ["Contabilidade Societária", "IFRS", "Valuation"],
    oferece: "Pareceres técnicos e suporte em litígios societários.",
    busca: "Rede de advogados tributaristas para casos multidisciplinares.",
  },
  {
    nome: "Gabriela Souza",
    email: "gabriela.souza@seed.fipecafi.local",
    cargo: "Analista de Compliance",
    empresa: "Itaú",
    turma: "2021",
    areas: ["Compliance", "Finanças"],
    expertises: ["LGPD", "Compliance", "Gestão de Riscos"],
    oferece: "Boas práticas de governança de dados e mapeamento de riscos operacionais.",
    busca: "Mentores em carreira corporativa e certificações internacionais.",
  },
  {
    nome: "Henrique Lima",
    email: "henrique.lima@seed.fipecafi.local",
    cargo: "Gerente Fiscal",
    empresa: "Vale",
    turma: "2014",
    areas: ["Tributário", "Contabilidade"],
    expertises: ["Planejamento Tributário", "CPC 47", "Contabilidade Societária"],
    oferece: "Troca sobre impactos fiscais de novos CPCs e controles internos.",
    busca: "Especialistas em transfer pricing internacional.",
  },
  {
    nome: "Isabela Martins",
    email: "isabela.martins@seed.fipecafi.local",
    cargo: "Auditora Pleno",
    empresa: "KPMG",
    turma: "2022",
    areas: ["Auditoria", "Contabilidade"],
    expertises: ["Auditoria", "IFRS", "CPC 47"],
    oferece: "Revisão de papers de graduação e preparação para certificações.",
    busca: "Oportunidades de mentoria em big four e projetos setoriais.",
  },
  {
    nome: "João Pedro Carvalho",
    email: "joao.carvalho@seed.fipecafi.local",
    cargo: "BI Analyst",
    empresa: "Nubank",
    turma: "2023",
    areas: ["Finanças", "Controladoria"],
    expertises: ["BI Financeiro", "Controladoria", "Planejamento Tributário"],
    oferece: "Templates de Power BI e automação de relatórios gerenciais.",
    busca: "Contadores com visão de negócio para squads de produto financeiro.",
  },
  {
    nome: "Larissa Duarte",
    email: "larissa.duarte@seed.fipecafi.local",
    cargo: "Tax Manager",
    empresa: "Mars",
    turma: "2013",
    areas: ["Tributário", "Compliance"],
    expertises: ["Direito Tributário", "Transfer Pricing", "Compliance"],
    oferece: "Discussão de casos reais em contencioso e defesas administrativas.",
    busca: "Parceiros para projetos de reestruturação societária.",
  },
  {
    nome: "Marcos Vieira",
    email: "marcos.vieira@seed.fipecafi.local",
    cargo: "CFO",
    empresa: "Scale-up SaaS",
    turma: "2012",
    areas: ["Finanças", "Controladoria"],
    expertises: ["Valuation", "M&A", "BI Financeiro", "Gestão de Riscos"],
    oferece: "Mentoria para controllers em fase de scale-up e captação.",
    busca: "Especialistas em ESG reporting para investidores.",
  },
  {
    nome: "Natália Prado",
    email: "natalia.prado@seed.fipecafi.local",
    cargo: "Consultora Societária",
    empresa: "Grant Thornton",
    turma: "2018",
    areas: ["Contabilidade", "Consultoria"],
    expertises: ["Contabilidade Societária", "IFRS", "M&A"],
    oferece: "Apoio em conversão para IFRS e consolidação de grupos econômicos.",
    busca: "Contatos em auditoria externa para projetos conjuntos.",
  },
  {
    nome: "Otávio Borges",
    email: "otavio.borges@seed.fipecafi.local",
    cargo: "Risk Officer",
    empresa: "Bradesco",
    turma: "2011",
    areas: ["Compliance", "Finanças"],
    expertises: ["Gestão de Riscos", "LGPD", "Compliance", "ESG"],
    oferece: "Frameworks de risco operacional e integração ESG em comitês.",
    busca: "Profissionais de auditoria interna com foco digital.",
  },
  {
    nome: "Patrícia Gomes",
    email: "patricia.gomes@seed.fipecafi.local",
    cargo: "Diretora de Controladoria",
    empresa: "Magazine Luiza",
    turma: "2010",
    areas: ["Controladoria", "Finanças"],
    expertises: ["Controladoria", "CPC 47", "BI Financeiro", "Planejamento Tributário"],
    oferece: "Visão estratégica de controladoria em varejo omnichannel.",
    busca: "Talentos para pipeline de liderança e projetos de automação.",
  },
] as const

async function seed() {
  console.info("[seed] Iniciando...")

  for (const tag of EXPERTISES_POOL) {
    await db
      .insert(expertisesCatalog)
      .values({ nome: tag, categoria: "contabil-financeiro" })
      .onConflictDoNothing()
  }

  const passwordHash = await hashPassword("Seed@123456")

  for (const item of SEED_USERS) {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, item.email),
    })

    if (existing) {
      console.info("[seed] Já existe:", item.email)
      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, existing.id),
      })
      if (profile) {
        await enqueueEmbeddingJob(profile.id, { jobId: `seed-${profile.id}-${Date.now()}` })
      }
      continue
    }

    const [user] = await db
      .insert(users)
      .values({ email: item.email, passwordHash })
      .returning()

    if (!user) continue

    const [profile] = await db
      .insert(profiles)
      .values({
        userId: user.id,
        nome: item.nome,
        turma: item.turma,
        cargoAtual: item.cargo,
        empresa: item.empresa,
        areaAtuacao: [...item.areas],
        expertises: [...item.expertises],
        oQueOfeco: item.oferece,
        oQueBusco: item.busca,
        bio: `${item.cargo} na ${item.empresa}. Turma ${item.turma}.`,
        disponivelMentoria: Math.random() > 0.5,
      })
      .returning()

    if (profile) {
      await enqueueEmbeddingJob(profile.id)
      console.info("[seed] Criado:", item.nome)
    }
  }

  console.info("[seed] Concluído. Rode o worker: npm run dev:worker")
}

seed()
  .catch((err) => {
    console.error("[seed] Erro:", err)
    process.exit(1)
  })
  .finally(async () => {
    await closeRedis().catch(() => undefined)
    await closeDb().catch(() => undefined)
    process.exit(0)
  })
