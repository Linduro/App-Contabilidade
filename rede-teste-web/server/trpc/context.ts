import type { NextRequest } from "next/server"
import { TRPCError } from "@trpc/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getPortalSessionFromCookies } from "@/lib/portal-session"
import { resolveGlobalTenantId } from "@/lib/provision-portal-user"

async function resolveTenant() {
  const id = await resolveGlobalTenantId(prisma)
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id } })
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
    const tenantId = await resolveGlobalTenantId(prisma)
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { tenantId, tenantRole: "ADMIN" },
    })
  }

  const session = user
    ? { user, session: { id: "portal-session", userId: user.id } }
    : betterSession

  const resolvedTenantId = tenant.id

  return {
    prisma,
    session,
    user: user ?? betterSession?.user ?? null,
    dbUser: dbUser
      ? {
          ...dbUser,
          tenantId: dbUser.tenantId ?? resolvedTenantId,
          tenantRole: dbUser.tenantRole ?? "ADMIN",
        }
      : null,
    tenant,
    tenantId: resolvedTenantId,
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
