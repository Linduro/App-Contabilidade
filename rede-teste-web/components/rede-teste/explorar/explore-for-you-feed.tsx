"use client";

import { useCallback, useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { PublicationCard, type PublicationItem } from "../feed/publication-card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function ExploreForYouFeed() {
  const [items, setItems] = useState<PublicationItem[]>([]);
  const feed = trpc.redeTeste.feed.useInfiniteQuery(
    { tab: "for-you", limit: 20 },
    { getNextPageParam: (last) => last.nextCursor ?? undefined },
  );

  useEffect(() => {
    if (!feed.data) return;
    setItems(feed.data.pages.flatMap((p) => p.items as PublicationItem[]));
  }, [feed.data]);

  const updateItem = useCallback((id: string, patch: Partial<PublicationItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  return (
    <div>
      <div className="border-b border-[var(--jq-border)] px-4 py-3">
        <p className="text-sm font-bold">Para você</p>
        <p className="text-xs text-[var(--jq-muted)]">
          Publicações que o algoritmo acha que você vai gostar e que você ainda não viu.
        </p>
      </div>

      {feed.isLoading ? (
        <p className="flex items-center justify-center gap-2 p-8 text-[var(--jq-muted)]">
          <Loader2 className="size-5 animate-spin" />
          Carregando…
        </p>
      ) : items.length === 0 ? (
        <p className="p-8 text-center text-sm text-[var(--jq-muted)]">
          Ainda não há recomendações. Siga litisconsortes e interaja com publicações.
        </p>
      ) : (
        <>
          {items.map((item) => (
            <PublicationCard
              key={item.id}
              item={item}
              trackViewInFeed
              onUpdate={(patch) => updateItem(item.id, patch)}
            />
          ))}
          {feed.hasNextPage ? (
            <div className="flex justify-center py-6">
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
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
