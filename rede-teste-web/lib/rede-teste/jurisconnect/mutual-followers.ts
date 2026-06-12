import { Prisma, type PrismaClient } from "@prisma/client";

/** Contagem de litisconsortes (seguem você e o candidato). */
export async function countMutualFollowersBatch(
  prisma: PrismaClient,
  viewerId: string,
  candidateIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (candidateIds.length === 0) return map;

  const rows = await prisma.$queryRaw<{ candidate_id: string; cnt: bigint }[]>`
    SELECT f2."followingId" AS candidate_id, COUNT(DISTINCT f1."followerId")::bigint AS cnt
    FROM "RedeTesteFollow" f1
    INNER JOIN "RedeTesteFollow" f2
      ON f1."followerId" = f2."followerId"
    WHERE f1."followingId" = ${viewerId}
      AND f2."followingId" IN (${Prisma.join(candidateIds)})
    GROUP BY f2."followingId"
  `;

  for (const row of rows) {
    map.set(row.candidate_id, Number(row.cnt));
  }
  return map;
}
