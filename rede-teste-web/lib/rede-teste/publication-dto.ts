import type { Prisma, PrismaClient } from "@prisma/client";
import { parseJqPoll, type JqPollStored } from "@/lib/rede-teste/poll";
import { loadJqPollDtosBatch, type JqPollDto } from "@/lib/rede-teste/poll-db";
import {
  parseLinkPreview,
  type JqLinkPreview,
} from "@/lib/rede-teste/link-preview-parsers";

export type { JqLinkPreview };
export { parseLinkPreview };
import {
  loadViewerLastRepliesBatch,
  type JqViewerLastReply,
} from "@/lib/rede-teste/viewer-last-reply";
import { loadLastRepliesBatch, type JqLastReply } from "@/lib/rede-teste/last-reply";

export type { JqViewerLastReply, JqLastReply };

export const jqAuthorInclude = {
  select: {
    id: true,
    name: true,
    image: true,
    juridiquesProfile: {
      select: {
        handle: true,
        displayName: true,
        oabVerified: true,
        verificationType: true,
      },
    },
  },
} as const;

export const jqPublicationInclude = {
  author: jqAuthorInclude,
  media: {
    orderBy: { order: "asc" as const },
    select: { id: true, url: true, type: true },
  },
  community: {
    select: { id: true, slug: true, name: true },
  },
  court: {
    select: { id: true, code: true, name: true },
  },
  jurisPost: {
    select: {
      id: true,
      titulo: true,
      document: {
        select: {
          id: true,
          slug: true,
          titulo: true,
          tribunal: true,
          relator: true,
          dataJulgamento: true,
          ementa: true,
          fonteUrl: true,
          tipoDecisao: true,
        },
      },
    },
  },
} as const;

export type JqPublicationRow = {
  id: string;
  content: string;
  practiceArea: string | null;
  createdAt: Date;
  likesCount: number;
  repostsCount: number;
  repliesCount: number;
  viewsCount: number;
  bookmarksCount?: number;
  authorId: string;
  isConfidential?: boolean;
  allowGifReplies?: boolean;
  poll?: unknown;
  linkPreview?: unknown;
  threadId?: string | null;
  threadPosition?: number | null;
  threadRootId?: string | null;
  status?: string;
  scheduledAt?: Date | null;
  court?: { id: string; code: string; name: string } | null;
  jurisPost?: {
    id: string;
    titulo: string | null;
    document: {
      id: string;
      slug: string;
      titulo: string;
      tribunal: string | null;
      relator: string | null;
      dataJulgamento: Date | null;
      ementa: string | null;
      fonteUrl: string | null;
      tipoDecisao: string | null;
    };
  } | null;
  community?: { id: string; slug: string; name: string } | null;
  media?: { id: string; url: string; type: string }[];
  author: {
    id: string;
    name: string;
    image: string | null;
    juridiquesProfile: {
      handle: string;
      displayName: string;
      oabVerified: boolean;
      verificationType: string;
    } | null;
  };
};

export type JqPublicationDto = {
  id: string;
  content: string;
  practiceArea: string | null;
  createdAt: Date;
  likesCount: number;
  repostsCount: number;
  repliesCount: number;
  viewsCount: number;
  bookmarksCount: number;
  author: {
    id: string;
    name: string;
    handle: string;
    image: string | null;
    oabVerified: boolean;
    verificationType: string;
  };
  viewer: {
    liked: boolean;
    reposted: boolean;
    bookmarked: boolean;
    isAuthor: boolean;
  };
  media: { id: string; url: string; type: string }[];
  isConfidential: boolean;
  allowGifReplies: boolean;
  community: { slug: string; name: string } | null;
  poll: JqPollStored | null;
  pollV2: JqPollDto | null;
  viewerPollOptionId: string | null;
  court: { code: string; name: string } | null;
  juris: {
    postId: string;
    slug: string;
    titulo: string;
    tribunal: string | null;
    relator: string | null;
    dataJulgamento: string | null;
    ementaExcerpt: string | null;
    fonteUrl: string | null;
    tipoDecisao: string | null;
  } | null;
  linkPreview: JqLinkPreview | null;
  thread: { threadId: string; partCount: number } | null;
  scheduledAt?: Date | null;
  /** Último comentário do viewer neste post (evita N+1 no feed). */
  viewerLastReply?: JqViewerLastReply | null;
  /** Último comentário de qualquer autor (quando o viewer ainda não comentou). */
  lastReply?: JqLastReply | null;
};

function pollDtoToLegacy(dto: JqPollDto): JqPollStored {
  return {
    options: dto.options.map((o) => ({
      id: o.id,
      label: o.label,
      votes: o.votes,
    })),
    endsAt: dto.expiresAt.toISOString(),
  };
}

