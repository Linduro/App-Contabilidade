"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { useJqScroll } from "../jq-scroll-context";
import { FeedTabs } from "./feed-tabs";
import { PublicationComposer } from "../composer/publication-composer";
import { PublicationCard, type PublicationItem } from "./publication-card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type Tab = "for-you" | "following";

/**
 * Feed central estilo X: rola com a janela; abas sticky no topo.
 */
export function RedeTesteFeed() {
  const [tab, setTab] = useState<Tab>("for-you");
  const [items, setItems] = useState<PublicationItem[]>([]);
  // Posts criados nesta sessão ficam fixos no topo até a página ser recarregada.
  const [pinned, setPinned] = useState<PublicationItem[]>([]);
  const { scrolled } = useJqScroll();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const me = trpc.redeTeste.me.useQuery();

  const feed = trpc.redeTeste.feed.useInfiniteQuery(
    { tab, limit: 20 },
    {
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  );

  useEffect(() => {
    if (!feed.data) return;
    setItems(feed.data.pages.flatMap((p) => p.items as PublicationItem[]));
  }, [feed.data]);

  const visibleItems = useMemo(() => {
    const pinnedIds = new Set(pinned.map((p) => p.id));
    return [...pinned, ...items.filter((it) => !pinnedIds.has(it.id))];
  }, [pinned, items]);

  const updateItem = useCallback((id: string, patch: Partial<PublicationItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
    setPinned((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  }, []);

  const handlePublished = useCallback((created?: PublicationItem) => {
    if (!created) return;
    setPinned((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
  }, []);

  const user = {
    id: me.data?.userId,
    name: me.data?.displayName ?? "Você",
    image: me.data?.image ?? null,
  };

  const meForCard = me.data
    ? { displayName: me.data.displayName, image: me.data.image }
    : null;

  return (
    <main id="jq-main-feed" className="jq-feed">
      <FeedTabs value={tab} onChange={setTab} scrolled={scrolled} />

      <div className="jq-feed-posts">
        <PublicationComposer user={user} clearDraftOnLeave onPublished={handlePublished} />

        <div aria-live="polite" aria-atomic="false" className="sr-only">
          {feed.isFetching ? "Carregando publicações" : ""}
        </div>

        {feed.isLoading ? (
          <FeedSkeleton />
        ) : visibleItems.length === 0 ? (
          <EmptyFeed tab={tab} />
        ) : (
          <>
            {visibleItems.map((item) => (
              <PublicationCard
                key={item.id}
                item={item}
                me={meForCard}
                trackViewInFeed
                onUpdate={(patch) => updateItem(item.id, patch)}
              />
            ))}
            <div ref={loadMoreRef} className="flex justify-center py-6">
              {feed.hasNextPage ? (
                <Button
                  variant="outline"
                  className="jq-btn-outline rounded-full"
                  disabled={feed.isFetchingNextPage}
                  onClick={() => void feed.fetchNextPage()}
                >
                  {feed.isFetchingNextPage ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Carregar mais
                </Button>
              ) : null}
            </div>
          </>
        )}

        {feed.isError ? (
          <div className="p-8 text-center">
            <p className="text-[var(--jq-muted)]">Não foi possível carregar o feed.</p>
            <Button className="mt-4 rounded-full" onClick={() => void feed.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function FeedSkeleton() {
  return (
    <div className="divide-y divide-[var(--jq-border)]">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 px-4 py-4 animate-pulse">
          <div className="size-10 rounded-full bg-[var(--jq-surface)]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-[var(--jq-surface)]" />
            <div className="h-16 rounded bg-[var(--jq-surface)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyFeed({ tab }: { tab: Tab }) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-lg font-bold text-[var(--jq-primary)]">Bem-vindo ao Rede Teste</p>
      <p className="mt-2 text-sm text-[var(--jq-muted)]">
        {tab === "following"
          ? "Siga profissionais na rede para ver as publicações deles aqui."
          : "Seja o primeiro a publicar o que está acontecendo no Direito."}
      </p>
    </div>
  );
}
