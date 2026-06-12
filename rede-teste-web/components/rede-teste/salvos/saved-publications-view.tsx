"use client";

import Link from "next/link";
import { useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { PublicationList } from "../feed/publication-list";
import type { PublicationItem } from "../feed/publication-card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bookmark, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SavedTab = "posts" | "jurisprudencias";

export function SavedPublicationsView() {
  const [tab, setTab] = useState<SavedTab>("posts");
  const saved = trpc.redeTeste.listBookmarks.useInfiniteQuery(
    { limit: 20 },
    { getNextPageParam: (last) => last.nextCursor ?? undefined },
  );

  const items =
    saved.data?.pages.flatMap((p) => p.items as PublicationItem[]) ?? [];

  const jurisprudencias = items.filter((it) => !!it.juris);
  const posts = items.filter((it) => !it.juris);
  const shown = tab === "jurisprudencias" ? jurisprudencias : posts;

  return (
    <div>
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-[var(--jq-border)] bg-[var(--jq-bg)]/90 px-4 py-3 backdrop-blur-md">
        <Button variant="ghost" size="icon" className="rounded-full" asChild>
          <Link href="/rede-teste" aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Bookmark className="size-5 text-[var(--jq-accent)]" />
          <h1 className="text-lg font-bold">Salvos</h1>
        </div>
      </header>

      <div className="sticky top-[57px] z-10 grid grid-cols-2 border-b border-[var(--jq-border)] bg-[var(--jq-bg)]/90 backdrop-blur-md">
        {(
          [
            { id: "posts" as const, label: "Posts" },
            { id: "jurisprudencias" as const, label: "Jurisprudências" },
          ]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "relative py-3.5 text-sm font-semibold transition hover:bg-[var(--jq-surface)]/60",
              tab === t.id ? "text-[var(--jq-text)]" : "text-[var(--jq-muted)]",
            )}
          >
            {t.label}
            {tab === t.id ? (
              <span className="absolute inset-x-0 bottom-0 mx-auto h-1 w-14 rounded-full bg-[var(--jq-primary)]" />
            ) : null}
          </button>
        ))}
      </div>

      {saved.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-[var(--jq-muted)]" />
        </div>
      ) : (
        <PublicationList
          items={shown}
          trackViewInFeed
          hasMore={saved.hasNextPage}
          loadingMore={saved.isFetchingNextPage}
          onLoadMore={() => void saved.fetchNextPage()}
          emptyMessage={
            tab === "jurisprudencias"
              ? "Nenhuma jurisprudência salva. Publicações que citam um tribunal aparecem aqui ao serem arquivadas."
              : "Nenhuma publicação arquivada. Toque em Arquivar no feed para salvar aqui."
          }
        />
      )}
    </div>
  );
}
