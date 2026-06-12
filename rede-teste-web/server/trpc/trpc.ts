import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { hasPermission } from "@/lib/rbac";
import { tenantRoleHasPermission } from "@/lib/tenant";
import type { PermissionCode } from "@/lib/permissions";
import { isDevAuthBypass } from "@/lib/dev-auth-bypass-flag";
import { assertTenant, type TRPCContext } from "./context";

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { ...ctx, session: ctx.session, user: ctx.user },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);

const withTenant = t.middleware(({ ctx, next }) => {
  const scoped = assertTenant(ctx);
  return next({
    ctx: {
      ...ctx,
      ...scoped,
    },
  });
});

export const tenantProcedure = protectedProcedure.use(withTenant);

/** Workspace vinculado, sem exigir trial/assinatura ativa (ex.: /billing). */
const withTenantRelaxed = t.middleware(({ ctx, next }) => {
  if (!ctx.tenantId || !ctx.tenant || !ctx.dbUser?.tenantId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Workspace nao encontrado" });
  }
  return next({
    ctx: {
      ...ctx,
      tenantId: ctx.tenantId,
      tenant: ctx.tenant,
      dbUser: ctx.dbUser,
    },
  });
});

export const billingProcedure = protectedProcedure.use(withTenantRelaxed);

export function requirePermission(code: PermissionCode) {
  return tenantProcedure.use(async ({ ctx, next }) => {
    let legacyOk = false;
    if (isDevAuthBypass() && ctx.user.id === "dev-bypass") {
      legacyOk = false;
    } else {
      try {
        legacyOk = await hasPermission(ctx.user.id, code);
      } catch {
        legacyOk = false;
      }
    }
    const roleOk = tenantRoleHasPermission(ctx.dbUser.tenantRole, code);
    if (!legacyOk && !roleOk) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Permissao necessaria: ${code}`,
      });
    }
    return next({ ctx });
  });
}

/** Bloqueia módulo financeiro quando `acessoFinanceiro` está desmarcado na equipe. */
export function requireFinancePermission(code: PermissionCode) {
  return requirePermission(code).use(async ({ ctx, next }) => {
    if (code.startsWith("finance") && ctx.dbUser && !ctx.dbUser.acessoFinanceiro) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Sem acesso ao módulo financeiro",
      });
    }
    return next({ ctx });
  });
}
