import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { TenantPlan } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hasJqJuniorPlan, hasJqPlenoPlan } from "@/lib/rede-teste/plans";
import { createJqPoll, jqPollInputSchema } from "@/lib/rede-teste/poll-db";
import { validatePollOptions, validateScheduledAt } from "@/lib/rede-teste/composer-validations";

export const jqLinkPreviewSchema = z.object({
  url: z.string().url().max(2000),
  title: z.string().max(500).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  image: z.string().url().max(2000).nullable().optional(),
  siteName: z.string().max(200).nullable().optional(),
});

export const jqThreadPostSchema = z.object({
  content: z.string().max(560),
  mediaIds: z.array(z.string().cuid()).max(4).optional(),
  externalGifUrl: z.string().url().max(2000).optional(),
});

export const jqCreatePublicationInputSchema = z
  .object({
    content: z.string().max(560),
    practiceArea: z.string().max(80).optional(),
    parentId: z.string().cuid().optional(),
    mediaIds: z.array(z.string().cuid()).max(4).optional(),
    externalGifUrl: z.string().url().max(2000).optional(),
    isConfidential: z.boolean().default(false),
    allowGifReplies: z.boolean().default(true),
    communityId: z.string().cuid().optional(),
    poll: jqPollInputSchema.optional(),
    sourceIntimationId: z.string().cuid().optional(),
    courtId: z.string().cuid().optional(),
    linkPreview: jqLinkPreviewSchema.optional(),
    scheduledAt: z.coerce.date().optional(),
    saveAsDraft: z.boolean().optional(),
    draftId: z.string().cuid().optional(),
    threadPosts: z.array(jqThreadPostSchema).max(10).optional(),
  })
  .refine((d) => !d.parentId || !d.isConfidential, {
    message: "Sigilo profissional só em publicações principais",
  })
  .refine((d) => !d.parentId || !d.communityId, {
    message: "Comunidade só em publicações principais",
  })
  .refine((d) => !(d.mediaIds?.length && d.externalGifUrl), {
    message: "Não é possível combinar GIF com imagem ou vídeo",
  })
  .refine((d) => !d.poll || (!d.mediaIds?.length && !d.externalGifUrl), {
    message: "Enquete não pode ser combinada com mídia",
  });

type Input = z.infer<typeof jqCreatePublicationInputSchema>;

function resolveStatus(
  input: Input,
  plan: TenantPlan,
): { status: "DRAFT" | "SCHEDULED" | "PUBLISHED"; scheduledAt: Date | null } {
  if (input.saveAsDraft) {
    return { status: "DRAFT", scheduledAt: null };
  }
  if (input.scheduledAt) {
    if (!hasJqJuniorPlan(plan)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Agendamento disponível no plano Junior (Solo ou superior).",
      });
    }
    const err = validateScheduledAt(input.scheduledAt);
    if (err) throw new TRPCError({ code: "BAD_REQUEST", message: err });
    return { status: "SCHEDULED", scheduledAt: input.scheduledAt };
  }
  return { status: "PUBLISHED", scheduledAt: null };
}

async function attachMedia(
  tx: Prisma.TransactionClient,
  opts: {
    publicationId: string;
    tenantId: string;
    userId: string;
    mediaIds?: string[];
    externalGifUrl?: string;
  },
) {
  if (opts.externalGifUrl) {
    await tx.juridiquesMedia.create({
      data: {
        publicationId: opts.publicationId,
        tenantId: opts.tenantId,
        uploaderId: opts.userId,
        type: "GIF",
        url: opts.externalGifUrl,
        order: 0,
      },
    });
  }
  if (opts.mediaIds?.length) {
    await tx.juridiquesMedia.updateMany({
      where: {
        id: { in: opts.mediaIds },
        uploaderId: opts.userId,
        tenantId: opts.tenantId,
        publicationId: null,
      },
      data: { publicationId: opts.publicationId },
    });
  }
}

