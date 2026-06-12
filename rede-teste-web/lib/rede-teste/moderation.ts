import { TRPCError } from "@trpc/server";
import type { TenantMemberRole } from "@prisma/client";

export function assertRedeTesteOwner(role: TenantMemberRole | null | undefined) {
  if (role !== "OWNER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Somente o proprietário do escritório pode acessar a moderação da rede",
    });
  }
}

export function isRedeTesteOwner(role: TenantMemberRole | null | undefined) {
  return role === "OWNER";
}