export function mapJqPublication(
  row: JqPublicationRow,
  viewerId: string | null,
  likedIds: Set<string>,
  repostedIds: Set<string>,
  pollVoteOptionId: string | null = null,
  bookmarkedIds: Set<string> = new Set(),
  pollV2: JqPollDto | null = null,
  threadPartCount = 0,
  viewerLastReply: JqViewerLastReply | null = null,
  lastReply: JqLastReply | null = null,
): JqPublicationDto {
  const profile = row.author.juridiquesProfile;
  return {
    id: row.id,
    content: row.content,
    practiceArea: row.practiceArea,
    createdAt: row.createdAt,
    likesCount: row.likesCount,
    repostsCount: row.repostsCount,
    repliesCount: row.repliesCount,
    viewsCount: row.viewsCount,
    bookmarksCount: row.bookmarksCount ?? 0,
    author: {
      id: row.author.id,
      name: profile?.displayName ?? row.author.name,
      handle: profile?.handle ?? row.author.id.slice(0, 8),
      image: row.author.image,
      oabVerified: profile?.oabVerified ?? false,
      verificationType: profile?.verificationType ?? "NONE",
    },
    viewer: {
      liked: likedIds.has(row.id),
      reposted: repostedIds.has(row.id),
      bookmarked: bookmarkedIds.has(row.id),
      isAuthor: !!viewerId && row.authorId === viewerId,
    },
    media: (row.media ?? []).map((m) => ({
      id: m.id,
      url: m.url,
      type: m.type,
    })),
    isConfidential: row.isConfidential ?? false,
    allowGifReplies: row.allowGifReplies ?? true,
    community: row.community
      ? { slug: row.community.slug, name: row.community.name }
      : null,
    poll: pollV2 ? pollDtoToLegacy(pollV2) : parseJqPoll(row.poll),
    pollV2,
    viewerPollOptionId: pollVoteOptionId,
    court: row.court ? { code: row.court.code, name: row.court.name } : null,
    juris: row.jurisPost
      ? {
          postId: row.jurisPost.id,
          slug: row.jurisPost.document.slug,
          titulo: row.jurisPost.titulo ?? row.jurisPost.document.titulo,
          tribunal: row.jurisPost.document.tribunal,
          relator: row.jurisPost.document.relator,
          dataJulgamento: row.jurisPost.document.dataJulgamento
            ? row.jurisPost.document.dataJulgamento.toISOString().slice(0, 10)
            : null,
          ementaExcerpt: row.jurisPost.document.ementa?.slice(0, 280) ?? null,
          fonteUrl: row.jurisPost.document.fonteUrl,
          tipoDecisao: row.jurisPost.document.tipoDecisao,
        }
      : null,
    linkPreview: parseLinkPreview(row.linkPreview),
    thread:
      row.threadId && threadPartCount > 1
        ? { threadId: row.threadId, partCount: threadPartCount }
        : null,
    scheduledAt: row.scheduledAt ?? null,
    viewerLastReply: viewerLastReply ?? null,
    lastReply: lastReply ?? null,
  };
}

export async function loadJqViewerInteractions(
  prisma: PrismaClient,
  userId: string,
  publicationIds: string[],
) {
  if (publicationIds.length === 0) {
    return {
      likedIds: new Set<string>(),
      repostedIds: new Set<string>(),
      bookmarkedIds: new Set<string>(),
      pollVotes: new Map<string, string>(),
    };
  }
  const [likes, reposts, bookmarks, pollVotes] = await Promise.all([
    prisma.redeTesteLike.findMany({
      where: { userId, publicationId: { in: publicationIds } },
      select: { publicationId: true },
    }),
    prisma.redeTesteRepost.findMany({
      where: { userId, publicationId: { in: publicationIds } },
      select: { publicationId: true },
    }),
    prisma.redeTesteBookmark.findMany({
      where: { userId, publicationId: { in: publicationIds } },
      select: { publicationId: true },
    }),
    prisma.redeTestePollVote.findMany({
      where: { userId, poll: { publicationId: { in: publicationIds } } },
      select: { pollOptionId: true, poll: { select: { publicationId: true } } },
    }),
  ]);
  return {
    likedIds: new Set(likes.map((l) => l.publicationId)),
    repostedIds: new Set(reposts.map((r) => r.publicationId)),
    bookmarkedIds: new Set(bookmarks.map((b) => b.publicationId)),
    pollVotes: new Map(
      pollVotes.map((v) => [v.poll.publicationId, v.pollOptionId]),
    ),
  };
}

async function loadThreadPartCounts(
  prisma: PrismaClient,
  threadIds: string[],
): Promise<Map<string, number>> {
  const unique = [...new Set(threadIds.filter(Boolean))];
  if (!unique.length) return new Map();
  const groups = await prisma.redeTestePublication.groupBy({
    by: ["threadId"],
    where: { threadId: { in: unique }, deletedAt: null, status: "PUBLISHED" },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.threadId!, g._count._all]));
}

export async function mapJqPublications(
  prisma: PrismaClient,
  rows: JqPublicationRow[],
  viewerId: string | null,
) {
  const ids = rows.map((r) => r.id);
  const pollMap = await loadJqPollDtosBatch(prisma, ids, viewerId);
  const threadCounts = await loadThreadPartCounts(
    prisma,
    rows.map((r) => r.threadId).filter((id): id is string => !!id),
  );

  const parentIds = rows.filter((r) => r.repliesCount > 0).map((r) => r.id);

  if (!viewerId) {
    return rows.map((row) => {
      const p = pollMap.get(row.id);
      return mapJqPublication(
        row,
        null,
        new Set(),
        new Set(),
        null,
        new Set(),
        p?.poll ?? null,
        row.threadId ? threadCounts.get(row.threadId) ?? 0 : 0,
        null,
        null,
      );
    });
  }

  const [{ likedIds, repostedIds, bookmarkedIds, pollVotes }, lastReplies, viewerReplies] =
    await Promise.all([
      loadJqViewerInteractions(prisma, viewerId, ids),
      loadLastRepliesBatch(prisma, parentIds),
      loadViewerLastRepliesBatch(prisma, viewerId, parentIds),
    ]);

  return rows.map((row) => {
    const p = pollMap.get(row.id);
    return mapJqPublication(
      row,
      viewerId,
      likedIds,
      repostedIds,
      pollVotes.get(row.id) ?? p?.viewerOptionId ?? null,
      bookmarkedIds,
      p?.poll ?? null,
      row.threadId ? threadCounts.get(row.threadId) ?? 0 : 0,
      viewerReplies.get(row.id) ?? null,
      lastReplies.get(row.id) ?? null,
    );
  });
}

export function normalizeJqHandle(handle: string) {
  return handle.replace(/^@/, "").toLowerCase().trim();
}
