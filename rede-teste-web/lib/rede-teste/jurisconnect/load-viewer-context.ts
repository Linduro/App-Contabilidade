import type { PrismaClient } from "@prisma/client";
import type { JurisConnectViewerContext } from "./types";

export async function loadJurisConnectViewerContext(
  prisma: PrismaClient,
  viewerId: string,
  blockedIds: string[],
): Promise<JurisConnectViewerContext> {
  const [profile, following, likedRows] = await Promise.all([
    prisma.redeTesteProfile.findUnique({
      where: { userId: viewerId },
      select: { practiceAreas: true, location: true },
    }),
    prisma.redeTesteFollow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    }),
    prisma.redeTesteLike.findMany({
      where: { userId: viewerId },
      select: {
        publication: {
          select: {
            authorId: true,
            hashtags: {
              select: { hashtag: { select: { tag: true } } },
            },
          },
        },
      },
      take: 150,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const tagCounts = new Map<string, number>();
  const likedAuthorIds = new Set<string>();
  for (const row of likedRows) {
    likedAuthorIds.add(row.publication.authorId);
    for (const h of row.publication.hashtags) {
      const tag = h.hashtag.tag.toLowerCase();
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const topHashtags = new Set(
    [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([t]) => t),
  );

  return {
    userId: viewerId,
    practiceAreas: profile?.practiceAreas ?? [],
    location: profile?.location ?? null,
    followingIds: new Set(following.map((f) => f.followingId)),
    blockedIds: new Set(blockedIds),
    likedAuthorIds,
    topHashtags,
  };
}
