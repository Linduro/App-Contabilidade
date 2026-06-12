import type { PrismaClient } from "@prisma/client";
import { subDays } from "date-fns";
import type { PostForScoring } from "./types";
import { JURISFEED_VELOCITY_WINDOW_MIN } from "@/lib/rede-teste/jurisfeed/constants";
import { EARLY_ENGAGEMENT_WINDOW_MIN, MIN_SUBSTANTIVE_COMMENT_CHARS } from "./score-publication";

/** Top 10 indicadores do mês = "Os Fortes". */
export async function getOsFortesUserIds(prisma: PrismaClient): Promise<Set<string>> {
  const since = subDays(new Date(), 30);
  const grouped = await prisma.redeTesteReferral.groupBy({
    by: ["referrerUserId"],
    where: { createdAt: { gte: since } },
    _count: { referredUserId: true },
    orderBy: { _count: { referredUserId: "desc" } },
    take: 10,
  });
  return new Set(grouped.map((g) => g.referrerUserId));
}

async function buildAuthorTopicStats(
  prisma: PrismaClient,
  authorIds: string[],
): Promise<
  Map<
    string,
    {
      totalLikesReceived: number;
      dominantPracticeArea: string | null;
      topicConsistency: number;
    }
  >
> {
  const map = new Map<
    string,
    { totalLikesReceived: number; dominantPracticeArea: string | null; topicConsistency: number }
  >();
  if (authorIds.length === 0) return map;

  const likeSums = await prisma.redeTestePublication.groupBy({
    by: ["authorId"],
    where: { authorId: { in: authorIds }, deletedAt: null, parentId: null },
    _sum: { likesCount: true },
  });

  const areaRows = await prisma.redeTestePublication.groupBy({
    by: ["authorId", "practiceArea"],
    where: {
      authorId: { in: authorIds },
      deletedAt: null,
      parentId: null,
      practiceArea: { not: null },
    },
    _count: { id: true },
  });

  const areaByAuthor = new Map<string, { area: string; count: number }>();
  for (const row of areaRows) {
    if (!row.practiceArea) continue;
    const prev = areaByAuthor.get(row.authorId);
    const count = row._count.id;
    if (!prev || count > prev.count) {
      areaByAuthor.set(row.authorId, { area: row.practiceArea, count });
    }
  }

  const totalPosts = await prisma.redeTestePublication.groupBy({
    by: ["authorId"],
    where: { authorId: { in: authorIds }, deletedAt: null, parentId: null },
    _count: { id: true },
  });
  const totalByAuthor = new Map(totalPosts.map((r) => [r.authorId, r._count.id]));

  for (const authorId of authorIds) {
    const dominant = areaByAuthor.get(authorId);
    const total = totalByAuthor.get(authorId) ?? 0;
    const dominantCount = dominant?.count ?? 0;
    const topicConsistency = total > 0 ? dominantCount / total : 0;
    map.set(authorId, {
      totalLikesReceived: likeSums.find((l) => l.authorId === authorId)?._sum.likesCount ?? 0,
      dominantPracticeArea: dominant?.area ?? null,
      topicConsistency,
    });
  }

  return map;
}

export async function loadPostsForScoring(
  prisma: PrismaClient,
  publicationIds: string[],
): Promise<PostForScoring[]> {
  if (publicationIds.length === 0) return [];

  const rows = await prisma.redeTestePublication.findMany({
    where: { id: { in: publicationIds }, deletedAt: null, parentId: null },
    include: {
      author: {
        select: {
          id: true,
          juridiquesProfile: {
            select: {
              practiceAreas: true,
              location: true,
              oabVerified: true,
              followersCount: true,
              publicationsCount: true,
            },
          },
        },
      },
      media: { select: { id: true } },
      replies: {
        where: { deletedAt: null },
        select: { id: true, content: true, authorId: true, createdAt: true },
      },
    },
  });

  const authorIds = [...new Set(rows.map((r) => r.authorId))];
  const pubIds = rows.map((r) => r.id);
  const [authorStats, reportGroups] = await Promise.all([
    buildAuthorTopicStats(prisma, authorIds),
    prisma.redeTesteReport.groupBy({
      by: ["publicationId"],
      where: { publicationId: { in: pubIds } },
      _count: { id: true },
    }),
  ]);
  const reportCountByPub = new Map(
    reportGroups.map((g) => [g.publicationId, g._count.id]),
  );

  return rows.map((pub) => {
    const profile = pub.author.juridiquesProfile;
    const stats = authorStats.get(pub.authorId) ?? {
      totalLikesReceived: 0,
      dominantPracticeArea: null,
      topicConsistency: 0,
    };

    const earlyCutoffRank = new Date(
      pub.createdAt.getTime() + EARLY_ENGAGEMENT_WINDOW_MIN * 60_000,
    );
    const earlyCutoffFeed = new Date(
      pub.createdAt.getTime() + JURISFEED_VELOCITY_WINDOW_MIN * 60_000,
    );
    let substantive = 0;
    let short = 0;
    let earlySubstantive = 0;
    let earlySubstantive2h = 0;
    let authorReplied = false;

    for (const reply of pub.replies) {
      const len = reply.content.trim().length;
      if (len >= MIN_SUBSTANTIVE_COMMENT_CHARS) {
        substantive += 1;
        if (reply.createdAt <= earlyCutoffRank) earlySubstantive += 1;
        if (reply.createdAt <= earlyCutoffFeed) earlySubstantive2h += 1;
      } else if (len > 0) {
        short += 1;
      }
      if (reply.authorId === pub.authorId) authorReplied = true;
    }

    return {
      id: pub.id,
      authorId: pub.authorId,
      content: pub.content,
      practiceArea: pub.practiceArea,
      createdAt: pub.createdAt,
      likesCount: pub.likesCount,
      bookmarksCount: pub.bookmarksCount,
      repostsCount: pub.repostsCount,
      viewsCount: pub.viewsCount,
      repliesCount: pub.repliesCount,
      sourceIntimationId: pub.sourceIntimationId,
      mediaCount: pub.media.length,
      author: {
        practiceAreas: profile?.practiceAreas ?? [],
        location: profile?.location ?? null,
        oabVerified: profile?.oabVerified ?? false,
        followersCount: profile?.followersCount ?? 0,
        publicationsCount: profile?.publicationsCount ?? 0,
        totalLikesReceived: stats.totalLikesReceived,
        dominantPracticeArea: stats.dominantPracticeArea,
        topicConsistency: stats.topicConsistency,
      },
      replies: {
        total: pub.replies.length,
        substantive,
        short,
        authorReplied,
        earlySubstantive,
        earlySubstantive2h,
      },
      reportCount: reportCountByPub.get(pub.id) ?? 0,
    };
  });
}

export async function loadViewerForScoring(
  prisma: PrismaClient,
  viewerId: string,
): Promise<import("./types").ViewerForScoring> {
  const [profile, following, likedAuthors] = await Promise.all([
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
      select: { publication: { select: { authorId: true } } },
      take: 60,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    userId: viewerId,
    practiceAreas: profile?.practiceAreas ?? [],
    location: profile?.location ?? null,
    followingIds: new Set(following.map((f) => f.followingId)),
    likedAuthorIds: new Set(likedAuthors.map((l) => l.publication.authorId)),
  };
}
