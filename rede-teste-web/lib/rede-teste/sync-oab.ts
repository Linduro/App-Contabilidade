import type { PrismaClient } from "@prisma/client";

/** Atualiza badge OAB do perfil Rede Teste a partir de User, LawyerProfile ou TenantOab. */
export async function syncRedeTesteOab(
  prisma: PrismaClient,
  userId: string,
  tenantId: string,
) {
  const [user, lawyer, tenantOab] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { oabNumber: true, oabUf: true },
    }),
    prisma.lawyerProfile.findUnique({
      where: { userId },
      select: { oabNumber: true, oabUf: true },
    }),
    prisma.tenantOab.findFirst({
      where: { tenantId, responsibleUserId: userId, active: true },
      select: { oabNumber: true, oabUf: true },
    }),
  ]);

  const oabNumber = user?.oabNumber ?? lawyer?.oabNumber ?? tenantOab?.oabNumber;
  const oabUf = user?.oabUf ?? lawyer?.oabUf ?? tenantOab?.oabUf;
  const oabVerified = !!(oabNumber && oabUf);

  await prisma.redeTesteProfile.update({
    where: { userId },
    data: {
      oabVerified,
      verificationType: oabVerified ? "LAWYER" : "NONE",
    },
  });

  return { oabVerified, oabNumber, oabUf };
}
