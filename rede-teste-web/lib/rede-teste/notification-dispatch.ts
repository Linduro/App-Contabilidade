import type { RedeTesteNotificationType, PrismaClient } from "@prisma/client";
import { sendReminderEmail } from "@/lib/mail";
import { jqNotificationTypeLabel } from "@/lib/rede-teste/notification-labels";
import {
  getJqNotificationPrefs,
  isChannelEnabled,
} from "@/lib/rede-teste/notification-prefs";
import { sendJqWebPush } from "@/lib/rede-teste/web-push";

const INACTIVE_MS = 60 * 60 * 1000;
const PUSH_TYPES = new Set<RedeTesteNotificationType>([
  "MENTION",
  "FOLLOW",
  "FOLLOW_REQUEST",
  "REPLY",
]);

export async function dispatchJqNotification(
  prisma: PrismaClient,
  data: {
    tenantId: string;
    userId: string;
    type: RedeTesteNotificationType;
    actorId?: string | null;
    publicationId?: string | null;
  },
) {
  if (data.actorId && data.actorId === data.userId) return;

  const prefs = await getJqNotificationPrefs(prisma, data.userId);

  if (isChannelEnabled(prefs, data.type, "inApp")) {
    await prisma.redeTesteNotification.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        type: data.type,
        actorId: data.actorId ?? null,
        publicationId: data.publicationId ?? null,
      },
    });
  }

  const actor = data.actorId
    ? await prisma.user.findUnique({
        where: { id: data.actorId },
        select: {
          name: true,
          juridiquesProfile: { select: { displayName: true } },
        },
      })
    : null;
  const actorName =
    actor?.juridiquesProfile?.displayName ?? actor?.name ?? "Alguém";
  const action = jqNotificationTypeLabel[data.type] ?? "interagiu com você";
  const title = "Rede Teste";
  const body = `${actorName} ${action}`;

  if (
    isChannelEnabled(prefs, data.type, "push") &&
    PUSH_TYPES.has(data.type)
  ) {
    const url = data.publicationId
      ? `/rede-teste/publicacao/${data.publicationId}`
      : "/rede-teste/notificacoes";
    await sendJqWebPush(prisma, data.userId, { title, body, url });
  }

  if (isChannelEnabled(prefs, data.type, "email")) {
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { email: true, lastLoginAt: true },
    });
    if (!user?.email) return;
    const inactive =
      !user.lastLoginAt ||
      Date.now() - user.lastLoginAt.getTime() > INACTIVE_MS;
    if (!inactive) return;

    const origin = process.env.BETTER_AUTH_URL ?? "https://portal.com";
    await sendReminderEmail(
      user.email,
      title,
      `${body}\n\nVer: ${origin}${data.publicationId ? `/rede-teste/publicacao/${data.publicationId}` : "/rede-teste/notificacoes"}\n\n— Rede Teste / Portal`,
    );
  }
}
