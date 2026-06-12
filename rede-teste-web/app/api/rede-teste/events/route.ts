import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countUnreadJqMessages } from "@/lib/rede-teste/unread-dms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_MS = 3_000;

type PubSnapshot = {
  likesCount: number;
  viewsCount: number;
  repostsCount: number;
  repliesCount: number;
  bookmarksCount: number;
};

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const url = new URL(req.url);
  const publicationId = url.searchParams.get("publicationId")?.trim() || null;
  const publicationIds = (url.searchParams.get("publicationIds") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  const watchIds = publicationId
    ? [publicationId, ...publicationIds.filter((id) => id !== publicationId)]
    : publicationIds;

  let lastNotif = -1;
  let lastDm = -1;
  const lastPubById = new Map<string, PubSnapshot>();

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      send("connected", { ok: true });

      const tick = async () => {
        try {
          const notifCount = await prisma.redeTesteNotification.count({
            where: { userId, readAt: null },
          });
          if (notifCount !== lastNotif) {
            lastNotif = notifCount;
            send("notifications", { count: notifCount });
          }

          const dmCount = await countUnreadJqMessages(prisma, userId);
          if (dmCount !== lastDm) {
            lastDm = dmCount;
            send("messages", { unreadCount: dmCount });
          }

          if (watchIds.length > 0) {
            const pubs = await prisma.redeTestePublication.findMany({
              where: { id: { in: watchIds }, deletedAt: null },
              select: {
                id: true,
                likesCount: true,
                viewsCount: true,
                repostsCount: true,
                repliesCount: true,
                bookmarksCount: true,
              },
            });
            for (const pub of pubs) {
              const snap: PubSnapshot = {
                likesCount: pub.likesCount,
                viewsCount: pub.viewsCount,
                repostsCount: pub.repostsCount,
                repliesCount: pub.repliesCount,
                bookmarksCount: pub.bookmarksCount,
              };
              const prev = lastPubById.get(pub.id);
              const changed =
                !prev ||
                prev.likesCount !== snap.likesCount ||
                prev.viewsCount !== snap.viewsCount ||
                prev.repostsCount !== snap.repostsCount ||
                prev.repliesCount !== snap.repliesCount ||
                prev.bookmarksCount !== snap.bookmarksCount;
              if (changed) {
                lastPubById.set(pub.id, snap);
                send("publication", { publicationId: pub.id, ...snap });
              }
            }
          }
        } catch {
          send("error", { message: "poll_failed" });
        }
      };

      void tick();
      const interval = setInterval(() => void tick(), POLL_MS);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* já fechado */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
