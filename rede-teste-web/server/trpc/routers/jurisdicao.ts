import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { router, tenantProcedure } from "../trpc";
import { ensureRedeTesteProfile } from "@/lib/rede-teste/ensure-profile";

const POST_TYPES = ["TEXT", "PHOTO", "QUOTE", "LINK", "CHAT", "VIDEO", "AUDIO"] as const;

/** Aceita caminho relativo (/uploads/…) ou URL http(s) absoluta. */
const mediaUrl = z
  .string()
  .max(2000)
  .refine((v) => v.startsWith("/") || /^https?:\/\//i.test(v), "URL inválida");

/** Apenas http(s) — usado em hrefs externos para evitar XSS (javascript:). */
const httpUrl = z
  .string()
  .max(2000)
  .refine((v) => /^https?:\/\//i.test(v), "Use uma URL http(s)");

const themeSchema = {
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  avatarUrl: mediaUrl.nullable().optional(),
  headerUrl: mediaUrl.nullable().optional(),
  bgColor: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  textColor: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  bgImageUrl: mediaUrl.nullable().optional(),
  fontFamily: z.enum(["serif", "sans", "mono", "cursive"]).optional(),
  radioUrl: httpUrl.nullable().optional(),
  radioLabel: z.string().trim().max(120).nullable().optional(),
  radioAutoplay: z.boolean().optional(),
};

function slugify(input: string): string {
  return (
    input
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "blog"
  );
}

async function uniqueHandle(prisma: PrismaClient, base: string): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let n = 1;
  // Limite defensivo para evitar loop infinito.
  while (n < 100) {
    const exists = await prisma.jurisdicaoBlog.findUnique({ where: { handle: candidate } });
    if (!exists) return candidate;
    candidate = `${root}-${n}`;
    n += 1;
  }
  return `${root}-${Date.now().toString(36)}`;
}

const blogSummary = {
  id: true,
  handle: true,
  title: true,
  avatarUrl: true,
} as const;

export const jurisdicaoRouter = router({
  myBlog: tenantProcedure.query(async ({ ctx }) => {
    return ctx.prisma.jurisdicaoBlog.findUnique({ where: { userId: ctx.dbUser.id } });
  }),

  createBlog: tenantProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.jurisdicaoBlog.findUnique({
        where: { userId: ctx.dbUser.id },
      });
      if (existing) return existing;

      const profile = await ctx.prisma.redeTesteProfile.findUnique({
        where: { userId: ctx.dbUser.id },
        select: { handle: true },
      });
      const handle = await uniqueHandle(ctx.prisma, profile?.handle ?? input.title);

      return ctx.prisma.jurisdicaoBlog.create({
        data: {
          tenantId: ctx.tenantId,
          userId: ctx.dbUser.id,
          handle,
          title: input.title,
          description: input.description ?? null,
        },
      });
    }),

  updateBlog: tenantProcedure
    .input(z.object(themeSchema))
    .mutation(async ({ ctx, input }) => {
      const blog = await ctx.prisma.jurisdicaoBlog.findUnique({
        where: { userId: ctx.dbUser.id },
      });
      if (!blog) throw new TRPCError({ code: "NOT_FOUND", message: "Crie sua Jurisdição primeiro." });
      return ctx.prisma.jurisdicaoBlog.update({
        where: { id: blog.id },
        data: {
          title: input.title ?? undefined,
          description: input.description ?? undefined,
          avatarUrl: input.avatarUrl === undefined ? undefined : input.avatarUrl,
          headerUrl: input.headerUrl === undefined ? undefined : input.headerUrl,
          bgColor: input.bgColor ?? undefined,
          textColor: input.textColor ?? undefined,
          accentColor: input.accentColor ?? undefined,
          bgImageUrl: input.bgImageUrl === undefined ? undefined : input.bgImageUrl,
          fontFamily: input.fontFamily ?? undefined,
          radioUrl: input.radioUrl === undefined ? undefined : input.radioUrl,
          radioLabel: input.radioLabel === undefined ? undefined : input.radioLabel,
          radioAutoplay: input.radioAutoplay ?? undefined,
        },
      });
    }),

  getBlogByHandle: tenantProcedure
    .input(z.object({ handle: z.string().min(1).max(40) }))
    .query(async ({ ctx, input }) => {
      const blog = await ctx.prisma.jurisdicaoBlog.findUnique({
        where: { handle: input.handle },
      });
      if (!blog) throw new TRPCError({ code: "NOT_FOUND", message: "Jurisdição não encontrada." });
      const [followersCount, following] = await Promise.all([
        ctx.prisma.jurisdicaoFollow.count({ where: { blogId: blog.id } }),
        ctx.prisma.jurisdicaoFollow.findUnique({
          where: { followerUserId_blogId: { followerUserId: ctx.dbUser.id, blogId: blog.id } },
        }),
      ]);
      return {
        ...blog,
        isOwner: blog.userId === ctx.dbUser.id,
        isFollowing: !!following,
        followersCount,
      };
    }),

  listPosts: tenantProcedure
    .input(
      z.object({
        handle: z.string().min(1).max(40),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(30).default(15),
      }),
    )
    .query(async ({ ctx, input }) => {
      const blog = await ctx.prisma.jurisdicaoBlog.findUnique({
        where: { handle: input.handle },
        select: { id: true },
      });
      if (!blog) throw new TRPCError({ code: "NOT_FOUND" });
      const rows = await ctx.prisma.jurisdicaoPost.findMany({
        where: { blogId: blog.id },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: { blog: { select: blogSummary } },
      });
      const hasMore = rows.length > input.limit;
      const page = hasMore ? rows.slice(0, input.limit) : rows;
      const liked = await viewerLikes(ctx.prisma, ctx.dbUser.id, page.map((p) => p.id));
      return {
        posts: page.map((p) => ({ ...p, viewerLiked: liked.has(p.id) })),
        nextCursor: hasMore ? page[page.length - 1]!.id : null,
      };
    }),

  getPost: tenantProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const post = await ctx.prisma.jurisdicaoPost.findUnique({
        where: { id: input.id },
        include: { blog: { select: blogSummary } },
      });
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });
      const liked = await viewerLikes(ctx.prisma, ctx.dbUser.id, [post.id]);
      return { ...post, viewerLiked: liked.has(post.id) };
    }),

  dashboard: tenantProcedure
    .input(z.object({ cursor: z.string().optional(), limit: z.number().int().min(1).max(30).default(15) }))
    .query(async ({ ctx, input }) => {
      const [own, follows] = await Promise.all([
        ctx.prisma.jurisdicaoBlog.findUnique({ where: { userId: ctx.dbUser.id }, select: { id: true } }),
        ctx.prisma.jurisdicaoFollow.findMany({
          where: { followerUserId: ctx.dbUser.id },
          select: { blogId: true },
        }),
      ]);
      const blogIds = [...new Set([...(own ? [own.id] : []), ...follows.map((f) => f.blogId)])];
      if (blogIds.length === 0) {
        return { posts: [], nextCursor: null as string | null };
      }
      const rows = await ctx.prisma.jurisdicaoPost.findMany({
        where: { blogId: { in: blogIds } },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: { blog: { select: blogSummary } },
      });
      const hasMore = rows.length > input.limit;
      const page = hasMore ? rows.slice(0, input.limit) : rows;
      const liked = await viewerLikes(ctx.prisma, ctx.dbUser.id, page.map((p) => p.id));
      return {
        posts: page.map((p) => ({ ...p, viewerLiked: liked.has(p.id) })),
        nextCursor: hasMore ? page[page.length - 1]!.id : null,
      };
    }),

  createPost: tenantProcedure
    .input(
      z.object({
        type: z.enum(POST_TYPES),
        title: z.string().trim().max(200).optional(),
        body: z.string().trim().max(20000).optional(),
        imageUrl: mediaUrl.optional(),
        imageUrls: z.array(mediaUrl).max(10).optional(),
        audioUrl: mediaUrl.optional(),
        quoteSource: z.string().trim().max(200).optional(),
        linkUrl: httpUrl.optional(),
        videoUrl: httpUrl.optional(),
        tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const blog = await ctx.prisma.jurisdicaoBlog.findUnique({ where: { userId: ctx.dbUser.id } });
      if (!blog) throw new TRPCError({ code: "NOT_FOUND", message: "Crie sua Jurisdição primeiro." });

      const photos = (input.imageUrls ?? []).filter(Boolean);
      const firstPhoto = input.imageUrl ?? photos[0] ?? null;

      const hasContent =
        input.body?.trim() ||
        input.title?.trim() ||
        firstPhoto ||
        input.audioUrl ||
        input.linkUrl ||
        input.videoUrl;
      if (!hasContent) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Adicione conteúdo ao post." });
      }
      if (input.type === "PHOTO" && !firstPhoto) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Envie ao menos uma imagem." });
      }
      if (input.type === "AUDIO" && !input.audioUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Envie ou informe o áudio." });
      }
      if (input.type === "LINK" && !input.linkUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Informe a URL do link." });
      }
      if (input.type === "VIDEO" && !input.videoUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Informe a URL do vídeo." });
      }

      return ctx.prisma.jurisdicaoPost.create({
        data: {
          blogId: blog.id,
          type: input.type,
          title: input.title?.trim() || null,
          body: input.body?.trim() || null,
          imageUrl: firstPhoto,
          imageUrls: photos,
          audioUrl: input.audioUrl ?? null,
          quoteSource: input.quoteSource?.trim() || null,
          linkUrl: input.linkUrl ?? null,
          videoUrl: input.videoUrl ?? null,
          tags: (input.tags ?? []).map((t) => t.replace(/^#/, "")).filter(Boolean),
        },
        include: { blog: { select: blogSummary } },
      });
    }),

  deletePost: tenantProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.prisma.jurisdicaoPost.findUnique({
        where: { id: input.id },
        include: { blog: { select: { userId: true } } },
      });
      if (!post || post.blog.userId !== ctx.dbUser.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await ctx.prisma.jurisdicaoPost.delete({ where: { id: post.id } });
      return { ok: true };
    }),

  toggleLike: tenantProcedure
    .input(z.object({ postId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.jurisdicaoLike.findUnique({
        where: { postId_userId: { postId: input.postId, userId: ctx.dbUser.id } },
      });
      if (existing) {
        await ctx.prisma.$transaction([
          ctx.prisma.jurisdicaoLike.delete({ where: { id: existing.id } }),
          ctx.prisma.jurisdicaoPost.update({
            where: { id: input.postId },
            data: { likesCount: { decrement: 1 } },
          }),
        ]);
        return { liked: false };
      }
      await ctx.prisma.$transaction([
        ctx.prisma.jurisdicaoLike.create({ data: { postId: input.postId, userId: ctx.dbUser.id } }),
        ctx.prisma.jurisdicaoPost.update({
          where: { id: input.postId },
          data: { likesCount: { increment: 1 } },
        }),
      ]);
      return { liked: true };
    }),

  toggleFollow: tenantProcedure
    .input(z.object({ blogId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const blog = await ctx.prisma.jurisdicaoBlog.findUnique({ where: { id: input.blogId } });
      if (!blog) throw new TRPCError({ code: "NOT_FOUND" });
      if (blog.userId === ctx.dbUser.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode seguir a própria Jurisdição." });
      }
      const existing = await ctx.prisma.jurisdicaoFollow.findUnique({
        where: { followerUserId_blogId: { followerUserId: ctx.dbUser.id, blogId: input.blogId } },
      });
      if (existing) {
        await ctx.prisma.jurisdicaoFollow.delete({ where: { id: existing.id } });
        return { following: false };
      }
      await ctx.prisma.jurisdicaoFollow.create({
        data: { followerUserId: ctx.dbUser.id, blogId: input.blogId },
      });
      return { following: true };
    }),

  reblog: tenantProcedure
    .input(z.object({ postId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const blog = await ctx.prisma.jurisdicaoBlog.findUnique({ where: { userId: ctx.dbUser.id } });
      if (!blog) throw new TRPCError({ code: "NOT_FOUND", message: "Crie sua Jurisdição primeiro." });
      const source = await ctx.prisma.jurisdicaoPost.findUnique({
        where: { id: input.postId },
        include: { blog: { select: blogSummary } },
      });
      if (!source) throw new TRPCError({ code: "NOT_FOUND" });

      const created = await ctx.prisma.jurisdicaoPost.create({
        data: {
          blogId: blog.id,
          type: source.type,
          title: source.title,
          body: source.body,
          imageUrl: source.imageUrl,
          imageUrls: source.imageUrls,
          audioUrl: source.audioUrl,
          quoteSource: source.quoteSource,
          linkUrl: source.linkUrl,
          videoUrl: source.videoUrl,
          tags: source.tags,
          rebloggedFromHandle: source.blog.handle,
          rebloggedFromTitle: source.blog.title,
          sourcePostId: source.id,
        },
        include: { blog: { select: blogSummary } },
      });
      await ctx.prisma.jurisdicaoPost.update({
        where: { id: source.id },
        data: { reblogsCount: { increment: 1 } },
      });
      return created;
    }),

  /** Compartilha uma criação da Jurisdição no feed do Juridiquês do próprio autor. */
  shareToJuridiques: tenantProcedure
    .input(z.object({ postId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const post = await ctx.prisma.jurisdicaoPost.findUnique({
        where: { id: input.postId },
        include: { blog: { select: { userId: true, handle: true, title: true } } },
      });
      if (!post || post.blog.userId !== ctx.dbUser.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Post não encontrado." });
      }

      await ensureRedeTesteProfile(ctx.prisma, ctx.dbUser.id, ctx.tenantId);

      const base = (process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://rede-teste.onrender.com").replace(
        /\/$/,
        "",
      );
      const permalink = `${base}/jurisdicao/${post.blog.handle}/post/${post.id}`;

      const photos =
        post.imageUrls && post.imageUrls.length
          ? post.imageUrls
          : post.imageUrl
            ? [post.imageUrl]
            : [];

      const parts: string[] = [];
      if (post.title?.trim()) parts.push(post.title.trim());
      if (post.type === "QUOTE") {
        const q = post.body?.trim();
        if (q) parts.push(`"${q}"${post.quoteSource ? ` — ${post.quoteSource}` : ""}`);
      } else if (post.body?.trim()) {
        parts.push(post.body.trim());
      }
      if (post.type === "LINK" && post.linkUrl) parts.push(post.linkUrl);
      if (post.type === "VIDEO" && post.videoUrl) parts.push(post.videoUrl);
      if (post.type === "AUDIO") parts.push(`🎧 Ouça na minha Jurisdição: ${permalink}`);

      let content = parts.join("\n\n");
      if (content.length > 540) content = `${content.slice(0, 539)}…`;
      // Foto sem legenda fica sem texto, mas a mídia é anexada. Sem nada, vincula o post.
      if (!content && photos.length === 0) content = permalink;

      const publication = await ctx.prisma.redeTestePublication.create({
        data: {
          tenantId: ctx.tenantId,
          authorId: ctx.dbUser.id,
          content,
          status: "PUBLISHED",
        },
      });

      if (post.type === "PHOTO" && photos.length) {
        await ctx.prisma.redeTesteMedia.createMany({
          data: photos.slice(0, 4).map((url, order) => ({
            publicationId: publication.id,
            tenantId: ctx.tenantId,
            uploaderId: ctx.dbUser.id,
            type: "IMAGE" as const,
            url,
            order,
          })),
        });
      }

      return { ok: true, publicationId: publication.id };
    }),
});

async function viewerLikes(
  prisma: PrismaClient,
  userId: string,
  postIds: string[],
): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const likes = await prisma.jurisdicaoLike.findMany({
    where: { userId, postId: { in: postIds } },
    select: { postId: true },
  });
  return new Set(likes.map((l) => l.postId));
}
