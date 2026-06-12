import type { PrismaClient } from "@prisma/client";
import { log } from "@/lib/logger";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

function vapidConfigured() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY ?? null;
}

export async function sendJqWebPush(
  prisma: PrismaClient,
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!vapidConfigured()) return;

  const subs = await prisma.redeTestePushSubscription.findMany({
    where: { userId },
  });
  if (!subs.length) return;

  let webpush: typeof import("web-push");
  try {
    webpush = await import("web-push");
  } catch {
    log.warn("web-push não instalado; push ignorado");
    return;
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/rede-teste/notificacoes",
  });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.redeTestePushSubscription.delete({ where: { id: sub.id } });
        }
        log.warn("web push falhou", { userId, status });
      }
    }),
  );
}
