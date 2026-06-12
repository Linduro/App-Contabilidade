import type { PrismaClient } from "@prisma/client";
import { parseJqContent } from "./parse-content";
import { normalizeJqHandle } from "./publication-dto";
import { dispatchJqNotification } from "./notification-dispatch";

export { dispatchJqNotification as createJqNotification };

export async function syncJqPublicationMeta(
  prisma: PrismaClient,
  opts: {
    tenantId: string;
    publicationId: string;
    authorId: string;
    content: string;
    parentId?: string | null;
  },
) {
  const { hashtags, mentionHandles } = parseJqContent(opts.content);

  for (const tag of hashtags) {
    const hashtag = await prisma.redeTesteHashtag.upsert({
      where: { tag },
      create: { tag, publicationsCount: 1 },
      update: { publicationsCount: { increment: 1 } },
    });
    await prisma.redeTestePublicationHashtag.upsert({
      where: {
        publicationId_hashtagId: {
          publicationId: opts.publicationId,
          hashtagId: hashtag.id,
        },
      },
      create: { publicationId: opts.publicationId, hashtagId: hashtag.id },
      update: {},
    });
  }

  if (mentionHandles.length > 0) {
    const profiles = await prisma.redeTesteProfile.findMany({
      where: {
        handle: { in: mentionHandles },
        userId: { not: opts.authorId },
      },
      select: { userId: true, handle: true, tenantId: true },
    });

    for (const p of profiles) {
      await prisma.redeTesteMention.create({
        data: {
          publicationId: opts.publicationId,
          mentionedUserId: p.userId,
        },
      });
      await dispatchJqNotification(prisma, {
        tenantId: p.tenantId,
        userId: p.userId,
        type: "MENTION",
        actorId: opts.authorId,
        publicationId: opts.publicationId,
      });
    }
  }

  if (opts.parentId) {
    const parent = await prisma.redeTestePublication.findUnique({
      where: { id: opts.parentId },
      select: { authorId: true, tenantId: true },
    });
    if (parent && parent.authorId !== opts.authorId) {
      await dispatchJqNotification(prisma, {
        tenantId: parent.tenantId,
        userId: parent.authorId,
        type: "REPLY",
        actorId: opts.authorId,
        publicationId: opts.publicationId,
      });
    }
  }
}

export async function resolveMentionPreview(
  prisma: PrismaClient,
  tenantId: string,
  handle: string,
) {
  const h = normalizeJqHandle(handle);
  return prisma.redeTesteProfile.findFirst({
    where: { tenantId, handle: h },
    select: { handle: true, displayName: true, userId: true },
  });
}
