"use client";

import Link from "next/link";
import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { JqAvatar } from "../shared/jq-avatar";
import { formatJqRelativeTime } from "@/lib/rede-teste/format";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { jqProfilePath } from "@/lib/rede-teste/profile-path";
import { JqQueryState } from "../shared/jq-query-state";
import {
  formatGroupedActors,
} from "@/lib/rede-teste/group-notifications";
import { jqNotificationActionLabel } from "@/lib/rede-teste/notification-labels";

type Tab = "all" | "mentions" | "likes" | "followers";

const tabs: { id: Tab; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "mentions", label: "Menções" },
  { id: "likes", label: "Curtidas" },
  { id: "followers", label: "Seguidores" },
];

export function NotificationsView() {
  const [tab, setTab] = useState<Tab>("all");
  const utils = trpc.useUtils();
  const list = trpc.redeTeste.notifications.useInfiniteQuery(
    { limit: 30, filter: tab },
    { getNextPageParam: (last) => last.nextCursor ?? undefined },
  );

  const markAll = trpc.redeTeste.markNotificationsRead.useMutation({
    onSuccess: () => {
      void utils.redeTeste.notifications.invalidate();
      void utils.redeTeste.unreadNotificationCount.invalidate();
    },
  });

  const markOne = trpc.redeTeste.markNotificationRead.useMutation({
    onSuccess: () => {
      void utils.redeTeste.notifications.invalidate();
      void utils.redeTeste.unreadNotificationCount.invalidate();
    },
  });

  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  function hrefFor(item: (typeof items)[0]) {
    if (item.publicationId) return `/rede-teste/publicacao/${item.publicationId}`;
    const actor = item.actors[0];
    if (actor) return jqProfilePath(actor.handle);
    return "/rede-teste";
  }

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-[var(--jq-border)] bg-[var(--jq-bg)]/90 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/rede-teste"
              className="rounded-full p-2 hover:bg-[var(--jq-surface)]"
              aria-label="Voltar"
            >
              <ArrowLeft className="size-5" />
            </Link>
            <h1 className="text-lg font-bold">Notificações</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-[var(--jq-reply)]"
            onClick={() => markAll.mutate()}
          >
            Marcar todas lidas
          </Button>
        </div>
        <nav
          className="flex border-t border-[var(--jq-border)]"
          aria-label="Filtrar notificações"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
                tab === t.id
                  ? "border-b-2 border-[var(--jq-primary)] text-[var(--jq-primary)]"
                  : "text-[var(--jq-muted)] hover:bg-[var(--jq-surface)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <JqQueryState
        isLoading={list.isLoading}
        isError={list.isError}
        error={list.error}
        onRetry={() => void list.refetch()}
        errorFallback="Não foi possível carregar as notificações."
      >
        {items.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--jq-muted)]">
            Nenhuma notificação por enquanto.
          </p>
        ) : (
          <ul>
            {items.map((n) => {
              const unread = !n.readAt;
              const primary = n.actors[0];
              const names = formatGroupedActors(n.actors, n.totalActors);
              const action = jqNotificationActionLabel(n.type, n.totalActors);

              return (
                <li
                  key={n.id}
                  className={`relative border-b border-[var(--jq-border)] px-4 py-3 ${
                    unread ? "bg-[var(--jq-surface)]/50" : ""
                  }`}
                >
                  {unread ? (
                    <span
                      className="absolute left-1 top-1/2 size-2 -translate-y-1/2 rounded-full bg-[var(--jq-primary)]"
                      aria-hidden
                    />
                  ) : null}
                  <Link
                    href={hrefFor(n)}
                    className="flex gap-3 pl-3"
                    onClick={() => {
                      if (unread) markOne.mutate({ ids: n.ids });
                    }}
                  >
                    {primary ? (
                      <JqAvatar src={primary.image} name={primary.name} size="md" />
                    ) : (
                      <div className="size-10 shrink-0 rounded-full bg-[var(--jq-surface)]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-bold">{names}</span> {action}
                      </p>
                      {n.publicationPreview ? (
                        <p className="mt-1 line-clamp-2 text-sm text-[var(--jq-muted)]">
                          {n.publicationPreview}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-[var(--jq-muted)]">
                        {formatJqRelativeTime(n.createdAt)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {list.hasNextPage ? (
          <div className="p-4 text-center">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              Carregar mais
            </Button>
          </div>
        ) : null}
      </JqQueryState>
    </div>
  );
}