export async function createJqPublicationsFromInput(
  prisma: PrismaClient,
  ctx: { tenantId: string; userId: string; plan: TenantPlan },
  input: Input,
) {
  const threadParts = input.threadPosts?.filter((p) => p.content.trim() || p.mediaIds?.length || p.externalGifUrl) ?? [];
  const isThread = threadParts.length > 1;

  if (isThread && !hasJqPlenoPlan(ctx.plan)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Threads disponíveis no plano Pleno (Equipe ou Escritório).",
    });
  }

  if (input.poll) {
    const pollErr = validatePollOptions(input.poll.options);
    if (pollErr) throw new TRPCError({ code: "BAD_REQUEST", message: pollErr });
  }

  const { status, scheduledAt } = resolveStatus(input, ctx.plan);

  const posts: Array<{
    content: string;
    mediaIds?: string[];
    externalGifUrl?: string;
  }> = isThread
    ? threadParts.map((p) => ({
        content: p.content.trim(),
        mediaIds: p.mediaIds,
        externalGifUrl: p.externalGifUrl,
      }))
    : [
        {
          content: input.content.trim(),
          mediaIds: input.mediaIds,
          externalGifUrl: input.externalGifUrl,
        },
      ];

  for (const p of posts) {
    if (!p.content && !(p.mediaIds?.length) && !p.externalGifUrl && !input.poll) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Escreva algo, adicione mídia ou uma enquete",
      });
    }
  }

  const threadId = isThread ? randomUUID() : null;
  const createdIds: string[] = [];

  const result = await prisma.$transaction(async (tx) => {
    if (input.draftId) {
      const draft = await tx.juridiquesPublication.findFirst({
        where: {
          id: input.draftId,
          authorId: ctx.userId,
          status: "DRAFT",
          deletedAt: null,
        },
      });
      if (!draft) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Rascunho não encontrado" });
      }
      await tx.juridiquesPublication.delete({ where: { id: draft.id } });
    }

    let threadRootId: string | null = null;

    for (let i = 0; i < posts.length; i++) {
      const part = posts[i]!;
      const content =
        part.content ||
        (input.poll && i === 0 ? input.poll.options[0]?.slice(0, 560) ?? "" : "");

      const pub = await tx.juridiquesPublication.create({
        data: {
          tenantId: ctx.tenantId,
          authorId: ctx.userId,
          content,
          practiceArea: i === 0 ? input.practiceArea ?? null : null,
          parentId: input.parentId ?? null,
          communityId: i === 0 ? input.communityId ?? null : null,
          sourceIntimationId: i === 0 && !input.parentId ? input.sourceIntimationId ?? null : null,
          isConfidential: i === 0 && !input.parentId ? input.isConfidential : false,
          allowGifReplies: i === 0 && !input.parentId ? input.allowGifReplies : true,
          status,
          scheduledAt: i === 0 ? scheduledAt : null,
          courtId: i === 0 ? input.courtId ?? null : null,
          linkPreview: i === 0 && input.linkPreview ? input.linkPreview : undefined,
          threadId,
          threadPosition: isThread ? i : null,
          threadRootId: i === 0 ? null : threadRootId,
        },
      });

      if (i === 0) {
        threadRootId = pub.id;
        if (isThread) {
          await tx.juridiquesPublication.update({
            where: { id: pub.id },
            data: { threadRootId: pub.id },
          });
        }
      }

      await attachMedia(tx, {
        publicationId: pub.id,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        mediaIds: part.mediaIds,
        externalGifUrl: part.externalGifUrl,
      });

      if (input.poll && i === 0) {
        await createJqPoll(tx, pub.id, input.poll);
      }

      createdIds.push(pub.id);
    }

    if (status === "PUBLISHED") {
      await tx.juridiquesProfile.update({
        where: { userId: ctx.userId },
        data: { publicationsCount: { increment: posts.length } },
      });

      if (input.parentId) {
        await tx.juridiquesPublication.update({
          where: { id: input.parentId },
          data: { repliesCount: { increment: 1 } },
        });
      }
    }

    return createdIds;
  });

  return { ids: result, status, scheduledAt, primaryId: result[0]! };
}
