/**
 * Seed genérico — sem dados de escritório, Maria Lima ou AdvForte.
 */
import "dotenv/config"
import { prisma } from "../lib/prisma"
const TENANT_ID = "rede-teste-global"

async function main() {
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    create: {
      id: TENANT_ID,
      name: "Rede Teste",
      slug: "rede-teste",
      status: "ACTIVE",
    },
    update: {},
  })

  const demoUsers = [
    { email: "aluno.demo@rede-teste.local", name: "Aluno Demo", handle: "aluno_demo" },
    { email: "prof.demo@rede-teste.local", name: "Prof. Demo", handle: "prof_demo" },
  ]

  for (const u of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        name: u.name,
        tenantId: TENANT_ID,
        tenantRole: "ADMIN",
      },
      update: { name: u.name, tenantId: TENANT_ID },
    })

    await prisma.redeTesteProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        tenantId: TENANT_ID,
        handle: u.handle,
        displayName: u.name,
        bio: "Perfil de demonstração da Rede Teste.",
        onboardingCompleted: true,
      },
      update: { displayName: u.name },
    })
  }

  console.log("Seed Rede Teste OK (dados fictícios apenas).")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
