import type { PrismaClient } from "@prisma/client";
import { batchUnreadByConversation } from "@/lib/rede-teste/unread-conversations";

/** Mensagens não lidas em uma conversa (exclui as enviadas pelo próprio usuário). */
export async function countUnreadInJqConversation(
  prisma: PrismaClient,
  userId: string,
  conversationId: string,
  lastReadAt: Date | null,
): Promise<number> {
  const map = await batchUnreadByConversation(prisma, userId, [
    { conversationId, lastReadAt },
  ]);
  return map.get(conversationId) ?? 0;
}

/** Mensagens não lidas em conversas do usuário. */
export async function countUnreadJqMessages(
  prisma: PrismaClient,
  userId: string,
): Promise<number> {
  const memberships = await prisma.redeTesteConversationMember.findMany({
    where: { userId, deletedAt: null },
    select: { conversationId: true, lastReadAt: true },
  });
  if (memberships.length === 0) return 0;

  const map = await batchUnreadByConversation(prisma, userId, memberships);
  let total = 0;
  for (const n of map.values()) total += n;
  return total;
}
