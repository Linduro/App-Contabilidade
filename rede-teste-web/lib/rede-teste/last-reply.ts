import type { PrismaClient } from "@prisma/client";

export type JqLastReply = {
  id: string;
  content: string;
  createdAt: Date;
  media: { url: string; type: string }[];
  author: {
    name: string;
    handle: string;
    image: string | null;
  };
};

/** Último comentário de qualquer autor em cada post (1 query em lote). */
export async function loadLastRepliesBatch(
  prisma: PrismaClient,
  parentIds: string[],
): Promise<Map<string, JqLastReply>> {
  const unique = [...new Set(parentIds)];
  if (!unique.length) return new Map();

  const rows = await prisma.redeTestePublication.findMany({
    where: {
      parentId: { in: unique },
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
      author: {
        select: {
          name: true,
          image: true,
          juridiquesProfile: { select: { displayName: true, handle: true } },
        },
      },
    },
  });

  const map = new Map<string, JqLastReply>();
  for (const row of rows) {
    if (!row.parentId || map.has(row.parentId)) continue;
    const profile = row.author.juridiquesProfile;
    map.set(row.parentId, {
      id: row.id,
      content: row.content,
      createdAt: row.createdAt,
      media: row.media,
      author: {
        name: profile?.displayName ?? row.author.name,
        handle: profile?.handle ?? "",
        image: row.author.image,
      },
    });
  }
  return map;
}
