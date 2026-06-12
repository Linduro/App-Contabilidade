import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, tenantProcedure, publicProcedure, requirePermission } from "../trpc";
import { ensureRedeTesteProfile } from "@/lib/rede-teste/ensure-profile";
import { jqCursorSchema, jqCursorWhere, jqFeedCursorSchema } from "@/lib/rede-teste/cursor";
import { fetchRankedFeedPublications } from "@/lib/rede-teste/jurisrank/ranked-feed";
import { getJurisConnectRecommendations } from "@/lib/rede-teste/jurisconnect/get-recommendations";
import {
  jqPublicationInclude,
  mapJqPublication,
  mapJqPublications,
  normalizeJqHandle,
} from "@/lib/rede-teste/publication-dto";
import { syncJqPublicationMeta, createJqNotification } from "@/lib/rede-teste/publication-meta";
import { getJqBlockedUserIds } from "@/lib/rede-teste/blocks";
import { syncRedeTesteOab } from "@/lib/rede-teste/sync-oab";
import { isOabRegistryVerified } from "@/lib/platform-config";
import { assertRedeTesteOwner } from "@/lib/rede-teste/moderation";
import { ensureRedeTesteCommunities } from "@/lib/rede-teste/communities-seed";
import { dedupeJqCommunitiesBySlug } from "@/lib/rede-teste/communities-global";
import {
  assistant_PROMPTS,
  fillPromptTemplate,
} from "@/lib/rede-teste/assistant-prompts";
import {
  mergeJqProfileSettings,
  parseJqProfileSettings,
} from "@/lib/rede-teste/profile-settings";
import { buildEstagiarioSources } from "@/lib/rede-teste/assistant-sources-disabled";
import {
  formatGeminiErrorForUser,
  isGeminiEstagiarioConfigured,
  runEstagiarioGeminiChat,
} from "@/lib/rede-teste/gemini-estagiario";
import { assertJqPublicationRateLimit } from "@/lib/rede-teste/post-rate-limit";
import {
  dmMessageDisplayBody,
  resolveDmSharedPublicationId,
} from "@/lib/rede-teste/dm-publication-share";
import { loadDmPublicationPreviews } from "@/lib/rede-teste/dm-publication-preview";
import { buildIntimationShareContent } from "@/lib/rede-teste/draft-share-disabled";
import { parseJqPoll } from "@/lib/rede-teste/poll";
import {
  createJqPublicationsFromInput,
  jqCreatePublicationInputSchema,
} from "@/lib/rede-teste/create-publication";
import { getJqComposerFeatures } from "@/lib/rede-teste/plans";
import { loadJqPollDto, pollIsOpen } from "@/lib/rede-teste/poll-db";
import { tryRecordJqReferral } from "@/lib/rede-teste/record-referral";
import {
  jqGlobalFeedWhere,
  jqPublicationVisibleWhere,
  jqPublicReadWhere,
  jqRepliesWhere,
} from "@/lib/rede-teste/global-scope";
import { assertJqRateLimit } from "@/lib/rede-teste/jq-rate-limit";
import { jqUserIdSchema } from "@/lib/rede-teste/id-schema";
import {
  countUnreadJqMessages,
} from "@/lib/rede-teste/unread-dms";
import { batchUnreadByConversation } from "@/lib/rede-teste/unread-conversations";
import { audit } from "@/lib/audit";
import { computeProfileDiff } from "@/lib/rede-teste/profile/compute-diff";
import { JQ_PROFESSIONAL_KINDS } from "@/lib/rede-teste/profile/professional-kind";
import { isReservedJqHandle } from "@/lib/rede-teste/reserved-handles";

const feedInput = z.object({
  tab: z.enum(["for-you", "following"]).default("for-you"),
  cursor: jqFeedCursorSchema,
  limit: z.number().int().min(1).max(50).default(20),
});

const createPublicationSchema = jqCreatePublicationInputSchema;

const paginatedInput = z.object({
  cursor: jqCursorSchema,
  limit: z.number().int().min(1).max(50).default(20),
});

