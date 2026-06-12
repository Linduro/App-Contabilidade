import type { PrismaClient } from "@prisma/client";

export type JqViewerLastReply = {
  id: string;
  content: string;
  createdAt: Date;
  media: { url: string; type: string }[];
};

/** Último comentário do viewer em cada post (1 query em lote). */
export async function loadViewerLastRepliesBatch(
  prisma: PrismaClient,
  viewerId: string,
  parentIds: string[],
): Promise<Map<string, JqViewerLastReply>> {
  const unique = [...new Set(parentIds)];
  if (!unique.length) return new Map();

  const rows = await prisma.redeTestePublication.findMany({
    where: {
      parentId: { in: unique },
      authorId: viewerId,
      deletedAt: null,
      status: "PUBLISHED",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      parentId: true,
      content: true,
      createdAt: true,
      media: { select: { url: true, type: true }, orderBy: { order: "asc" } },
    },
  });

  const map = new Map<string, JqViewerLastReply>();
  for (const row of rows) {
    if (!row.parentId || map.has(row.parentId)) continue;
    map.set(row.parentId, {
      id: row.id,
      content: row.content,
      createdAt: row.createdAt,
      media: row.media,
    });
  }
  return map;
}
