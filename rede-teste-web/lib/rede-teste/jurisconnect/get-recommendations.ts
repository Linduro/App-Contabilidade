import type { PrismaClient } from "@prisma/client";
import { subHours } from "date-fns";
import {
  JURISCONNECT_CACHE_MAX_HOURS,
  JURISCONNECT_CANDIDATE_POOL,
  JURISCONNECT_MAX_PER_AREA,
} from "./constants";
import { loadJurisConnectViewerContext } from "./load-viewer-context";
import { countMutualFollowersBatch } from "./mutual-followers";
import { scoreJurisConnectCandidate } from "./score-candidate";
import type { JurisConnectRecommendation } from "./types";

function diversifyByArea<T extends { practiceAreas: string[]; userId: string }>(
  scored: { item: T; score: number; reason: string }[],
  limit: number,
): typeof scored {
  const areaCount = new Map<string, number>();
  const pickedIds = new Set<string>();
  const out: typeof scored = [];

  for (const row of scored) {
    if (pickedIds.has(row.item.userId)) continue;
    const primary = row.item.practiceAreas[0]?.toLowerCase() ?? "_geral";
    const n = areaCount.get(primary) ?? 0;
    if (n >= JURISCONNECT_MAX_PER_AREA) continue;
    areaCount.set(primary, n + 1);
    pickedIds.add(row.item.userId);
    out.push(row);
    if (out.length >= limit) break;
  }

  if (out.length < limit) {
    for (const row of scored) {
      if (pickedIds.has(row.item.userId)) continue;
      pickedIds.add(row.item.userId);
      out.push(row);
      if (out.length >= limit) break;
    }
  }

  return out;
}

export async function getJurisConnectRecommendations(
  prisma: PrismaClient,
  options: {
    viewerId: string;
    blockedIds: string[];
    limit?: number;
    useCache?: boolean;
  },
): Promise<JurisConnectRecommendation[]> {
  const limit = options.limit ?? 5;
  const useCache = options.useCache ?? true;

  if (useCache) {
    const maxAge = subHours(new Date(), JURISCONNECT_CACHE_MAX_HOURS);
    const cached = await prisma.redeTesteFollowRecommendation.findMany({
      where: {
        userId: options.viewerId,
        updatedAt: { gte: maxAge },
        recommended: {
          userId: { notIn: options.blockedIds },
        },
      },
      orderBy: { similarityScore: "desc" },
      take: limit,
      include: {
        recommended: {
          include: {
            user: { select: { image: true } },
          },
        },
      },
    });

    if (cached.length >= limit) {
      const following = await prisma.redeTesteFollow.findMany({
        where: { followerId: options.viewerId },
        select: { followingId: true },
      });
      const followingSet = new Set(following.map((f) => f.followingId));

      return cached
        .filter((c) => !followingSet.has(c.recommendedUserId))
        .slice(0, limit)
        .map((c) => ({
          userId: c.recommendedUserId,
          handle: c.recommended.handle,
          displayName: c.recommended.displayName,
          bio: c.recommended.bio,
          image: c.recommended.user.image,
          oabVerified: c.recommended.oabVerified,
          verificationType: c.recommended.verificationType,
          similarityScore: Number(c.similarityScore),
          reason: c.reason,
          following: followingSet.has(c.recommendedUserId),
        }));
    }
  }

  const viewer = await loadJurisConnectViewerContext(
    prisma,
    options.viewerId,
    options.blockedIds,
  );

  const excludeIds = [
    options.viewerId,
    ...viewer.followingIds,
    ...viewer.blockedIds,
  ];

  const candidates = await prisma.redeTesteProfile.findMany({
    where: {
      userId: { notIn: excludeIds },
      OR: [{ publicationsCount: { gt: 0 } }, { oabVerified: true }],
    },
    take: JURISCONNECT_CANDIDATE_POOL,
    orderBy: [{ followersCount: "desc" }, { publicationsCount: "desc" }],
    include: {
      user: { select: { image: true } },
    },
  });

  if (candidates.length === 0) return [];

  const candidateIds = candidates.map((c) => c.userId);
  const [mutualMap, hashtagRows] = await Promise.all([
    countMutualFollowersBatch(prisma, options.viewerId, candidateIds),
    prisma.redeTestePublicationHashtag.findMany({
      where: {
        publication: {
          authorId: { in: candidateIds },
          deletedAt: null,
          parentId: null,
        },
      },
      select: {
        publication: { select: { authorId: true } },
        hashtag: { select: { tag: true } },
      },
      take: 500,
    }),
  ]);

  const hashtagsByAuthor = new Map<string, string[]>();
  for (const row of hashtagRows) {
    const aid = row.publication.authorId;
    const list = hashtagsByAuthor.get(aid) ?? [];
    if (!list.includes(row.hashtag.tag)) list.push(row.hashtag.tag);
    hashtagsByAuthor.set(aid, list);
  }

  const scored = candidates.map((c) => {
    const candidate = {
      userId: c.userId,
      handle: c.handle,
      displayName: c.displayName,
      bio: c.bio,
      image: c.user.image,
      oabVerified: c.oabVerified,
      verificationType: c.verificationType,
      practiceAreas: c.practiceAreas,
      location: c.location,
      followersCount: c.followersCount,
      publicationsCount: c.publicationsCount,
    };
    const breakdown = scoreJurisConnectCandidate(viewer, candidate, {
      mutualCount: mutualMap.get(c.userId) ?? 0,
      candidateHashtags: hashtagsByAuthor.get(c.userId) ?? [],
    });
    return {
      item: candidate,
      score: breakdown.similarityScore,
      reason: breakdown.reason,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const picked = diversifyByArea(scored, limit);

  return picked.map((row) => ({
    ...row.item,
    similarityScore: row.score,
    reason: row.reason,
    following: false,
  }));
}