export const redeTesteRouter = router({
  me: tenantProcedure.query(async ({ ctx }) => {
    const profile = await ensureRedeTesteProfile(
      ctx.prisma,
      ctx.user.id,
      ctx.tenantId,
    );
    const oab = await syncRedeTesteOab(ctx.prisma, ctx.user.id, ctx.tenantId);
    const refreshed = await ctx.prisma.redeTesteProfile.findUniqueOrThrow({
      where: { userId: ctx.user.id },
    });
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: { name: true, image: true, email: true, oabNumber: true, oabUf: true },
    });
    const jqSettings = parseJqProfileSettings(refreshed.settings);
    const referralsFromMyLink = await ctx.prisma.redeTesteReferral.count({
      where: { tenantId: ctx.tenantId, referrerUserId: ctx.user.id },
    });
    return {
      ...refreshed,
      image: user?.image ?? null,
      email: user?.email ?? "",
      oabNumber: oab.oabNumber ?? user?.oabNumber ?? null,
      oabUf: oab.oabUf ?? user?.oabUf ?? null,
      tenantRole: ctx.dbUser.tenantRole,
      isOwner: ctx.dbUser.tenantRole === "OWNER",
      assistantUrl: jqSettings.assistantUrl ?? null,
      assistantNotebookName: jqSettings.assistantNotebookName ?? null,
      referralsFromMyLink,
      oabRegistryVerified: isOabRegistryVerified(),
      composerFeatures: getJqComposerFeatures(ctx.tenant.plan),
    };
  }),

  composerCapabilities: tenantProcedure.query(({ ctx }) => ({
    ...getJqComposerFeatures(ctx.tenant.plan),
    plan: ctx.tenant.plan,
  })),

  searchCourts: tenantProcedure
    .input(z.object({ q: z.string().max(80).default(""), limit: z.number().int().min(1).max(30).default(15) }))
    .query(async ({ ctx, input }) => {
      const q = input.q.trim();
      const courts = await ctx.prisma.court.findMany({
        where: {
          active: true,
          ...(q
            ? {
                OR: [
                  { code: { contains: q, mode: "insensitive" } },
                  { name: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: [{ code: "asc" }],
        take: input.limit,
        select: { id: true, code: true, name: true, jurisdiction: true, state: true },
      });
      return { courts };
    }),

  listDrafts: tenantProcedure
    .input(z.object({ limit: z.number().int().min(1).max(10).default(10) }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await ctx.prisma.redeTestePublication.findMany({
        where: { authorId: ctx.user.id, status: "DRAFT", deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 10,
        select: {
          id: true,
          content: true,
          practiceArea: true,
          createdAt: true,
          court: { select: { code: true, name: true } },
        },
      });
      return { drafts: rows };
    }),

  deleteDraft: tenantProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.prisma.redeTestePublication.findFirst({
        where: { id: input.id, authorId: ctx.user.id, status: "DRAFT", deletedAt: null },
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Rascunho não encontrado" });
      await ctx.prisma.redeTestePublication.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
      return { ok: true };
    }),

  listScheduledPublications: tenantProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.redeTestePublication.findMany({
      where: {
        authorId: ctx.user.id,
        status: "SCHEDULED",
        deletedAt: null,
        OR: [{ threadPosition: null }, { threadPosition: 0 }],
      },
      orderBy: { scheduledAt: "asc" },
      include: jqPublicationInclude,
    });
    return mapJqPublications(ctx.prisma, rows, ctx.user.id);
  }),

  cancelScheduledPublication: tenantProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.prisma.redeTestePublication.findFirst({
        where: {
          id: input.id,
          authorId: ctx.user.id,
          status: "SCHEDULED",
          deletedAt: null,
        },
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Publicação agendada não encontrada" });
      await ctx.prisma.redeTestePublication.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
      return { ok: true };
    }),

  trendingCourts: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(10).default(5) }).optional())
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const grouped = await ctx.prisma.redeTestePublication.groupBy({
        by: ["courtId"],
        where: {
          courtId: { not: null },
          status: "PUBLISHED",
          deletedAt: null,
          createdAt: { gte: since },
        },
        _count: { _all: true },
        take: input?.limit ?? 5,
      });
      grouped.sort((a, b) => b._count._all - a._count._all);
      const courtIds = grouped.map((g) => g.courtId!).filter(Boolean);
      const courts = await ctx.prisma.court.findMany({
        where: { id: { in: courtIds } },
        select: { id: true, code: true, name: true },
      });
      const byId = new Map(courts.map((c) => [c.id, c]));
      return {
        courts: grouped
          .map((g) => {
            const c = byId.get(g.courtId!);
            if (!c) return null;
            return { ...c, publicationsCount: g._count._all };
          })
          .filter(Boolean),
      };
    }),

  feed: tenantProcedure.input(feedInput).query(async ({ ctx, input }) => {
    const [, followingRows, blockedIds] = await Promise.all([
      ensureRedeTesteProfile(ctx.prisma, ctx.user.id, ctx.tenantId),
      input.tab === "following"
        ? ctx.prisma.redeTesteFollow.findMany({
            where: { followerId: ctx.user.id },
            select: { followingId: true },
          })
        : Promise.resolve([] as { followingId: string }[]),
      getJqBlockedUserIds(ctx.prisma, ctx.user.id),
    ]);

    const followingIds = followingRows.map((f) => f.followingId);

    if (input.tab === "following" && followingIds.length === 0) {
      return { items: [], nextCursor: null as { id: string; createdAt: Date } | null };
    }
    const blockedSet = new Set(blockedIds);

    const authorFilter =
      input.tab === "following"
        ? { in: followingIds.filter((id) => !blockedSet.has(id)) }
        : blockedIds.length > 0
          ? { notIn: blockedIds }
          : undefined;

    if (input.tab === "for-you") {
      const rankCursor =
        input.cursor?.kind === "rank"
          ? {
              finalScore: input.cursor.finalScore,
              createdAt: input.cursor.createdAt,
              id: input.cursor.id,
            }
          : undefined;
      const { rows, nextCursor } = await fetchRankedFeedPublications(ctx.prisma, {
        viewerId: ctx.user.id,
        viewerTenantId: ctx.tenantId,
        authorFilter,
        rankCursor,
        limit: input.limit,
      });
      const items = await mapJqPublications(ctx.prisma, rows, ctx.user.id);
      const next =
        nextCursor === null
          ? null
          : ({ kind: "rank" as const, ...nextCursor });
      return { items, nextCursor: next };
    }

    const chronoCursor =
      input.cursor?.kind === "chrono"
        ? { id: input.cursor.id, createdAt: input.cursor.createdAt }
        : undefined;

    const where = jqGlobalFeedWhere(
      ctx.user.id,
      {
        ...(authorFilter ? { authorId: authorFilter } : {}),
        ...jqCursorWhere(chronoCursor),
      },
      ctx.tenantId,
    );

    const rows = await ctx.prisma.redeTestePublication.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      include: jqPublicationInclude,
    });

    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    const items = await mapJqPublications(ctx.prisma, page, ctx.user.id);
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? { kind: "chrono" as const, id: last.id, createdAt: last.createdAt }
        : null;

    return { items, nextCursor };
  }),

  getPublication: publicProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const viewerId = ctx.user?.id ?? null;
      const row = await ctx.prisma.redeTestePublication.findFirst({
        where: jqPublicReadWhere(viewerId, { id: input.id }, ctx.tenantId),
        include: jqPublicationInclude,
      });
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Publicação não encontrada" });
      }
      const [item] = await mapJqPublications(ctx.prisma, [row], viewerId);
      const quotesCount = await ctx.prisma.redeTestePublication.count({
        where: { quotedId: input.id, deletedAt: null, isConfidential: false },
      });

      let threadParts: typeof item[] = [];
      if (row.threadId) {
        const parts = await ctx.prisma.redeTestePublication.findMany({
          where: {
            threadId: row.threadId,
            deletedAt: null,
            status: "PUBLISHED",
          },
          orderBy: { threadPosition: "asc" },
          include: jqPublicationInclude,
        });
        threadParts = await mapJqPublications(ctx.prisma, parts, viewerId);
      }

      return { ...item, quotesCount, threadParts };
    }),

  replies: tenantProcedure
    .input(
      paginatedInput.extend({
        parentId: z.string().cuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const parent = await ctx.prisma.redeTestePublication.findFirst({
        where: jqPublicationVisibleWhere(ctx.user.id, { id: input.parentId }, ctx.tenantId),
      });
      if (!parent) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const where = jqRepliesWhere(input.parentId, jqCursorWhere(input.cursor));

      const rows = await ctx.prisma.redeTestePublication.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: input.limit + 1,
        include: jqPublicationInclude,
      });

      const hasMore = rows.length > input.limit;
      const page = hasMore ? rows.slice(0, input.limit) : rows;
      const items = await mapJqPublications(ctx.prisma, page, ctx.user.id);
      const last = page[page.length - 1];
      const nextCursor =
        hasMore && last ? { id: last.id, createdAt: last.createdAt } : null;

      return { items, nextCursor };
    }),

  /** Último comentário do próprio usuário num post (mostrado abaixo do post no feed). */
  myLastReply: tenantProcedure
    .input(z.object({ publicationId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const reply = await ctx.prisma.redeTestePublication.findFirst({
        where: {
          parentId: input.publicationId,
          authorId: ctx.user.id,
          deletedAt: null,
          status: "PUBLISHED",
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          createdAt: true,
          media: { select: { url: true, type: true }, orderBy: { order: "asc" } },
        },
      });
      return reply;
    }),

  profileByHandle: publicProcedure
    .input(z.object({ handle: z.string().min(1).max(40) }))
    .query(async ({ ctx, input }) => {
      const handle = normalizeJqHandle(input.handle);
      if (isReservedJqHandle(handle)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Perfil não encontrado" });
      }

      const profile = await ctx.prisma.redeTesteProfile.findFirst({
        where: { handle },
        include: {
          user: {
            select: {
              id: true,
              image: true,
              tenant: { select: { name: true } },
              oabNumber: true,
              oabUf: true,
            },
          },
        },
      });

      if (!profile) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Perfil não encontrado" });
      }

      const viewerId = ctx.user?.id ?? null;
      const following =
        viewerId &&
        (await ctx.prisma.redeTesteFollow.findUnique({
          where: {
            followerId_followingId: {
              followerId: viewerId,
              followingId: profile.userId,
            },
          },
        }));

      const viewerMuted =
        viewerId &&
        !!(await ctx.prisma.redeTesteProfileMute.findUnique({
          where: {
            muterId_mutedId: { muterId: viewerId, mutedId: profile.userId },
          },
        }));

      const metrics = await ctx.prisma.redeTestePublication.aggregate({
        where: { authorId: profile.userId, deletedAt: null },
        _sum: { viewsCount: true, bookmarksCount: true },
      });

      return {
        userId: profile.userId,
        handle: profile.handle,
        displayName: profile.displayName,
        bio: profile.bio,
        bannerUrl: profile.bannerUrl,
        website: profile.website,
        lawFirm: profile.lawFirm,
        professionalKind: profile.professionalKind,
        location: profile.location,
        practiceAreas: profile.practiceAreas,
        createdAt: profile.createdAt,
        oabVerified: profile.oabVerified,
        oabRegistryVerified: isOabRegistryVerified(),
        verificationType: profile.verificationType,
        followersCount: profile.followersCount,
        followingCount: profile.followingCount,
        publicationsCount: profile.publicationsCount,
        totalViews: metrics._sum.viewsCount ?? 0,
        totalBookmarks: metrics._sum.bookmarksCount ?? 0,
        image: profile.user.image,
        oabNumber: profile.user.oabNumber,
        oabUf: profile.user.oabUf,
        workspaceName: profile.user.tenant?.name ?? null,
        birthDate:
          profile.userId === viewerId || profile.birthDateYearVisibility === "PUBLIC"
            ? profile.birthDate
            : null,
        isSelf: profile.userId === viewerId,
        viewerFollowing: !!following,
        viewerMuted: !!viewerMuted,
      };
    }),

  userPublications: publicProcedure
    .input(
      paginatedInput.extend({
        handle: z.string().min(1).max(40),
      }),
    )
    .query(async ({ ctx, input }) => {
      const viewerId = ctx.user?.id ?? null;
      const handle = normalizeJqHandle(input.handle);
      const profile = await ctx.prisma.redeTesteProfile.findFirst({
        where: { handle },
      });
      if (!profile) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const cursorDate = input.cursor?.createdAt
        ? new Date(input.cursor.createdAt)
        : null;
      const beforeCursor = cursorDate ? { lt: cursorDate } : undefined;

      // Publicações próprias.
      const ownRows = await ctx.prisma.redeTestePublication.findMany({
        where: jqPublicReadWhere(
          viewerId,
          {
            authorId: profile.userId,
            parentId: null,
            ...(beforeCursor ? { createdAt: beforeCursor } : {}),
          },
          ctx.tenantId,
        ),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
        include: jqPublicationInclude,
      });

      // Republicações feitas por este perfil.
      const repostRows = await ctx.prisma.redeTesteRepost.findMany({
        where: {
          userId: profile.userId,
          ...(beforeCursor ? { createdAt: beforeCursor } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        select: { createdAt: true, publicationId: true },
      });

      // Carrega as publicações republicadas (respeitando visibilidade).
      const repostPubIds = repostRows.map((r) => r.publicationId);
      const repostPubs = repostPubIds.length
        ? await ctx.prisma.redeTestePublication.findMany({
            where: jqPublicReadWhere(
              viewerId,
              { id: { in: repostPubIds } },
              ctx.tenantId,
            ),
            include: jqPublicationInclude,
          })
        : [];
      const repostPubById = new Map(repostPubs.map((p) => [p.id, p]));

      type Entry = {
        sortAt: Date;
        row: (typeof ownRows)[number];
        repostedBy?: { name: string; handle: string };
      };
      const entries: Entry[] = [
        ...ownRows.map((row) => ({ sortAt: row.createdAt, row })),
        ...repostRows.flatMap((r) => {
          const row = repostPubById.get(r.publicationId);
          if (!row || row.authorId === profile.userId) return [];
          return [
            {
              sortAt: r.createdAt,
              row,
              repostedBy: {
                name: profile.displayName,
                handle: profile.handle,
              },
            },
          ];
        }),
      ];
      entries.sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime());

      const hasMore = entries.length > input.limit;
      const pageEntries = hasMore ? entries.slice(0, input.limit) : entries;
      const mapped = await mapJqPublications(
        ctx.prisma,
        pageEntries.map((e) => e.row),
        viewerId,
      );
      const items = mapped.map((item, i) => {
        const rb = pageEntries[i]?.repostedBy;
        return rb ? { ...item, repostedBy: rb } : item;
      });
      const lastEntry = pageEntries[pageEntries.length - 1];
      const nextCursor =
        hasMore && lastEntry
          ? { id: lastEntry.row.id, createdAt: lastEntry.sortAt }
          : null;

      return { items, nextCursor };
    }),

  profileAbout: publicProcedure
    .input(z.object({ handle: z.string().min(1).max(40) }))
    .query(async ({ ctx, input }) => {
      const handle = normalizeJqHandle(input.handle);
      const profile = await ctx.prisma.redeTesteProfile.findFirst({
        where: { handle },
        select: {
          handle: true,
          displayName: true,
          createdAt: true,
          oabVerified: true,
          location: true,
          user: { select: { image: true } },
        },
      });
      if (!profile) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return profile;
    }),

  userReplies: publicProcedure
    .input(paginatedInput.extend({ handle: z.string().min(1).max(40) }))
    .query(async ({ ctx, input }) => {
      const viewerId = ctx.user?.id ?? null;
      const handle = normalizeJqHandle(input.handle);
      const profile = await ctx.prisma.redeTesteProfile.findFirst({
        where: { handle },
      });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });

      const where = jqPublicReadWhere(
        viewerId,
        {
          authorId: profile.userId,
          parentId: { not: null },
          ...jqCursorWhere(input.cursor),
        },
        ctx.tenantId,
      );

      const rows = await ctx.prisma.redeTestePublication.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
        include: {
          ...jqPublicationInclude,
          parent: { include: jqPublicationInclude },
        },
      });

      const hasMore = rows.length > input.limit;
      const page = hasMore ? rows.slice(0, input.limit) : rows;
      const items = await mapJqPublications(ctx.prisma, page, viewerId);
      const last = page[page.length - 1];
      const nextCursor =
        hasMore && last ? { id: last.id, createdAt: last.createdAt } : null;

      return { items, nextCursor };
    }),

  userMedia: publicProcedure
    .input(paginatedInput.extend({ handle: z.string().min(1).max(40) }))
    .query(async ({ ctx, input }) => {
      const viewerId = ctx.user?.id ?? null;
      const handle = normalizeJqHandle(input.handle);
      const profile = await ctx.prisma.redeTesteProfile.findFirst({
        where: { handle },
      });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });

      const where = jqPublicReadWhere(
        viewerId,
        {
          authorId: profile.userId,
          parentId: null,
          media: { some: {} },
          ...jqCursorWhere(input.cursor),
        },
        ctx.tenantId,
      );

      const rows = await ctx.prisma.redeTestePublication.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
        include: jqPublicationInclude,
      });

      const hasMore = rows.length > input.limit;
      const page = hasMore ? rows.slice(0, input.limit) : rows;
      const items = await mapJqPublications(ctx.prisma, page, viewerId);
      const last = page[page.length - 1];
      const nextCursor =
        hasMore && last ? { id: last.id, createdAt: last.createdAt } : null;

      return { items, nextCursor };
    }),

  userLikedPublications: tenantProcedure
    .input(paginatedInput.extend({ handle: z.string().min(1).max(40) }))
    .query(async ({ ctx, input }) => {
      const handle = normalizeJqHandle(input.handle);
      const profile = await ctx.prisma.redeTesteProfile.findFirst({
        where: { handle },
      });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });
      if (profile.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Só você pode ver suas curtidas",
        });
      }

      const likes = await ctx.prisma.redeTesteLike.findMany({
        where: {
          userId: ctx.user.id,
          ...(input.cursor
            ? {
                OR: [
                  { createdAt: { lt: input.cursor.createdAt } },
                  {
                    createdAt: input.cursor.createdAt,
                    publicationId: { lt: input.cursor.id },
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: "desc" }, { publicationId: "desc" }],
        take: input.limit + 1,
        select: { publicationId: true, createdAt: true },
      });

      const hasMore = likes.length > input.limit;
      const pageLikes = hasMore ? likes.slice(0, input.limit) : likes;
      const pubIds = pageLikes.map((l) => l.publicationId);

      const rows = await ctx.prisma.redeTestePublication.findMany({
        where: { id: { in: pubIds }, deletedAt: null },
        include: jqPublicationInclude,
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      const ordered = pubIds
        .map((id) => byId.get(id))
        .filter((r): r is NonNullable<typeof r> => !!r);

      const items = await mapJqPublications(ctx.prisma, ordered, ctx.user.id);
      const last = pageLikes[pageLikes.length - 1];
      const nextCursor =
        hasMore && last
          ? { id: last.publicationId, createdAt: last.createdAt }
          : null;

      return { items, nextCursor };
    }),

  userHighlights: publicProcedure
    .input(paginatedInput.extend({ handle: z.string().min(1).max(40) }))
    .query(async ({ ctx, input }) => {
      const viewerId = ctx.user?.id ?? null;
      const handle = normalizeJqHandle(input.handle);
      const profile = await ctx.prisma.redeTesteProfile.findFirst({
        where: { handle },
      });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });

      const where = jqPublicReadWhere(
        viewerId,
        {
          authorId: profile.userId,
          parentId: null,
          isHighlighted: true,
          ...jqCursorWhere(input.cursor),
        },
        ctx.tenantId,
      );

      const rows = await ctx.prisma.redeTestePublication.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
        include: jqPublicationInclude,
      });

      const hasMore = rows.length > input.limit;
      const page = hasMore ? rows.slice(0, input.limit) : rows;
      const items = await mapJqPublications(ctx.prisma, page, viewerId);
      const last = page[page.length - 1];
      const nextCursor =
        hasMore && last ? { id: last.id, createdAt: last.createdAt } : null;

      return { items, nextCursor };
    }),

  togglePublicationHighlight: tenantProcedure
    .input(z.object({ publicationId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const pub = await ctx.prisma.redeTestePublication.findFirst({
        where: {
          id: input.publicationId,
          authorId: ctx.user.id,
          deletedAt: null,
          parentId: null,
        },
      });
      if (!pub) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.prisma.redeTestePublication.update({
        where: { id: pub.id },
        data: { isHighlighted: !pub.isHighlighted },
      });
      return { isHighlighted: updated.isHighlighted };
    }),

  createPublication: tenantProcedure
    .input(createPublicationSchema)
    .mutation(async ({ ctx, input }) => {
      await ensureRedeTesteProfile(ctx.prisma, ctx.user.id, ctx.tenantId);

      if (!input.parentId && !input.saveAsDraft && !input.scheduledAt) {
        try {
          await assertJqPublicationRateLimit(ctx.prisma, ctx.user.id, ctx.tenantId);
        } catch (e) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: e instanceof Error ? e.message : "Limite de publicações",
          });
        }
      }

      if (input.parentId) {
        const parent = await ctx.prisma.redeTestePublication.findFirst({
          where: jqPublicationVisibleWhere(ctx.user.id, { id: input.parentId }, ctx.tenantId),
        });
        if (!parent) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Publicação não encontrada" });
        }
        if (input.externalGifUrl && !parent.allowGifReplies) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "O autor desativou respostas com GIF nesta publicação.",
          });
        }
      }

      if (input.communityId) {
        const member = await ctx.prisma.redeTesteCommunityMember.findUnique({
          where: {
            communityId_userId: {
              communityId: input.communityId,
              userId: ctx.user.id,
            },
          },
        });
        if (!member) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Entre na comunidade antes de publicar",
          });
        }
      }

      if (input.sourceIntimationId && !input.parentId) {
        const intimation = await ctx.prisma.intimation.findFirst({
          where: {
            id: input.sourceIntimationId,
            tenantId: ctx.tenantId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!intimation) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Intimação não encontrada" });
        }
      }

      if (input.courtId) {
        const court = await ctx.prisma.court.findFirst({
          where: { id: input.courtId, active: true },
        });
        if (!court) throw new TRPCError({ code: "BAD_REQUEST", message: "Tribunal inválido" });
      }

      const created = await createJqPublicationsFromInput(ctx.prisma, {
        tenantId: ctx.tenantId,
        userId: ctx.user.id,
        plan: ctx.tenant.plan,
      }, input);

      if (created.status === "PUBLISHED") {
        for (const id of created.ids) {
          await syncJqPublicationMeta(ctx.prisma, {
            tenantId: ctx.tenantId,
            publicationId: id,
            authorId: ctx.user.id,
            content: input.content,
            parentId: input.parentId,
          });
        }
      }

      const withMedia = await ctx.prisma.redeTestePublication.findUniqueOrThrow({
        where: { id: created.primaryId },
        include: jqPublicationInclude,
      });

      const pollData = await loadJqPollDto(ctx.prisma, created.primaryId, ctx.user.id);
      return mapJqPublication(
        withMedia,
        ctx.user.id,
        new Set(),
        new Set(),
        pollData.viewerOptionId,
        new Set(),
        pollData.poll,
      );
    }),

  updatePublication: tenantProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        content: z.string().min(1).max(560),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const pub = await ctx.prisma.redeTestePublication.findFirst({
        where: {
          id: input.id,
          authorId: ctx.user.id,
          deletedAt: null,
        },
      });
      if (!pub) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Publicação não encontrada" });
      }

      const updated = await ctx.prisma.redeTestePublication.update({
        where: { id: input.id },
        data: {
          content: input.content.trim(),
          isEdited: true,
          editedAt: new Date(),
        },
        include: jqPublicationInclude,
      });

      await syncJqPublicationMeta(ctx.prisma, {
        tenantId: ctx.tenantId,
        publicationId: updated.id,
        authorId: ctx.user.id,
        content: updated.content,
        parentId: updated.parentId,
      });

      return mapJqPublication(updated, ctx.user.id, new Set(), new Set());
    }),

  deletePublication: tenantProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const pub = await ctx.prisma.redeTestePublication.findFirst({
        where: {
          id: input.id,
          authorId: ctx.user.id,
          deletedAt: null,
        },
      });
      if (!pub) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Publicação não encontrada" });
      }

      await ctx.prisma.redeTestePublication.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });

      await audit({
        userId: ctx.user.id,
        tenantId: ctx.tenantId,
        action: "juridiques.publication.delete",
        entityType: "RedeTestePublication",
        entityId: input.id,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });

      return { ok: true };
    }),

  toggleLike: tenantProcedure
    .input(z.object({ publicationId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      assertJqRateLimit(ctx.user.id, "toggleLike", 120, 60_000);
      const pub = await ctx.prisma.redeTestePublication.findFirst({
        where: jqPublicationVisibleWhere(ctx.user.id, { id: input.publicationId }, ctx.tenantId),
      });
      if (!pub) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const existing = await ctx.prisma.redeTesteLike.findUnique({
        where: {
          userId_publicationId: {
            userId: ctx.user.id,
            publicationId: input.publicationId,
          },
        },
      });

      if (existing) {
        await ctx.prisma.$transaction([
          ctx.prisma.redeTesteLike.delete({
            where: {
              userId_publicationId: {
                userId: ctx.user.id,
                publicationId: input.publicationId,
              },
            },
          }),
          ctx.prisma.redeTestePublication.update({
            where: { id: input.publicationId },
            data: { likesCount: { decrement: 1 } },
          }),
        ]);
        return { liked: false, likesCount: Math.max(0, pub.likesCount - 1) };
      }

      await ctx.prisma.$transaction([
        ctx.prisma.redeTesteLike.create({
          data: {
            userId: ctx.user.id,
            publicationId: input.publicationId,
          },
        }),
        ctx.prisma.redeTestePublication.update({
          where: { id: input.publicationId },
          data: { likesCount: { increment: 1 } },
        }),
      ]);
      await createJqNotification(ctx.prisma, {
        tenantId: pub.tenantId,
        userId: pub.authorId,
        type: "LIKE",
        actorId: ctx.user.id,
        publicationId: input.publicationId,
      });
      return { liked: true, likesCount: pub.likesCount + 1 };
    }),

  toggleBookmark: tenantProcedure
    .input(z.object({ publicationId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      assertJqRateLimit(ctx.user.id, "toggleBookmark", 120, 60_000);
      const pub = await ctx.prisma.redeTestePublication.findFirst({
        where: jqPublicationVisibleWhere(ctx.user.id, { id: input.publicationId }, ctx.tenantId),
      });
      if (!pub) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const existing = await ctx.prisma.redeTesteBookmark.findUnique({
        where: {
          userId_publicationId: {
            userId: ctx.user.id,
            publicationId: input.publicationId,
          },
        },
      });

      if (existing) {
        await ctx.prisma.$transaction([
          ctx.prisma.redeTesteBookmark.delete({
            where: {
              userId_publicationId: {
                userId: ctx.user.id,
                publicationId: input.publicationId,
              },
            },
          }),
          ctx.prisma.redeTestePublication.update({
            where: { id: input.publicationId },
            data: { bookmarksCount: { decrement: 1 } },
          }),
        ]);
        return {
          bookmarked: false,
          bookmarksCount: Math.max(0, pub.bookmarksCount - 1),
        };
      }

      await ctx.prisma.$transaction([
        ctx.prisma.redeTesteBookmark.create({
          data: {
            userId: ctx.user.id,
            publicationId: input.publicationId,
          },
        }),
        ctx.prisma.redeTestePublication.update({
          where: { id: input.publicationId },
          data: { bookmarksCount: { increment: 1 } },
        }),
      ]);
      return { bookmarked: true, bookmarksCount: pub.bookmarksCount + 1 };
    }),

  listBookmarks: tenantProcedure.input(paginatedInput).query(async ({ ctx, input }) => {
    await ensureRedeTesteProfile(ctx.prisma, ctx.user.id, ctx.tenantId);

    const bookmarks = await ctx.prisma.redeTesteBookmark.findMany({
      where: {
        userId: ctx.user.id,
        ...(input.cursor
          ? {
              OR: [
                { createdAt: { lt: input.cursor.createdAt } },
                {
                  createdAt: input.cursor.createdAt,
                  publicationId: { lt: input.cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { publicationId: "desc" }],
      take: input.limit + 1,
      include: {
        publication: { include: jqPublicationInclude },
      },
    });

    const hasMore = bookmarks.length > input.limit;
    const page = hasMore ? bookmarks.slice(0, input.limit) : bookmarks;
    const rows = page
      .map((b) => b.publication)
      .filter((p) => p && p.deletedAt === null);
    const items = await mapJqPublications(ctx.prisma, rows, ctx.user.id);
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? { id: last.publicationId, createdAt: last.createdAt }
        : null;

    return { items, nextCursor };
  }),

  registerView: publicProcedure
    .input(
      z.object({
        publicationId: z.string().cuid(),
        sessionId: z.string().min(8).max(128).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const viewerId = ctx.user?.id ?? null;
      const pub = await ctx.prisma.redeTestePublication.findFirst({
        where: jqPublicReadWhere(viewerId, { id: input.publicationId }, ctx.tenantId),
      });
      if (!pub) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const sessionId =
        input.sessionId?.trim() ||
        ctx.headers.get("x-jq-session-id")?.trim() ||
        null;
      if (!viewerId && !sessionId) {
        return { counted: false, viewsCount: pub.viewsCount };
      }

      if (viewerId) {
        assertJqRateLimit(viewerId, "registerView", 200, 60_000);
      }

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dedupeWhere =
        viewerId && sessionId
          ? {
              OR: [
                { userId: viewerId },
                { sessionId, userId: null },
              ],
            }
          : viewerId
            ? { userId: viewerId }
            : { sessionId: sessionId!, userId: null };

      const existing = await ctx.prisma.redeTesteView.findFirst({
        where: {
          publicationId: input.publicationId,
          createdAt: { gte: since },
          ...dedupeWhere,
        },
        select: { id: true },
      });

      if (existing) {
        return { counted: false, viewsCount: pub.viewsCount };
      }

      const updated = await ctx.prisma.$transaction(async (tx) => {
        await tx.juridiquesView.create({
          data: {
            publicationId: input.publicationId,
            userId: viewerId,
            sessionId: viewerId ? null : sessionId,
          },
        });
        return tx.juridiquesPublication.update({
          where: { id: input.publicationId },
          data: { viewsCount: { increment: 1 } },
          select: { viewsCount: true },
        });
      });

      return { counted: true, viewsCount: updated.viewsCount };
    }),

  toggleRepost: tenantProcedure
    .input(z.object({ publicationId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      assertJqRateLimit(ctx.user.id, "toggleRepost", 60, 60_000);
      const pub = await ctx.prisma.redeTestePublication.findFirst({
        where: jqPublicationVisibleWhere(ctx.user.id, { id: input.publicationId }, ctx.tenantId),
      });
      if (!pub) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const existing = await ctx.prisma.redeTesteRepost.findUnique({
        where: {
          userId_publicationId: {
            userId: ctx.user.id,
            publicationId: input.publicationId,
          },
        },
      });

      if (existing) {
        await ctx.prisma.$transaction([
          ctx.prisma.redeTesteRepost.delete({
            where: {
              userId_publicationId: {
                userId: ctx.user.id,
                publicationId: input.publicationId,
              },
            },
          }),
          ctx.prisma.redeTestePublication.update({
            where: { id: input.publicationId },
            data: { repostsCount: { decrement: 1 } },
          }),
        ]);
        return { reposted: false, repostsCount: Math.max(0, pub.repostsCount - 1) };
      }

      await ctx.prisma.$transaction([
        ctx.prisma.redeTesteRepost.create({
          data: {
            userId: ctx.user.id,
            publicationId: input.publicationId,
          },
        }),
        ctx.prisma.redeTestePublication.update({
          where: { id: input.publicationId },
          data: { repostsCount: { increment: 1 } },
        }),
      ]);
      return { reposted: true, repostsCount: pub.repostsCount + 1 };
    }),

  suggestions: tenantProcedure.query(async ({ ctx }) => {
    await ensureRedeTesteProfile(ctx.prisma, ctx.user.id, ctx.tenantId);
    const blockedIds = await getJqBlockedUserIds(ctx.prisma, ctx.user.id);

    const recs = await getJurisConnectRecommendations(ctx.prisma, {
      viewerId: ctx.user.id,
      blockedIds,
      limit: 5,
      useCache: true,
    });

    const following = await ctx.prisma.redeTesteFollow.findMany({
      where: { followerId: ctx.user.id },
      select: { followingId: true },
    });
    const followingSet = new Set(following.map((f) => f.followingId));

    return recs.map((r) => ({
      userId: r.userId,
      handle: r.handle,
      displayName: r.displayName,
      bio: r.bio,
      image: r.image,
      oabVerified: r.oabVerified,
      verificationType: r.verificationType,
      reason: r.reason,
      following: followingSet.has(r.userId),
    }));
  }),

  buildIntimationShare: requirePermission("intimations.read")
    .input(z.object({ intimationId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const i = await ctx.prisma.intimation.findFirst({
        where: {
          id: input.intimationId,
          tenantId: ctx.tenantId,
          deletedAt: null,
        },
        include: {
          case: {
            select: {
              cnjNumber: true,
              opposingParty: true,
              client: { select: { name: true } },
            },
          },
          court: { select: { code: true } },
        },
      });
      if (!i) throw new TRPCError({ code: "NOT_FOUND" });
      const origin =
        process.env.BETTER_AUTH_URL ??
        process.env.NEXT_PUBLIC_APP_URL ??
        "https://portal.com";
      return {
        content: buildIntimationShareContent(
          {
            id: i.id,
            summary: i.summary,
            rawContent: i.rawContent,
            cnjNumber: i.cnjNumber,
            tribunalCode: i.tribunalCode,
            courtCode: i.court?.code ?? null,
            caseCnj: i.case?.cnjNumber ?? null,
            poloAtivo: i.poloAtivo,
            poloPassivo: i.poloPassivo,
            caseParties: i.case
              ? {
                  clientName: i.case.client.name,
                  opposingParty: i.case.opposingParty,
                }
              : null,
          },
          origin.replace(/\/$/, ""),
        ),
        intimationId: i.id,
      };
    }),

  votePoll: tenantProcedure
    .input(
      z.object({
        publicationId: z.string().cuid(),
        // Opções são criadas com randomUUID(); aceitar uuid e cuid.
        optionId: z.string().min(1).max(64),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { voteJqPoll } = await import("@/lib/rede-teste/poll-actions");
      return voteJqPoll(
        ctx.prisma,
        ctx.user.id,
        input.publicationId,
        input.optionId,
      );
    }),

  pollResults: tenantProcedure
    .input(z.object({ publicationId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const { getJqPollResults } = await import("@/lib/rede-teste/poll-actions");
      return getJqPollResults(ctx.prisma, ctx.user.id, input.publicationId);
    }),

  notificationPreferences: tenantProcedure.query(async ({ ctx }) => {
    const { getJqNotificationPrefs } = await import("@/lib/rede-teste/notification-prefs");
    return getJqNotificationPrefs(ctx.prisma, ctx.user.id);
  }),

  updateNotificationPreferences: tenantProcedure
    .input(
      z.object({
        likesInApp: z.boolean().optional(),
        likesEmail: z.boolean().optional(),
        likesPush: z.boolean().optional(),
        commentsInApp: z.boolean().optional(),
        commentsEmail: z.boolean().optional(),
        commentsPush: z.boolean().optional(),
        mentionsInApp: z.boolean().optional(),
        mentionsEmail: z.boolean().optional(),
        mentionsPush: z.boolean().optional(),
        followersInApp: z.boolean().optional(),
        followersEmail: z.boolean().optional(),
        followersPush: z.boolean().optional(),
        repostsInApp: z.boolean().optional(),
        repostsEmail: z.boolean().optional(),
        repostsPush: z.boolean().optional(),
        weeklyDigestEmail: z.boolean().optional(),
        marketingOptOut: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { DEFAULT_JQ_NOTIF_PREFS } = await import("@/lib/rede-teste/notification-prefs");
      return ctx.prisma.redeTesteNotificationPreference.upsert({
        where: { userId: ctx.user.id },
        create: { userId: ctx.user.id, ...DEFAULT_JQ_NOTIF_PREFS, ...input },
        update: input,
      });
    }),

  registerPushSubscription: tenantProcedure
    .input(
      z.object({
        endpoint: z.string().url().max(2000),
        keys: z.object({
          p256dh: z.string().min(1),
          auth: z.string().min(1),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.redeTestePushSubscription.upsert({
        where: {
          userId_endpoint: {
            userId: ctx.user.id,
            endpoint: input.endpoint,
          },
        },
        create: {
          userId: ctx.user.id,
          endpoint: input.endpoint,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
        },
        update: {
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
        },
      });
      return { ok: true };
    }),

  unregisterPushSubscription: tenantProcedure
    .input(z.object({ endpoint: z.string().url().max(2000) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.redeTestePushSubscription.deleteMany({
        where: { userId: ctx.user.id, endpoint: input.endpoint },
      });
      return { ok: true };
    }),

  pushVapidPublicKey: tenantProcedure.query(async () => {
    const { getVapidPublicKey } = await import("@/lib/rede-teste/web-push");
    return { publicKey: getVapidPublicKey() };
  }),

  toggleFollow: tenantProcedure
    .input(
      z.object({
        userId: jqUserIdSchema.optional(),
        handle: z.string().max(40).optional(),
        refHandle: z.string().max(40).optional(),
      }).refine((d) => !!d.userId || !!d.handle, {
        message: "Informe userId ou handle",
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertJqRateLimit(ctx.user.id, "toggleFollow", 60, 60_000);
      const targetUserId = input.userId
        ? input.userId
        : (() => {
            const h = normalizeJqHandle(input.handle ?? "");
            return h;
          })();

      const resolvedUserId =
        input.userId ??
        (await (async () => {
          const h = normalizeJqHandle(input.handle ?? "");
          const p = await ctx.prisma.redeTesteProfile.findFirst({
            where: { handle: h },
            select: { userId: true },
          });
          return p?.userId ?? null;
        })());

      if (!resolvedUserId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Perfil não encontrado" });
      }

      if (resolvedUserId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível seguir a si mesmo" });
      }

      const target = await ctx.prisma.redeTesteProfile.findUnique({
        where: { userId: resolvedUserId },
      });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Perfil Rede Teste não encontrado" });
      }

      const existing = await ctx.prisma.redeTesteFollow.findUnique({
        where: {
          followerId_followingId: {
            followerId: ctx.user.id,
            followingId: resolvedUserId,
          },
        },
      });

      if (existing) {
        await ctx.prisma.$transaction([
          ctx.prisma.redeTesteFollow.delete({
            where: {
              followerId_followingId: {
                followerId: ctx.user.id,
                followingId: resolvedUserId,
              },
            },
          }),
          ctx.prisma.redeTesteProfile.update({
            where: { userId: ctx.user.id },
            data: { followingCount: { decrement: 1 } },
          }),
          ctx.prisma.redeTesteProfile.update({
            where: { userId: resolvedUserId },
            data: { followersCount: { decrement: 1 } },
          }),
        ]);
        return { following: false };
      }

      await ctx.prisma.$transaction([
        ctx.prisma.redeTesteFollow.create({
          data: { followerId: ctx.user.id, followingId: resolvedUserId },
        }),
        ctx.prisma.redeTesteProfile.update({
          where: { userId: ctx.user.id },
          data: { followingCount: { increment: 1 } },
        }),
        ctx.prisma.redeTesteProfile.update({
          where: { userId: resolvedUserId },
          data: { followersCount: { increment: 1 } },
        }),
      ]);
      await createJqNotification(ctx.prisma, {
        tenantId: target.tenantId,
        userId: resolvedUserId,
        type: "FOLLOW",
        actorId: ctx.user.id,
      });

      if (input.refHandle?.trim()) {
        await tryRecordJqReferral(ctx.prisma, {
          tenantId: ctx.tenantId,
          referredUserId: ctx.user.id,
          refHandle: input.refHandle.trim(),
          source: "profile_follow",
        });
      }

      return { following: true };
    }),

  /** Profissionais na plataforma com perfil Rede Teste (rede aberta). */
  discoverPeople: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.user?.id && ctx.tenantId) {
        await ensureRedeTesteProfile(ctx.prisma, ctx.user.id, ctx.tenantId);
      }
      const take = input?.limit ?? 30;

      const profiles = await ctx.prisma.redeTesteProfile.findMany({
        where: ctx.user?.id ? { userId: { not: ctx.user.id } } : {},
        take,
        orderBy: [{ followersCount: "desc" }, { publicationsCount: "desc" }],
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      });

      const followingSet =
        ctx.user?.id && profiles.length > 0
          ? new Set(
              (
                await ctx.prisma.redeTesteFollow.findMany({
                  where: {
                    followerId: ctx.user.id,
                    followingId: { in: profiles.map((p) => p.userId) },
                  },
                  select: { followingId: true },
                })
              ).map((f) => f.followingId),
            )
          : new Set<string>();

      return {
        people: profiles.map((p) => ({
          userId: p.userId,
          handle: p.handle,
          displayName: p.displayName ?? p.user.name,
          image: p.user.image,
          oabVerified: p.oabVerified,
          viewerFollowing: followingSet.has(p.userId),
        })),
      };
    }),

  search: publicProcedure
    .input(
      z.object({
        q: z.string().max(100).default(""),
        type: z.enum(["top", "people", "hashtags"]).default("top"),
        limit: z.number().int().min(1).max(30).default(20),
        court: z.string().max(20).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const viewerId = ctx.user?.id ?? null;
      if (viewerId) {
        assertJqRateLimit(viewerId, "search", 40, 60_000);
      }
      const q = input.q.trim();
      if (!q && !input.court) {
        return { people: [], publications: [], hashtags: [] };
      }
      const qLower = q.toLowerCase().replace(/^#/, "").replace(/^@/, "");
      const wantsPeople = input.type === "people" || q.startsWith("@");

      if (wantsPeople) {
        const users = await ctx.prisma.user.findMany({
          where: {
            active: true,
            deletedAt: null,
            ...(viewerId ? { id: { not: viewerId } } : {}),
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: qLower, mode: "insensitive" } },
              {
                juridiquesProfile: {
                  is: {
                    OR: [
                      { handle: { contains: qLower, mode: "insensitive" } },
                      { displayName: { contains: q, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          },
          take: input.limit,
          select: {
            id: true,
            name: true,
            image: true,
            juridiquesProfile: {
              select: { handle: true, displayName: true, oabVerified: true },
            },
          },
        });

        const people = [];
        for (const u of users) {
          let profile = u.juridiquesProfile;
          if (!profile) {
            const peer = await ctx.prisma.user.findUnique({
              where: { id: u.id },
              select: { tenantId: true },
            });
            if (!peer?.tenantId) continue;
            const created = await ensureRedeTesteProfile(ctx.prisma, u.id, peer.tenantId);
            profile = {
              handle: created.handle,
              displayName: created.displayName,
              oabVerified: created.oabVerified,
            };
          }
          people.push({
            userId: u.id,
            handle: profile.handle,
            displayName: profile.displayName ?? u.name,
            image: u.image,
            oabVerified: profile.oabVerified,
            viewerFollowing: false,
          });
        }

        if (viewerId && people.length > 0) {
          const following = await ctx.prisma.redeTesteFollow.findMany({
            where: {
              followerId: viewerId,
              followingId: { in: people.map((p) => p.userId) },
            },
            select: { followingId: true },
          });
          const set = new Set(following.map((f) => f.followingId));
          for (const p of people) {
            p.viewerFollowing = set.has(p.userId);
          }
        }

        return { people, publications: [], hashtags: [] };
      }

      if (input.type === "hashtags" || q.startsWith("#")) {
        const hashtags = await ctx.prisma.redeTesteHashtag.findMany({
          where: { tag: { contains: qLower, mode: "insensitive" } },
          orderBy: { publicationsCount: "desc" },
          take: input.limit,
        });
        return { people: [], publications: [], hashtags };
      }

      const courtRow = input.court
        ? await ctx.prisma.court.findFirst({
            where: { code: input.court.toUpperCase() },
            select: { id: true },
          })
        : null;

      const pubFilters = {
        ...(q ? { content: { contains: q, mode: "insensitive" as const } } : {}),
        ...(courtRow ? { courtId: courtRow.id } : {}),
      };

      const publications = await ctx.prisma.redeTestePublication.findMany({
        where: viewerId
          ? jqGlobalFeedWhere(viewerId, pubFilters, ctx.tenantId)
          : jqPublicReadWhere(null, {
              parentId: null,
              status: "PUBLISHED",
              ...pubFilters,
            }),
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: jqPublicationInclude,
      });

      const items = await mapJqPublications(ctx.prisma, publications, viewerId);
      return { people: [], publications: items, hashtags: [] };
    }),

  trendingHashtags: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.redeTesteHashtag.findMany({
      orderBy: { publicationsCount: "desc" },
      take: 5,
    });
  }),

  unreadNotificationCount: tenantProcedure.query(async ({ ctx }) => {
    const count = await ctx.prisma.redeTesteNotification.count({
      where: { userId: ctx.user.id, readAt: null },
    });
    return { count };
  }),

  unreadDmCount: tenantProcedure.query(async ({ ctx }) => {
    const count = await countUnreadJqMessages(ctx.prisma, ctx.user.id);
    return { count };
  }),

  notifications: tenantProcedure
    .input(
      paginatedInput.extend({
        filter: z
          .enum(["all", "mentions", "likes", "followers"])
          .optional()
          .default("all"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const typeFilter =
        input.filter === "mentions"
          ? { type: "MENTION" as const }
          : input.filter === "likes"
            ? { type: "LIKE" as const }
            : input.filter === "followers"
              ? { type: { in: ["FOLLOW", "FOLLOW_REQUEST"] as const } }
              : {};

      const where = {
        userId: ctx.user.id,
        ...typeFilter,
        ...jqCursorWhere(input.cursor),
      };

      const rows = await ctx.prisma.redeTesteNotification.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
        include: {
          actor: {
            select: {
              id: true,
              image: true,
              name: true,
              juridiquesProfile: { select: { handle: true, displayName: true } },
            },
          },
          publication: { select: { id: true, content: true } },
        },
      });

      const hasMore = rows.length > input.limit;
      const page = hasMore ? rows.slice(0, input.limit) : rows;
      const last = page[page.length - 1];

      const flat = page.map((n) => ({
        id: n.id,
        type: n.type,
        readAt: n.readAt,
        createdAt: n.createdAt,
        publicationId: n.publicationId,
        publicationPreview: n.publication?.content.slice(0, 80) ?? null,
        actor: n.actor
          ? {
              id: n.actor.id,
              image: n.actor.image,
              name: n.actor.juridiquesProfile?.displayName ?? n.actor.name,
              handle:
                n.actor.juridiquesProfile?.handle ?? n.actor.id.slice(0, 8),
            }
          : null,
      }));

      const { groupJqNotifications } = await import(
        "@/lib/rede-teste/group-notifications"
      );

      return {
        items: groupJqNotifications(flat),
        nextCursor:
          hasMore && last ? { id: last.id, createdAt: last.createdAt } : null,
      };
    }),

  markNotificationsRead: tenantProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.redeTesteNotification.updateMany({
      where: { userId: ctx.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }),

  markNotificationRead: tenantProcedure
    .input(z.object({ ids: z.array(z.string().min(1)).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.redeTesteNotification.updateMany({
        where: {
          userId: ctx.user.id,
          id: { in: input.ids },
          readAt: null,
        },
        data: { readAt: new Date() },
      });
      return { ok: true };
    }),

  saveOnboardingStep: tenantProcedure
    .input(
      z.object({
        step: z.number().int().min(0).max(5),
        displayName: z.string().min(1).max(50).optional(),
        bio: z.string().max(160).optional().nullable(),
        image: z.string().url().optional().nullable(),
        userType: z.string().max(40).optional().nullable(),
        oabNumber: z.string().max(20).optional().nullable(),
        oabState: z.string().max(2).optional().nullable(),
        institution: z.string().max(120).optional().nullable(),
        location: z.string().max(30).optional().nullable(),
        interests: z.array(z.string().min(2).max(40)).max(8).optional(),
        followUserIds: z.array(z.string()).max(20).optional(),
        firstPostContent: z.string().max(560).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureRedeTesteProfile(ctx.prisma, ctx.user.id, ctx.tenantId);

      if (input.displayName) {
        await ctx.prisma.redeTesteProfile.update({
          where: { userId: ctx.user.id },
          data: {
            displayName: input.displayName,
            bio: input.bio ?? undefined,
            onboardingStep: input.step,
            onboardingUserType: input.userType ?? undefined,
            onboardingOabNumber: input.oabNumber ?? undefined,
            onboardingOabState: input.oabState ?? undefined,
            onboardingInstitution: input.institution ?? undefined,
            location: input.location ?? undefined,
            onboardingInterests: input.interests ?? undefined,
          },
        });
      } else {
        await ctx.prisma.redeTesteProfile.update({
          where: { userId: ctx.user.id },
          data: { onboardingStep: input.step },
        });
      }

      if (input.image) {
        await ctx.prisma.user.update({
          where: { id: ctx.user.id },
          data: { image: input.image },
        });
      }

      if (input.followUserIds?.length) {
        for (const targetId of input.followUserIds) {
          if (targetId === ctx.user.id) continue;
          const exists = await ctx.prisma.redeTesteFollow.findUnique({
            where: {
              followerId_followingId: {
                followerId: ctx.user.id,
                followingId: targetId,
              },
            },
          });
          if (exists) continue;
          await ctx.prisma.$transaction([
            ctx.prisma.redeTesteFollow.create({
              data: { followerId: ctx.user.id, followingId: targetId },
            }),
            ctx.prisma.redeTesteProfile.update({
              where: { userId: ctx.user.id },
              data: { followingCount: { increment: 1 } },
            }),
            ctx.prisma.redeTesteProfile.update({
              where: { userId: targetId },
              data: { followersCount: { increment: 1 } },
            }),
          ]);
        }
      }

      if (input.firstPostContent?.trim()) {
        await createJqPublicationsFromInput(
          ctx.prisma,
          { tenantId: ctx.tenantId, userId: ctx.user.id, plan: ctx.tenant.plan },
          { content: input.firstPostContent.trim() },
        );
      }

      return { ok: true, step: input.step };
    }),

  completeOnboarding: tenantProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.redeTesteProfile.update({
      where: { userId: ctx.user.id },
      data: { onboardingCompleted: true, onboardingStep: 5 },
    });
    const { sendJqWelcomeEmail } = await import("@/lib/rede-teste/jq-emails");
    await sendJqWelcomeEmail(
      ctx.prisma,
      ctx.user.id,
      ctx.user.email,
      ctx.user.name,
    );
    return { ok: true };
  }),

  completeTour: tenantProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.redeTesteProfile.update({
      where: { userId: ctx.user.id },
      data: { tourCompleted: true },
    });
    return { ok: true };
  }),

  onboardingSuggestions: tenantProcedure.query(async ({ ctx }) => {
    const profile = await ensureRedeTesteProfile(
      ctx.prisma,
      ctx.user.id,
      ctx.tenantId,
    );
    const interests = profile.onboardingInterests?.length
      ? profile.onboardingInterests
      : profile.practiceAreas;

    const where =
      interests.length > 0
        ? {
            userId: { not: ctx.user.id },
            onboardingInterests: { hasSome: interests },
          }
        : { userId: { not: ctx.user.id } };

    const rows = await ctx.prisma.redeTesteProfile.findMany({
      where,
      orderBy: { followersCount: "desc" },
      take: 10,
      select: {
        userId: true,
        handle: true,
        displayName: true,
        bio: true,
        followersCount: true,
        user: { select: { image: true } },
      },
    });

    return rows.map((r) => ({
      userId: r.userId,
      handle: r.handle,
      displayName: r.displayName,
      bio: r.bio,
      followersCount: r.followersCount,
      image: r.user.image,
    }));
  }),

  updateProfile: tenantProcedure
    .input(
      z.object({
        displayName: z.string().min(1).max(50).optional(),
        bio: z.string().max(160).optional().nullable(),
        location: z.string().max(30).optional().nullable(),
        website: z
          .string()
          .max(100)
          .optional()
          .nullable()
          .refine(
            (v) => !v || v === "" || /^https?:\/\/.+/i.test(v),
            "URL deve começar com http:// ou https://",
          ),
        lawFirm: z.string().max(80).optional().nullable(),
        bannerUrl: z.string().url().max(500).optional().nullable(),
        practiceAreas: z.array(z.string().min(2).max(40)).max(10).optional(),
        professionalKind: z.enum(JQ_PROFESSIONAL_KINDS).optional().nullable(),
        birthDate: z.coerce.date().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const current = await ensureRedeTesteProfile(
        ctx.prisma,
        ctx.user.id,
        ctx.tenantId,
      );

      const normalized = {
        ...input,
        website: input.website === "" ? null : input.website,
        bio: input.bio === "" ? null : input.bio,
        location: input.location === "" ? null : input.location,
        lawFirm: input.lawFirm === "" ? null : input.lawFirm,
      };

      const diff = computeProfileDiff(current, normalized);
      if (Object.keys(diff).length === 0) {
        return current;
      }

      const updated = await ctx.prisma.redeTesteProfile.update({
        where: { userId: ctx.user.id },
        data: diff,
      });

      await audit({
        userId: ctx.user.id,
        tenantId: ctx.tenantId,
        action: "juridiques.profile.update",
        entityType: "RedeTesteProfile",
        entityId: ctx.user.id,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: { fields: Object.keys(diff) },
      });

      return updated;
    }),

  listConnections: tenantProcedure
    .input(z.object({ tab: z.enum(["following", "followers"]) }))
    .query(async ({ ctx, input }) => {
      await ensureRedeTesteProfile(ctx.prisma, ctx.user.id, ctx.tenantId);

      if (input.tab === "following") {
        const rows = await ctx.prisma.redeTesteFollow.findMany({
          where: { followerId: ctx.user.id },
          orderBy: { createdAt: "desc" },
          include: {
            following: {
              select: {
                id: true,
                image: true,
                juridiquesProfile: {
                  select: {
                    handle: true,
                    displayName: true,
                    bio: true,
                    oabVerified: true,
                    verificationType: true,
                  },
                },
              },
            },
          },
        });
        return rows
          .filter((r) => r.following.juridiquesProfile)
          .map((r) => ({
            userId: r.followingId,
            handle: r.following.juridiquesProfile!.handle,
            displayName: r.following.juridiquesProfile!.displayName,
            bio: r.following.juridiquesProfile!.bio,
            image: r.following.image,
            oabVerified: r.following.juridiquesProfile!.oabVerified,
            verificationType: r.following.juridiquesProfile!.verificationType,
          }));
      }

      const rows = await ctx.prisma.redeTesteFollow.findMany({
        where: { followingId: ctx.user.id },
        orderBy: { createdAt: "desc" },
        include: {
          follower: {
            select: {
              id: true,
              image: true,
              juridiquesProfile: {
                select: {
                  handle: true,
                  displayName: true,
                  bio: true,
                  oabVerified: true,
                  verificationType: true,
                },
              },
            },
          },
        },
      });
      return rows
        .filter((r) => r.follower.juridiquesProfile)
        .map((r) => ({
          userId: r.followerId,
          handle: r.follower.juridiquesProfile!.handle,
          displayName: r.follower.juridiquesProfile!.displayName,
          bio: r.follower.juridiquesProfile!.bio,
          image: r.follower.image,
          oabVerified: r.follower.juridiquesProfile!.oabVerified,
          verificationType: r.follower.juridiquesProfile!.verificationType,
        }));
    }),

  reportPublication: tenantProcedure
    .input(
      z.object({
        publicationId: z.string().cuid(),
        reason: z.string().min(3).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertJqRateLimit(ctx.user.id, "reportPublication", 10, 300_000);
      const pub = await ctx.prisma.redeTestePublication.findFirst({
        where: jqPublicationVisibleWhere(ctx.user.id, { id: input.publicationId }, ctx.tenantId),
      });
      if (!pub) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await ctx.prisma.redeTesteReport.create({
        data: {
          tenantId: ctx.tenantId,
          reporterId: ctx.user.id,
          publicationId: input.publicationId,
          reason: input.reason.trim(),
        },
      });
      await audit({
        userId: ctx.user.id,
        tenantId: ctx.tenantId,
        action: "juridiques.publication.report",
        entityType: "RedeTestePublication",
        entityId: input.publicationId,
        metadata: { reason: input.reason.trim().slice(0, 200) },
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { ok: true };
    }),

  listConversations: tenantProcedure
    .input(
      z
        .object({
          folder: z.enum(["inbox", "archived"]).default("inbox"),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
    await ensureRedeTesteProfile(ctx.prisma, ctx.user.id, ctx.tenantId);
    const folder = input?.folder ?? "inbox";

    const memberships = await ctx.prisma.redeTesteConversationMember.findMany({
      where: {
        userId: ctx.user.id,
        deletedAt: null,
        ...(folder === "archived"
          ? { archivedAt: { not: null } }
          : { archivedAt: null }),
      },
      orderBy: { conversation: { updatedAt: "desc" } },
      include: {
        conversation: {
          include: {
            members: {
              where: { userId: { not: ctx.user.id } },
              include: {
                user: {
                  select: {
                    id: true,
                    image: true,
                    juridiquesProfile: {
                      select: { handle: true, displayName: true },
                    },
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    const peerIds = memberships
      .map((m) => m.conversation.members[0]?.userId)
      .filter((id): id is string => !!id);
    const followingRows = await ctx.prisma.redeTesteFollow.findMany({
      where: { followerId: ctx.user.id, followingId: { in: peerIds } },
      select: { followingId: true },
    });
    const followingSet = new Set(followingRows.map((f) => f.followingId));

    const unreadMap = await batchUnreadByConversation(
      ctx.prisma,
      ctx.user.id,
      memberships.map((m) => ({
        conversationId: m.conversationId,
        lastReadAt: m.lastReadAt,
      })),
    );

    const rows = memberships.map((m) => {
        const unreadCount = unreadMap.get(m.conversationId) ?? 0;
        const peer = m.conversation.members[0];
        const last = m.conversation.messages[0];
        const peerFollowing = peer ? followingSet.has(peer.userId) : false;
        return {
          id: m.conversationId,
          updatedAt: m.conversation.updatedAt,
          unreadCount,
          archivedAt: m.archivedAt,
          peer: peer
          ? {
              userId: peer.userId,
              handle: peer.user.juridiquesProfile?.handle ?? peer.userId.slice(0, 8),
              displayName:
                peer.user.juridiquesProfile?.displayName ?? "Usuário",
              image: peer.user.image,
              viewerFollowing: peerFollowing,
            }
          : null,
        lastMessage: last
          ? {
              body: last.body,
              createdAt: last.createdAt,
              isMine: last.senderId === ctx.user.id,
            }
          : null,
        };
      });
    return rows;
  }),

  archiveConversation: tenantProcedure
    .input(z.object({ conversationId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.redeTesteConversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: ctx.user.id,
          },
        },
      });
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.redeTesteConversationMember.update({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: ctx.user.id,
          },
        },
        data: { archivedAt: new Date(), deletedAt: null },
      });
      return { ok: true };
    }),

  unarchiveConversation: tenantProcedure
    .input(z.object({ conversationId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.redeTesteConversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: ctx.user.id,
          },
        },
      });
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.redeTesteConversationMember.update({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: ctx.user.id,
          },
        },
        data: { archivedAt: null },
      });
      return { ok: true };
    }),

  bulkArchiveConversations: tenantProcedure
    .input(z.object({ conversationIds: z.array(z.string().cuid()).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.redeTesteConversationMember.updateMany({
        where: {
          userId: ctx.user.id,
          conversationId: { in: input.conversationIds },
        },
        data: { archivedAt: new Date(), deletedAt: null },
      });
      return { ok: true, count: input.conversationIds.length };
    }),

  bulkDeleteConversations: tenantProcedure
    .input(z.object({ conversationIds: z.array(z.string().cuid()).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.redeTesteConversationMember.updateMany({
        where: {
          userId: ctx.user.id,
          conversationId: { in: input.conversationIds },
        },
        data: { deletedAt: new Date() },
      });
      return { ok: true, count: input.conversationIds.length };
    }),

  deleteConversation: tenantProcedure
    .input(z.object({ conversationId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.redeTesteConversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: ctx.user.id,
          },
        },
      });
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.redeTesteConversationMember.update({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: ctx.user.id,
          },
        },
        data: { deletedAt: new Date() },
      });
      return { ok: true };
    }),

  openConversation: tenantProcedure
    .input(z.object({ otherUserId: jqUserIdSchema }))
    .mutation(async ({ ctx, input }) => {
      if (input.otherUserId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Conversa consigo mesmo não permitida" });
      }

      await ensureRedeTesteProfile(ctx.prisma, ctx.user.id, ctx.tenantId);

      const peerUser = await ctx.prisma.user.findFirst({
        where: { id: input.otherUserId, active: true, deletedAt: null },
        select: { id: true, tenantId: true },
      });
      if (!peerUser?.tenantId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
      }
      await ensureRedeTesteProfile(ctx.prisma, peerUser.id, peerUser.tenantId);

      const existing = await ctx.prisma.redeTesteConversation.findFirst({
        where: {
          AND: [
            { members: { some: { userId: ctx.user.id } } },
            { members: { some: { userId: input.otherUserId } } },
          ],
        },
        include: { _count: { select: { members: true } } },
      });
      if (existing && existing._count.members === 2) {
        await ctx.prisma.redeTesteConversationMember.updateMany({
          where: {
            conversationId: existing.id,
            userId: ctx.user.id,
          },
          data: { deletedAt: null, archivedAt: null },
        });
        return { conversationId: existing.id };
      }

      const conv = await ctx.prisma.redeTesteConversation.create({
        data: {
          tenantId: ctx.tenantId,
          members: {
            create: [
              { userId: ctx.user.id, tenantId: ctx.tenantId },
              { userId: input.otherUserId, tenantId: peerUser.tenantId },
            ],
          },
        },
      });
      return { conversationId: conv.id };
    }),

  listMessages: tenantProcedure
    .input(
      z.object({
        conversationId: z.string().cuid(),
        limit: z.number().int().min(1).max(100).default(50),
        markRead: z.boolean().default(true),
      }),
    )
    .query(async ({ ctx, input }) => {
      const member = await ctx.prisma.redeTesteConversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: ctx.user.id,
          },
        },
      });
      if (!member) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const messages = await ctx.prisma.redeTesteMessage.findMany({
        where: { conversationId: input.conversationId },
        orderBy: { createdAt: "asc" },
        take: input.limit,
        include: {
          sender: {
            select: {
              id: true,
              juridiquesProfile: { select: { displayName: true, handle: true } },
            },
          },
        },
      });

      if (input.markRead) {
        await ctx.prisma.redeTesteConversationMember.update({
          where: {
            conversationId_userId: {
              conversationId: input.conversationId,
              userId: ctx.user.id,
            },
          },
          data: { lastReadAt: new Date() },
        });
      }

      const publicationIds = messages
        .map((m) => resolveDmSharedPublicationId(m.sharedPublicationId, m.body))
        .filter((id): id is string => Boolean(id));
      const previews = await loadDmPublicationPreviews(ctx.prisma, publicationIds);

      return messages.map((m) => {
        const pubId = resolveDmSharedPublicationId(m.sharedPublicationId, m.body);
        return {
          id: m.id,
          body: dmMessageDisplayBody(m.body, pubId),
          createdAt: m.createdAt,
          isMine: m.senderId === ctx.user.id,
          senderName:
            m.sender.juridiquesProfile?.displayName ??
            m.sender.juridiquesProfile?.handle ??
            "—",
          sharedPublicationId: pubId,
          sharedPublication: pubId ? (previews.get(pubId) ?? null) : null,
        };
      });
    }),

  sendMessage: tenantProcedure
    .input(
      z.object({
        conversationId: z.string().cuid(),
        body: z.string().min(1).max(2000),
        sharedPublicationId: z.string().cuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertJqRateLimit(ctx.user.id, "sendMessage", 60, 60_000);
      const member = await ctx.prisma.redeTesteConversationMember.findUnique({
        where: {
          conversationId_userId: {
            conversationId: input.conversationId,
            userId: ctx.user.id,
          },
        },
      });
      if (!member) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (input.sharedPublicationId) {
        const pub = await ctx.prisma.redeTestePublication.findFirst({
          where: {
            id: input.sharedPublicationId,
            deletedAt: null,
            status: "PUBLISHED",
          },
          select: { id: true },
        });
        if (!pub) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Publicação não encontrada",
          });
        }
      }

      const msg = await ctx.prisma.$transaction(async (tx) => {
        const created = await tx.juridiquesMessage.create({
          data: {
            conversationId: input.conversationId,
            senderId: ctx.user.id,
            body: input.body.trim(),
            sharedPublicationId: input.sharedPublicationId ?? null,
          },
        });
        await tx.juridiquesConversation.update({
          where: { id: input.conversationId },
          data: { updatedAt: new Date() },
        });
        return created;
      });

      let sharedPublication = null;
      if (input.sharedPublicationId) {
        const previews = await loadDmPublicationPreviews(ctx.prisma, [
          input.sharedPublicationId,
        ]);
        sharedPublication = previews.get(input.sharedPublicationId) ?? null;
      }

      return {
        id: msg.id,
        createdAt: msg.createdAt,
        sharedPublicationId: input.sharedPublicationId ?? null,
        sharedPublication,
      };
    }),

  blockUser: tenantProcedure
    .input(z.object({ userId: jqUserIdSchema }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível bloquear a si mesmo" });
      }
      const target = await ctx.prisma.redeTesteProfile.findUnique({
        where: { userId: input.userId },
      });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await ctx.prisma.redeTesteBlock.upsert({
        where: {
          blockerId_blockedId: {
            blockerId: ctx.user.id,
            blockedId: input.userId,
          },
        },
        create: {
          tenantId: ctx.tenantId,
          blockerId: ctx.user.id,
          blockedId: input.userId,
        },
        update: {},
      });
      await ctx.prisma.redeTesteFollow.deleteMany({
        where: {
          OR: [
            { followerId: ctx.user.id, followingId: input.userId },
            { followerId: input.userId, followingId: ctx.user.id },
          ],
        },
      });
      await audit({
        userId: ctx.user.id,
        tenantId: ctx.tenantId,
        action: "juridiques.user.block",
        entityType: "User",
        entityId: input.userId,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { ok: true };
    }),

  muteUser: tenantProcedure
    .input(z.object({ userId: jqUserIdSchema }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }
      await ctx.prisma.redeTesteProfileMute.upsert({
        where: {
          muterId_mutedId: { muterId: ctx.user.id, mutedId: input.userId },
        },
        create: { muterId: ctx.user.id, mutedId: input.userId },
        update: {},
      });
      return { muted: true };
    }),

  unmuteUser: tenantProcedure
    .input(z.object({ userId: jqUserIdSchema }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.redeTesteProfileMute.deleteMany({
        where: { muterId: ctx.user.id, mutedId: input.userId },
      });
      return { muted: false };
    }),

  reportProfile: tenantProcedure
    .input(
      z.object({
        userId: jqUserIdSchema,
        reason: z.enum(["spam", "harassment", "impersonation", "oab_fraud", "other"]),
        details: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }
      await ctx.prisma.redeTesteProfileReport.create({
        data: {
          reporterId: ctx.user.id,
          reportedUserId: input.userId,
          reason: input.reason,
          details: input.details ?? null,
        },
      });
      return { ok: true };
    }),

  moderationSummary: tenantProcedure.query(async ({ ctx }) => {
    assertRedeTesteOwner(ctx.dbUser.tenantRole);
    const pending = await ctx.prisma.redeTesteReport.count({
      where: { publication: { deletedAt: null } },
    });
    return { pendingReports: pending };
  }),

  listModerationReports: tenantProcedure
    .input(z.object({ take: z.number().int().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      assertRedeTesteOwner(ctx.dbUser.tenantRole);
      const take = input?.take ?? 50;

      const reports = await ctx.prisma.redeTesteReport.findMany({
        where: { publication: { deletedAt: null } },
        orderBy: { createdAt: "desc" },
        take: take * 3,
        include: {
          reporter: {
            select: {
              id: true,
              name: true,
              juridiquesProfile: { select: { handle: true, displayName: true } },
            },
          },
          publication: {
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  juridiquesProfile: { select: { handle: true, displayName: true } },
                },
              },
            },
          },
        },
      });

      const byPub = new Map<
        string,
        {
          publicationId: string;
          content: string;
          createdAt: Date;
          author: {
            userId: string;
            handle: string;
            displayName: string;
          };
          reports: Array<{
            id: string;
            reason: string;
            createdAt: Date;
            reporter: { id: string; name: string; handle: string };
          }>;
        }
      >();

      for (const r of reports) {
        const pub = r.publication;
        if (!pub || pub.deletedAt) continue;
        const authorProfile = pub.author.juridiquesProfile;
        let group = byPub.get(pub.id);
        if (!group) {
          group = {
            publicationId: pub.id,
            content: pub.content,
            createdAt: pub.createdAt,
            author: {
              userId: pub.authorId,
              handle: authorProfile?.handle ?? pub.authorId.slice(0, 8),
              displayName: authorProfile?.displayName ?? pub.author.name,
            },
            reports: [],
          };
          byPub.set(pub.id, group);
        }
        group.reports.push({
          id: r.id,
          reason: r.reason,
          createdAt: r.createdAt,
          reporter: {
            id: r.reporterId,
            name: r.reporter.juridiquesProfile?.displayName ?? r.reporter.name,
            handle: r.reporter.juridiquesProfile?.handle ?? r.reporterId.slice(0, 8),
          },
        });
      }

      const items = Array.from(byPub.values())
        .sort((a, b) => b.reports.length - a.reports.length || b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, take);

      return { items, totalPublications: items.length };
    }),

  resolveModeration: tenantProcedure
    .input(
      z.object({
        publicationId: z.string().cuid(),
        action: z.enum(["dismiss", "remove"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertRedeTesteOwner(ctx.dbUser.tenantRole);

      const pub = await ctx.prisma.redeTestePublication.findFirst({
        where: { id: input.publicationId, deletedAt: null },
      });
      if (!pub) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Publicação não encontrada" });
      }

      if (input.action === "dismiss") {
        await ctx.prisma.redeTesteReport.deleteMany({
          where: { publicationId: input.publicationId },
        });
        return { ok: true, action: "dismiss" as const };
      }

      await ctx.prisma.$transaction(async (tx) => {
        await tx.juridiquesReport.deleteMany({
          where: { publicationId: input.publicationId },
        });
        await tx.juridiquesPublication.update({
          where: { id: input.publicationId },
          data: { deletedAt: new Date() },
        });
        if (!pub.parentId) {
          await tx.juridiquesProfile.update({
            where: { userId: pub.authorId },
            data: { publicationsCount: { decrement: 1 } },
          });
        }
      });

      return { ok: true, action: "remove" as const };
    }),

  listCommunities: tenantProcedure.query(async ({ ctx }) => {
    await ensureRedeTesteProfile(ctx.prisma, ctx.user.id, ctx.tenantId);
    await ensureRedeTesteCommunities(ctx.prisma, ctx.tenantId);

    const communities = dedupeJqCommunitiesBySlug(
      await ctx.prisma.redeTesteCommunity.findMany({
        orderBy: { name: "asc" },
        include: {
          _count: { select: { members: true, publications: true } },
          members: {
            where: { userId: ctx.user.id },
            select: { role: true },
          },
        },
      }),
    );

    return communities.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      isPrivate: c.isPrivate,
      membersCount: c.membersCount,
      publicationsCount: c._count.publications,
      isMember: c.members.length > 0,
      memberRole: c.members[0]?.role ?? null,
    }));
  }),

  leaveCommunity: tenantProcedure
    .input(z.object({ communityId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.redeTesteCommunityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: input.communityId,
            userId: ctx.user.id,
          },
        },
      });
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.$transaction(async (tx) => {
        await tx.juridiquesCommunityMember.delete({
          where: {
            communityId_userId: {
              communityId: input.communityId,
              userId: ctx.user.id,
            },
          },
        });
        const count = await tx.juridiquesCommunityMember.count({
          where: { communityId: input.communityId },
        });
        await tx.juridiquesCommunity.update({
          where: { id: input.communityId },
          data: { membersCount: count },
        });
      });
      return { ok: true };
    }),

  updateCommunity: tenantProcedure
    .input(
      z.object({
        communityId: z.string().cuid(),
        name: z.string().min(2).max(80).optional(),
        description: z.string().max(500).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.redeTesteCommunityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: input.communityId,
            userId: ctx.user.id,
          },
        },
      });
      if (!member || member.role !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem editar" });
      }
      const { communityId, ...data } = input;
      return ctx.prisma.redeTesteCommunity.update({
        where: { id: communityId },
        data,
      });
    }),

  joinCommunity: tenantProcedure
    .input(z.object({ communityId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      await ensureRedeTesteProfile(ctx.prisma, ctx.user.id, ctx.tenantId);
      const community = await ctx.prisma.redeTesteCommunity.findUnique({
        where: { id: input.communityId },
      });
      if (!community) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.prisma.$transaction(async (tx) => {
        await tx.juridiquesCommunityMember.upsert({
          where: {
            communityId_userId: {
              communityId: input.communityId,
              userId: ctx.user.id,
            },
          },
          create: {
            communityId: input.communityId,
            userId: ctx.user.id,
            role: "MEMBER",
          },
          update: {},
        });
        const count = await tx.juridiquesCommunityMember.count({
          where: { communityId: input.communityId },
        });
        await tx.juridiquesCommunity.update({
          where: { id: input.communityId },
          data: { membersCount: count },
        });
      });
      return { ok: true };
    }),

  communityFeed: tenantProcedure
    .input(
      paginatedInput.extend({
        slug: z.string().min(1).max(40),
      }),
    )
    .query(async ({ ctx, input }) => {
      await ensureRedeTesteProfile(ctx.prisma, ctx.user.id, ctx.tenantId);
      const community = await ctx.prisma.redeTesteCommunity.findFirst({
        where: { slug: input.slug },
        orderBy: { membersCount: "desc" },
      });
      if (!community) throw new TRPCError({ code: "NOT_FOUND" });

      const member = await ctx.prisma.redeTesteCommunityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: community.id,
            userId: ctx.user.id,
          },
        },
      });
      if (!member && community.isPrivate) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Comunidade privada" });
      }

      const blockedIds = await getJqBlockedUserIds(ctx.prisma, ctx.user.id);
      const rows = await ctx.prisma.redeTestePublication.findMany({
        where: jqGlobalFeedWhere(
          ctx.user.id,
          {
            communityId: community.id,
            ...(blockedIds.length ? { authorId: { notIn: blockedIds } } : {}),
            ...jqCursorWhere(input.cursor),
          },
          ctx.tenantId,
        ),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
        include: jqPublicationInclude,
      });

      const hasMore = rows.length > input.limit;
      const page = hasMore ? rows.slice(0, input.limit) : rows;
      const items = await mapJqPublications(ctx.prisma, page, ctx.user.id);
      const last = page[page.length - 1];

      return {
        community: {
          id: community.id,
          slug: community.slug,
          name: community.name,
          description: community.description,
          isMember: !!member,
          memberRole: member?.role ?? null,
        },
        items,
        nextCursor:
          hasMore && last ? { id: last.id, createdAt: last.createdAt } : null,
      };
    }),

  assistantWorkspace: tenantProcedure.query(async ({ ctx }) => {
    await ensureRedeTesteProfile(ctx.prisma, ctx.user.id, ctx.tenantId);
    const profile = await ctx.prisma.redeTesteProfile.findUniqueOrThrow({
      where: { userId: ctx.user.id },
    });
    const settings = parseJqProfileSettings(profile.settings);
    return {
      assistantUrl: settings.assistantUrl ?? null,
      assistantNotebookName: settings.assistantNotebookName ?? null,
      prompts: assistant_PROMPTS,
      geminiConfigured: isGeminiEstagiarioConfigured(),
    };
  }),

  saveassistantWorkspace: tenantProcedure
    .input(
      z.object({
        assistantUrl: z.string().url().max(500).optional().nullable(),
        assistantNotebookName: z.string().max(120).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ensureRedeTesteProfile(ctx.prisma, ctx.user.id, ctx.tenantId);
      const profile = await ctx.prisma.redeTesteProfile.findUniqueOrThrow({
        where: { userId: ctx.user.id },
      });
      const next = mergeJqProfileSettings(profile.settings, {
        assistantUrl: input.assistantUrl ?? undefined,
        assistantNotebookName: input.assistantNotebookName ?? undefined,
      });
      await ctx.prisma.redeTesteProfile.update({
        where: { userId: ctx.user.id },
        data: { settings: next },
      });
      return { ok: true };
    }),

  assistantChat: tenantProcedure
    .input(
      z.object({
        message: z.string().min(1).max(8000),
        promptId: z.string().optional(),
        caseId: z.string().cuid().optional(),
        clientId: z.string().cuid().optional(),
        bookmarkPublicationIds: z.array(z.string().cuid()).max(20).optional(),
        bridgeSessionId: z.string().min(16).max(80).optional(),
        documentContextText: z.string().max(50_000).optional(),
        history: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              text: z.string().min(1).max(32_000),
            }),
          )
          .max(40)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isGeminiEstagiarioConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "GEMINI_API_KEY não configurada no servidor.",
        });
      }

      await ensureRedeTesteProfile(ctx.prisma, ctx.user.id, ctx.tenantId);

      const prompt = input.promptId
        ? assistant_PROMPTS.find((p) => p.id === input.promptId)
        : undefined;

      const sources = await buildEstagiarioSources(
        ctx.prisma,
        { tenantId: ctx.tenantId, userId: ctx.user.id },
        {
          clientId: input.clientId,
          caseId: input.caseId,
          bookmarkPublicationIds: input.bookmarkPublicationIds,
          bridgeSessionId: input.bridgeSessionId,
          documentContextText: input.documentContextText,
        },
      );

      const history = input.history ?? [];

      let answer: string;
      let modelUsed: string;
      try {
        const result = await runEstagiarioGeminiChat({
          sourcesText: sources.textBlock,
          pdfParts: sources.pdfParts,
          userMessage: input.message,
          history,
        });
        answer = result.answer;
        modelUsed = result.modelUsed;
      } catch (e) {
        const msg = formatGeminiErrorForUser(e);
        const code = /quota|429|rate/i.test(msg) ? "TOO_MANY_REQUESTS" : "INTERNAL_SERVER_ERROR";
        throw new TRPCError({ code, message: msg });
      }

      return {
        mode: "gemini" as const,
        answer,
        promptTitle: prompt?.title ?? null,
        contextSummary: sources.summary,
        model: modelUsed,
        receivedAt: new Date().toISOString(),
      };
    }),

  buildassistantBrief: tenantProcedure
    .input(
      z.object({
        caseId: z.string().cuid().optional(),
        clientId: z.string().cuid().optional(),
        promptId: z.string().optional(),
        bookmarkPublicationIds: z.array(z.string().cuid()).max(20).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const parts: string[] = [
        "# Briefing para assistant — Portal / Rede Teste",
        `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
        "",
      ];

      if (input.clientId) {
        const client = await ctx.prisma.client.findFirst({
          where: { id: input.clientId, tenantId: ctx.tenantId, deletedAt: null },
        });
        if (client) {
          parts.push("## Cliente", `- Nome: ${client.name}`, client.email ? `- E-mail: ${client.email}` : "", client.phone ? `- Telefone: ${client.phone}` : "", "");
        }
      }

      if (input.caseId) {
        const caseRow = await ctx.prisma.case.findFirst({
          where: { id: input.caseId, tenantId: ctx.tenantId, deletedAt: null },
          include: { client: { select: { name: true } } },
        });
        if (caseRow) {
          parts.push(
            "## Processo",
            `- CNJ: ${caseRow.cnjNumber}`,
            `- Título: ${caseRow.title}`,
            caseRow.courtDistrict ? `- Vara/comarca: ${caseRow.courtDistrict}` : "",
            caseRow.client ? `- Cliente: ${caseRow.client.name}` : "",
            caseRow.description ? `- Descrição: ${caseRow.description}` : "",
            "",
          );
        }
      }

      if (input.bookmarkPublicationIds?.length) {
        const bookmarkRows = await ctx.prisma.redeTesteBookmark.findMany({
          where: {
            userId: ctx.user.id,
            publicationId: { in: input.bookmarkPublicationIds },
          },
          include: {
            publication: {
              select: {
                id: true,
                content: true,
                createdAt: true,
                author: { select: { displayName: true, handle: true } },
              },
            },
          },
          take: 20,
        });

        if (bookmarkRows.length) {
          parts.push("## Jurisprudências/Fontes salvas no Rede Teste");
          for (const row of bookmarkRows) {
            const pub = row.publication;
            if (!pub?.content?.trim()) continue;
            const author = pub.author?.displayName ?? pub.author?.handle ?? "autor";
            parts.push(
              `- Fonte ${pub.id} (${author}, ${new Date(pub.createdAt).toLocaleDateString("pt-BR")}):`,
              `  ${pub.content.slice(0, 800)}`,
              "",
            );
          }
        }
      }

      const prompt = input.promptId
        ? assistant_PROMPTS.find((p) => p.id === input.promptId)
        : assistant_PROMPTS[0];

      if (prompt) {
        parts.push(
          "## Instrução sugerida (cole no chat do assistant após subir os PDFs)",
          "",
          fillPromptTemplate(prompt.prompt, {
            cliente: input.clientId ? "[ver seção Cliente]" : "",
            processo: input.caseId ? "[ver seção Processo]" : "",
          }),
        );
      }

      parts.push(
        "",
        "---",
        "Passos: 1) Abra seu notebook no assistant  2) Envie petições, contratos e provas  3) Cole o briefing acima no chat  4) Revise a peça no escritório antes de protocolar",
      );

      return { markdown: parts.filter(Boolean).join("\n") };
    }),

  juridiquesAnalytics: tenantProcedure.query(async ({ ctx }) => {
    assertRedeTesteOwner(ctx.dbUser.tenantRole);
    const [publications, members, reports, communities, dms, referrals] =
      await Promise.all([
        ctx.prisma.redeTestePublication.count({
          where: { tenantId: ctx.tenantId, deletedAt: null, parentId: null },
        }),
        ctx.prisma.redeTesteProfile.count({ where: { tenantId: ctx.tenantId } }),
        ctx.prisma.redeTesteReport.count({
          where: { tenantId: ctx.tenantId, publication: { deletedAt: null } },
        }),
        ctx.prisma.redeTesteCommunity.count({ where: { tenantId: ctx.tenantId } }),
        ctx.prisma.redeTesteMessage.count({
          where: {
            conversation: {
              members: { some: { tenantId: ctx.tenantId } },
            },
          },
        }),
        ctx.prisma.redeTesteReferral.count({ where: { tenantId: ctx.tenantId } }),
      ]);
    return { publications, members, reports, communities, dms, referrals };
  }),

  listReferrals: tenantProcedure
    .input(z.object({ take: z.number().int().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      assertRedeTesteOwner(ctx.dbUser.tenantRole);
      const rows = await ctx.prisma.redeTesteReferral.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { createdAt: "desc" },
        take: input?.take ?? 20,
        include: {
          referrer: {
            select: {
              juridiquesProfile: { select: { handle: true, displayName: true } },
            },
          },
          referred: {
            select: {
              juridiquesProfile: { select: { handle: true, displayName: true } },
            },
          },
        },
      });
      return rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        source: r.source,
        referrer: {
          handle: r.referrer.juridiquesProfile?.handle ?? "—",
          displayName: r.referrer.juridiquesProfile?.displayName ?? "—",
        },
        referred: {
          handle: r.referred.juridiquesProfile?.handle ?? "—",
          displayName: r.referred.juridiquesProfile?.displayName ?? "—",
        },
      }));
    }),

  referralLeaderboard: tenantProcedure
    .input(z.object({ take: z.number().int().min(1).max(20).default(10) }).optional())
    .query(async ({ ctx, input }) => {
      assertRedeTesteOwner(ctx.dbUser.tenantRole);
      const grouped = await ctx.prisma.redeTesteReferral.groupBy({
        by: ["referrerUserId"],
        where: { tenantId: ctx.tenantId },
        _count: { referredUserId: true },
        orderBy: { _count: { referredUserId: "desc" } },
        take: input?.take ?? 10,
      });
      const profiles = await ctx.prisma.redeTesteProfile.findMany({
        where: { userId: { in: grouped.map((g) => g.referrerUserId) } },
        select: { userId: true, handle: true, displayName: true },
      });
      const byUser = new Map(profiles.map((p) => [p.userId, p]));
      return grouped.map((g) => ({
        userId: g.referrerUserId,
        count: g._count.referredUserId,
        handle: byUser.get(g.referrerUserId)?.handle ?? "—",
        displayName: byUser.get(g.referrerUserId)?.displayName ?? "—",
      }));
    }),
});
