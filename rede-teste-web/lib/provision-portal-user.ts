import type { PrismaClient } from "@prisma/client"
import { ensureRedeTesteProfile } from "./rede-teste/ensure-profile"

const GLOBAL_TENANT_ID = "rede-teste-global"

export async function provisionPortalUser(
  prisma: PrismaClient,
  input: { uid: string; email: string; name: string; image?: string | null },
) {
  await prisma.tenant.upsert({
    where: { id: GLOBAL_TENANT_ID },
    create: {
      id: GLOBAL_TENANT_ID,
      name: "Rede Teste",
      slug: "rede-teste",
      status: "ACTIVE",
    },
    update: {},
  })

  const email = input.email.toLowerCase()
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      id: input.uid,
      email,
      name: input.name || email.split("@")[0],
      image: input.image ?? null,
      tenantId: GLOBAL_TENANT_ID,
      tenantRole: "ADMIN",
      emailVerified: true,
    },
    update: {
      name: input.name || undefined,
      image: input.image ?? undefined,
      tenantId: GLOBAL_TENANT_ID,
    },
  })

  await ensureRedeTesteProfile(prisma, user.id, GLOBAL_TENANT_ID)
  return user
}
