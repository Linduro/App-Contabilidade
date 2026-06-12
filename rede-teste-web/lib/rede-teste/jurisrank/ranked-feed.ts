import type { Prisma, PrismaClient } from "@prisma/client";
import { subDays } from "date-fns";
import { jqGlobalFeedWhere } from "@/lib/rede-teste/global-scope";
import {
  jqAuthorInclude,
  jqPublicationInclude,
} from "@/lib/rede-teste/publication-dto";

const jqRankFeedInclude = {
  ...jqPublicationInclude,
  author: {
    select: {
      ...jqAuthorInclude.select,
      juridiquesProfile: {
        select: {
          handle: true,
          displayName: true,
          oabVerified: true,
          verificationType: true,
          practiceAreas: true,
          location: true,
        },
      },
    },
  },
  score: true,
} as const;
import { applyJurisFeedBoosts } from "@/lib/rede-teste/jurisfeed/feed-boosts";
import { applyViewerRelevance, calculatePostScore } from "./score-publication";
import {
  getOsFortesUserIds,
  loadPostsForScoring,
  loadViewerForScoring,
} from "./load-post-for-scoring";
import type { JurisRankCursor, PostForScoring } from "./types";

const FEED_MAX_AGE_DAYS = 30;

export function jurisRankCursorWhere(
  cursor: JurisRankCursor | undefined,
): Prisma.RedeTestePublicationWhereInput {
  if (!cursor) return {};
  const score = cursor.finalScore;
  const createdAt = cursor.createdAt;
  const id = cursor.id;
  return {
    OR: [
      { score: { finalScore: { lt: score } } },
      {
        AND: [{ score: { finalScore: score } }, { createdAt: { lt: createdAt } }],
      },
      {
        AND: [{ score: { finalScore: score } }, { createdAt }, { id: { lt: id } }],
      },
      { score: { is: null }, createdAt: { lt: createdAt } },
    ],
  };
}

function postSliceFromRow(
  row: {
    id: string;
    authorId: string;
    practiceArea: string | null;
    author: {
      juridiquesProfile: {
        practiceAreas: string[];
        location: string | null;
      } | null;
    };
  },
): Pick<PostForScoring, "authorId" | "practiceArea" | "author"> {
  const profile = row.author.juridiquesProfile;
  return {
    authorId: row.authorId,
    practiceArea: row.practiceArea,
    author: {
      practiceAreas: profile?.practiceAreas ?? [],
      location: profile?.location ?? null,
      oabVerified: false,
      followersCount: 0,
      publicationsCount: 0,
      totalLikesReceived: 0,
      dominantPracticeArea: null,
      topicConsistency: 0,
    },
  };
}

/**
 * Feed "Para você" ordenado por JurisRank 2026.
 */
export async function fetchRankedFeedPublications(
  prisma: PrismaClient,
  options: {
    viewerId: string;
    viewerTenantId?: string | null;
    authorFilter?: Prisma.RedeTestePublicationWhereInput["authorId"];
    rankCursor?: JurisRankCursor;
    limit: number;
  },
) {
  const since = subDays(new Date(), FEED_MAX_AGE_DAYS);
  const where: Prisma.RedeTestePublicationWhereInput = {
    ...jqGlobalFeedWhere(
      options.viewerId,
      {
        createdAt: { gte: since },
        ...(options.authorFilter ? { authorId: options.authorFilter } : {}),
        ...jurisRankCursorWhere(options.rankCursor),
      },
      options.viewerTenantId,
    ),
  };

  const fetchLimit = Math.min(options.limit + 8, 40);

  const rows = await prisma.redeTestePublication.findMany({
    where,
    include: jqRankFeedInclude,
    orderBy: [
      { score: { finalScore: "desc" } },
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: fetchLimit,
  });

  const viewer = await loadViewerForScoring(prisma, options.viewerId);
  const missingScoreIds = rows.filter((r) => !r.score).map((r) => r.id);

  let postById = new Map<string, Awaited<ReturnType<typeof loadPostsForScoring>>[number]>();
  let osFortes = new Set<string>();

  if (missingScoreIds.length > 0) {
    [osFortes, postById] = await Promise.all([
      getOsFortesUserIds(prisma),
      loadPostsForScoring(prisma, missingScoreIds).then((posts) => {
        const m = new Map<string, (typeof posts)[number]>();
        for (const p of posts) m.set(p.id, p);
        return m;
      }),
    ]);
  }

  const scored = rows.map((row) => {
    const post = postById.get(row.id);
    let effectiveScore: number;
    if (row.score) {
      const stored = Number(row.score.finalScore);
      effectiveScore = applyViewerRelevance(stored, postSliceFromRow(row), viewer);
    } else if (post) {
      const base = calculatePostScore(post, { osFortes, viewer }).finalScore;
      effectiveScore = applyJurisFeedBoosts(base, post);
    } else {
      effectiveScore = row.createdAt.getTime() / 1e10;
    }
    return { row, effectiveScore };
  });

  scored.sort((a, b) => {
    if (b.effectiveScore !== a.effectiveScore) return b.effectiveScore - a.effectiveScore;
    const t = b.row.createdAt.getTime() - a.row.createdAt.getTime();
    if (t !== 0) return t;
    return b.row.id.localeCompare(a.row.id);
  });

  const page = scored.slice(0, options.limit + 1);
  const hasMore = page.length > options.limit;
  const items = hasMore ? page.slice(0, options.limit) : page;
  const last = items[items.length - 1];

  const nextCursor: JurisRankCursor | null =
    hasMore && last
      ? {
          finalScore: last.effectiveScore,
          createdAt: last.row.createdAt,
          id: last.row.id,
        }
      : null;

  return { rows: items.map((i) => i.row), nextCursor };
}
