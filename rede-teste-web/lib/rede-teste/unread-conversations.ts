import type { PrismaClient } from "@prisma/client";

/** Contagem de não lidas por conversa em uma única passagem (evita N+1). */
export async function batchUnreadByConversation(
  prisma: PrismaClient,
  userId: string,
  memberships: { conversationId: string; lastReadAt: Date | null }[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!memberships.length) return map;

  const lastRead = new Map(
    memberships.map((m) => [m.conversationId, m.lastReadAt]),
  );
  const convIds = memberships.map((m) => m.conversationId);

  const messages = await prisma.redeTesteMessage.findMany({
    where: {
      conversationId: { in: convIds },
      senderId: { not: userId },
    },
    select: { conversationId: true, createdAt: true },
  });

  for (const msg of messages) {
    const since = lastRead.get(msg.conversationId);
    if (since && msg.createdAt <= since) continue;
    map.set(msg.conversationId, (map.get(msg.conversationId) ?? 0) + 1);
  }

  return map;
}
