import type { PrismaClient } from "@prisma/client"
import { ensureRedeTesteProfile } from "./rede-teste/ensure-profile"

export const GLOBAL_TENANT_ID = "rede-teste-global"
const FALLBACK_TENANT_SLUG = "rede-teste-fipecafi"

/** Resolve tenant global — evita conflito de slug com tenants do Juridiquês no mesmo Postgres. */
export async function resolveGlobalTenantId(prisma: PrismaClient): Promise<string> {
  const byId = await prisma.tenant.findUnique({ where: { id: GLOBAL_TENANT_ID } })
  if (byId) return byId.id

  const bySlug = await prisma.tenant.findUnique({ where: { slug: "rede-teste" } })
  if (bySlug) return bySlug.id

  const created = await prisma.tenant.create({
    data: {
      id: GLOBAL_TENANT_ID,
      name: "Rede Teste",
      slug: FALLBACK_TENANT_SLUG,
      status: "ACTIVE",
    },
  })
  return created.id
}

export async function provisionPortalUser(
  prisma: PrismaClient,
  input: { uid: string; email: string; name: string; image?: string | null },
) {
  const tenantId = await resolveGlobalTenantId(prisma)
  const email = input.email.toLowerCase()

  const existing = await prisma.user.findUnique({ where: { email } })
  const user = existing
    ? await prisma.user.update({
        where: { email },
        data: {
          name: input.name || existing.name,
          image: input.image ?? existing.image,
          tenantId,
          emailVerified: true,
        },
      })
    : await prisma.user.create({
        data: {
          id: input.uid,
          email,
          name: input.name || email.split("@")[0],
          image: input.image ?? null,
          tenantId,
          tenantRole: "ADMIN",
          emailVerified: true,
        },
      })

  await ensureRedeTesteProfile(prisma, user.id, tenantId)
  return user
}
