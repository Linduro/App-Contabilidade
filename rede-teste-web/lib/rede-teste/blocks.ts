import type { PrismaClient } from "@prisma/client";

export async function getJqBlockedUserIds(
  prisma: PrismaClient,
  userId: string,
): Promise<string[]> {
  const rows = await prisma.redeTesteBlock.findMany({
    where: { blockerId: userId },
    select: { blockedId: true },
  });
  return rows.map((r) => r.blockedId);
}
