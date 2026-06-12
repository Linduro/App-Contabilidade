"use client";

import { useCallback, useEffect, useState } from "react";
import { PublicationCard, type PublicationItem } from "./publication-card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type Props = {
  items: PublicationItem[];
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  emptyMessage?: string;
  trackViewInFeed?: boolean;
};

export function PublicationList({
  items,
  hasMore,
  loadingMore,
  onLoadMore,
  emptyMessage = "Nenhuma publicação ainda.",
  trackViewInFeed = false,
}: Props) {
  const [local, setLocal] = useState<PublicationItem[]>(items);

  useEffect(() => {
    setLocal(items);
  }, [items]);

  const updateItem = useCallback((id: string, patch: Partial<PublicationItem>) => {
    setLocal((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  if (local.length === 0) {
    return (
      <p className="px-6 py-12 text-center text-sm text-[var(--jq-muted)]">{emptyMessage}</p>
    );
  }

  return (
    <>
      {local.map((item) => (
        <PublicationCard
          key={item.id}
          item={item}
          trackViewInFeed={trackViewInFeed}
          onUpdate={(patch) => updateItem(item.id, patch)}
        />
      ))}
      {hasMore && onLoadMore ? (
        <div className="flex justify-center py-6">
          <Button
            variant="outline"
            className="rounded-full"
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Carregar mais
          </Button>
        </div>
      ) : null}
    </>
  );
}
