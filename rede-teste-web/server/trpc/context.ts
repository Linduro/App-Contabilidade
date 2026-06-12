import type { NextRequest } from "next/server"
import { TRPCError } from "@trpc/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getPortalSessionFromCookies } from "@/lib/portal-session"

const GLOBAL_TENANT_ID = "rede-teste-global"

async function resolveTenant() {
  let tenant = await prisma.tenant.findUnique({ where: { id: GLOBAL_TENANT_ID } })
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        id: GLOBAL_TENANT_ID,
        name: "Rede Teste",
        slug: "rede-teste",
        status: "ACTIVE",
      },
    })
  }
  return tenant
}

export async function createTRPCContext(opts: { req: Request | NextRequest }) {
  const headers = opts.req.headers
  const portalSession = await getPortalSessionFromCookies()
  const betterSession = portalSession ? null : await auth.api.getSession({ headers })

  const xf = headers.get("x-forwarded-for") ?? ""
  const ip = xf.split(",")[0]?.trim() || headers.get("x-real-ip") || null
  const userAgent = headers.get("user-agent") || null
  const tenant = await resolveTenant()

  let user: { id: string; email: string; name: string } | null = null

  if (portalSession) {
    user = {
      id: portalSession.userId,
      email: portalSession.email,
      name: portalSession.name,
    }
  } else if (betterSession?.user?.id) {
    user = {
      id: betterSession.user.id,
      email: betterSession.user.email,
      name: betterSession.user.name ?? betterSession.user.email,
    }
  }

  const dbUser = user
    ? await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          tenantId: true,
          tenantRole: true,
          email: true,
          name: true,
        },
      })
    : null

  if (dbUser && !dbUser.tenantId) {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { tenantId: GLOBAL_TENANT_ID, tenantRole: "ADMIN" },
    })
  }

  const session = user
    ? { user, session: { id: "portal-session", userId: user.id } }
    : betterSession

  return {
    prisma,
    session,
    user: user ?? betterSession?.user ?? null,
    dbUser: dbUser
      ? { ...dbUser, tenantId: dbUser.tenantId ?? GLOBAL_TENANT_ID, tenantRole: dbUser.tenantRole ?? "ADMIN" }
      : null,
    tenant,
    tenantId: tenant.id,
    headers,
    ip,
    userAgent,
  }
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>

export function assertTenant(ctx: TRPCContext) {
  if (!ctx.tenantId || !ctx.tenant || !ctx.dbUser?.tenantId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Workspace não encontrado" })
  }
  return {
    tenantId: ctx.tenantId,
    tenant: ctx.tenant,
    dbUser: ctx.dbUser,
  }
}
