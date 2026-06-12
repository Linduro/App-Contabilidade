import type { PrismaClient } from "@prisma/client";
import { syncJqPublicationMeta } from "@/lib/rede-teste/publication-meta";

export async function publishDueScheduledPublications(prisma: PrismaClient, limit = 50) {
  const now = new Date();
  const due = await prisma.redeTestePublication.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: now },
      deletedAt: null,
    },
    take: limit,
    select: {
      id: true,
      tenantId: true,
      authorId: true,
      content: true,
      parentId: true,
    },
  });

  for (const pub of due) {
    await prisma.redeTestePublication.update({
      where: { id: pub.id },
      data: { status: "PUBLISHED", scheduledAt: null },
    });
    await syncJqPublicationMeta(prisma, {
      tenantId: pub.tenantId,
      publicationId: pub.id,
      authorId: pub.authorId,
      content: pub.content,
      parentId: pub.parentId,
    });
  }

  return { published: due.length };
}
