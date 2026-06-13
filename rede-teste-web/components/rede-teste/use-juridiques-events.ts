"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { patchPublicationMetricsInCaches } from "@/lib/rede-teste/patch-publication-cache";
import { getWatchedPublicationIds } from "@/lib/rede-teste/watch-publications";

/**
 * SSE leve: notificações, DMs e métricas da publicação aberta.
 */
export function useRedeTesteEvents() {
  const pathname = usePathname();
  const utils = trpc.useUtils();

  const pubMatch = pathname.match(/^\/rede-teste\/publicacao\/([^/]+)/);
  const publicationId = pubMatch?.[1] ?? null;

  const [watchKey, setWatchKey] = useState("");

  useEffect(() => {
    const sync = () => setWatchKey(getWatchedPublicationIds().join(","));
    sync();
    const iv = setInterval(sync, 2_000);
    return () => clearInterval(iv);
  }, [pathname]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (publicationId) params.set("publicationId", publicationId);
    const watched = getWatchedPublicationIds();
    if (watched.length) params.set("publicationIds", watched.join(","));
    const qs = params.toString();
    const url = `/api/rede-teste/events${qs ? `?${qs}` : ""}`;

    const es = new EventSource(url);

    es.addEventListener("notifications", () => {
      void utils.redeTeste.unreadNotificationCount.invalidate();
      void utils.redeTeste.notifications.invalidate();
    });

    es.addEventListener("messages", () => {
      void utils.redeTeste.listConversations.invalidate();
      void utils.redeTeste.unreadDmCount.invalidate();
    });

    es.addEventListener("publication", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as {
          publicationId: string;
          likesCount: number;
          viewsCount: number;
          repostsCount: number;
          repliesCount: number;
          bookmarksCount: number;
        };
        patchPublicationMetricsInCaches(utils, data);
      } catch {
        /* ignore */
      }
    });

    return () => es.close();
  }, [publicationId, watchKey, utils]);
}
