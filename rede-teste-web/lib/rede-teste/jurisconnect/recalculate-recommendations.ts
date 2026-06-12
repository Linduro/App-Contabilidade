import type { PrismaClient } from "@prisma/client";
import { subDays } from "date-fns";
import { getJqBlockedUserIds } from "@/lib/rede-teste/blocks";
import { getJurisConnectRecommendations } from "./get-recommendations";

export type RecalculateJurisConnectResult = {
  usersProcessed: number;
  recommendationsUpserted: number;
};

/**
 * Atualiza cache de recomendações para usuários ativos (publicou ou curtiu nos últimos 14 dias).
 */
export async function recalculateJurisConnectRecommendations(
  prisma: PrismaClient,
  options?: { userBatchSize?: number; recommendationsPerUser?: number },
): Promise<RecalculateJurisConnectResult> {
  const batchSize = options?.userBatchSize ?? 40;
  const perUser = options?.recommendationsPerUser ?? 12;
  const since = subDays(new Date(), 14);

  const activeAuthors = await prisma.redeTestePublication.findMany({
    where: { createdAt: { gte: since }, deletedAt: null, parentId: null },
    select: { authorId: true },
    distinct: ["authorId"],
    take: batchSize * 2,
  });

  const activeLikers = await prisma.redeTesteLike.findMany({
    where: { createdAt: { gte: since } },
    select: { userId: true },
    distinct: ["userId"],
    take: batchSize * 2,
  });

  const userIds = [
    ...new Set([
      ...activeAuthors.map((a) => a.authorId),
      ...activeLikers.map((l) => l.userId),
    ]),
  ].slice(0, batchSize);

  let recommendationsUpserted = 0;

  for (const userId of userIds) {
    const blockedIds = await getJqBlockedUserIds(prisma, userId);
    const recs = await getJurisConnectRecommendations(prisma, {
      viewerId: userId,
      blockedIds,
      limit: perUser,
      useCache: false,
    });

    for (const rec of recs) {
      await prisma.redeTesteFollowRecommendation.upsert({
        where: {
          userId_recommendedUserId: {
            userId,
            recommendedUserId: rec.userId,
          },
        },
        create: {
          userId,
          recommendedUserId: rec.userId,
          similarityScore: rec.similarityScore,
          reason: rec.reason.slice(0, 200),
        },
        update: {
          similarityScore: rec.similarityScore,
          reason: rec.reason.slice(0, 200),
        },
      });
      recommendationsUpserted += 1;
    }
  }

  return {
    usersProcessed: userIds.length,
    recommendationsUpserted,
  };
}
