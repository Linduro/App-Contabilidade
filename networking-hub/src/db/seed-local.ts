import { hashPassword } from "better-auth/crypto"
import type { AppDatabase } from "./setup.js"
import { expertisesCatalog, profiles, users } from "./schema.js"
import { enqueueEmbeddingJob } from "../lib/redis.js"

const DEMO_USER = {
  nome: "Demo Networking",
  email: "demo@fipecafi.local",
  password: "demo123456",
  cargo: "Analista",
  empresa: "FIPECAFI",
  areas: ["Contabilidade", "Auditoria"] as string[],
  expertises: ["IFRS", "Auditoria"] as string[],
  oferece: "Mentoria em carreira contábil e revisão de relatórios.",
  busca: "Conexões com profissionais de auditoria e tributário.",
}

export async function runSeedIfEmpty(db: AppDatabase): Promise<void> {
  const existing = await db.query.users.findFirst()
  if (existing) return

  console.info("[seed] Banco vazio — criando usuário demo (demo@fipecafi.local / demo123456)")

  for (const nome of DEMO_USER.expertises) {
    await db
      .insert(expertisesCatalog)
      .values({ nome })
      .onConflictDoNothing()
  }

  const passwordHash = await hashPassword(DEMO_USER.password)
  const [user] = await db
    .insert(users)
    .values({ email: DEMO_USER.email, passwordHash })
    .returning()

  if (!user) return

  const [profile] = await db
    .insert(profiles)
    .values({
      userId: user.id,
      nome: DEMO_USER.nome,
      cargoAtual: DEMO_USER.cargo,
      empresa: DEMO_USER.empresa,
      areaAtuacao: DEMO_USER.areas,
      expertises: DEMO_USER.expertises,
      oQueOfeco: DEMO_USER.oferece,
      oQueBusco: DEMO_USER.busca,
      disponivelMentoria: true,
    })
    .returning()

  if (profile?.id) {
    await enqueueEmbeddingJob(profile.id)
  }

  console.info("[seed] Demo pronto. Faça login com", DEMO_USER.email)
}
