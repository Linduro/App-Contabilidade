import type { PrismaClient } from "@prisma/client";
import { subHours } from "date-fns";
import { calculatePostScore } from "./score-publication";
import { getOsFortesUserIds, loadPostsForScoring } from "./load-post-for-scoring";

export type RecalculateScoresResult = {
  processed: number;
  upserted: number;
  windowHours: number;
};

/**
 * Recalcula scores JurisRank para publicações principais recentes.
 * Padrão: últimas 48h (alinhado ao guia).
 */
export async function recalculateJurisRankScores(
  prisma: PrismaClient,
  options?: { sinceHours?: number; batchSize?: number },
): Promise<RecalculateScoresResult> {
  const sinceHours = options?.sinceHours ?? 48;
  const batchSize = options?.batchSize ?? 80;
  const since = subHours(new Date(), sinceHours);

  const osFortes = await getOsFortesUserIds(prisma);

  const publications = await prisma.redeTestePublication.findMany({
    where: {
      deletedAt: null,
      parentId: null,
      createdAt: { gte: since },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  let upserted = 0;

  for (let i = 0; i < publications.length; i += batchSize) {
    const chunk = publications.slice(i, i + batchSize);
    const ids = chunk.map((p) => p.id);
    const posts = await loadPostsForScoring(prisma, ids);

    for (const post of posts) {
      const scores = calculatePostScore(post, { osFortes });
      await prisma.redeTestePublicationScore.upsert({
        where: { publicationId: post.id },
        create: {
          publicationId: post.id,
          authorId: post.authorId,
          authorityScore: scores.authorityScore,
          engagementScore: scores.engagementScore,
          contentDepthScore: scores.contentDepthScore,
          baseScore: scores.baseScore,
          finalScore: scores.finalScore,
        },
        update: {
          authorityScore: scores.authorityScore,
          engagementScore: scores.engagementScore,
          contentDepthScore: scores.contentDepthScore,
          baseScore: scores.baseScore,
          finalScore: scores.finalScore,
        },
      });
      upserted += 1;
    }
  }

  return {
    processed: publications.length,
    upserted,
    windowHours: sinceHours,
  };
}
