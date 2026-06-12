import { subDays } from "date-fns";
import type { PrismaClient } from "@prisma/client";

const NEW_ACCOUNT_DAYS = 14;
const DAILY_LIMIT_NEW = 20;

export async function assertJqPublicationRateLimit(
  prisma: PrismaClient,
  userId: string,
  tenantId: string,
) {
  const profile = await prisma.redeTesteProfile.findUnique({
    where: { userId },
    select: { createdAt: true },
  });
  if (!profile) return;

  const cutoff = subDays(new Date(), NEW_ACCOUNT_DAYS);
  if (profile.createdAt < cutoff) return;

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const todayCount = await prisma.redeTestePublication.count({
    where: {
      tenantId,
      authorId: userId,
      parentId: null,
      deletedAt: null,
      createdAt: { gte: dayStart },
    },
  });

  if (todayCount >= DAILY_LIMIT_NEW) {
    throw new Error(
      `Limite de ${DAILY_LIMIT_NEW} publicações por dia para contas novas (até ${NEW_ACCOUNT_DAYS} dias). Tente amanhã.`,
    );
  }
}
