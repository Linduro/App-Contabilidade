"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc-client";
import { PublicationComposer } from "../composer/publication-composer";
import { PublicationList } from "./publication-list";
import { PublicationCard, type PublicationItem } from "./publication-card";
import { PublicationMetrics } from "./publication-metrics";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useState } from "react";
import { JqQueryState } from "../shared/jq-query-state";

type Props = {
  publicationId: string;
};

export function PublicationThread({ publicationId }: Props) {
  const me = trpc.redeTeste.me.useQuery();
  const pub = trpc.redeTeste.getPublication.useQuery(
    { id: publicationId },
    { retry: 2 },
  );
  const replies = trpc.redeTeste.replies.useInfiniteQuery(
    { parentId: publicationId, limit: 30 },
    { getNextPageParam: (last) => last.nextCursor ?? undefined },
  );

  const [parentPatch, setParentPatch] = useState<Partial<PublicationItem>>({});
  const parent = pub.data ? { ...pub.data, ...parentPatch } : null;

  const replyItems = replies.data?.pages.flatMap((p) => p.items as PublicationItem[]) ?? [];

  const user = {
    name: me.data?.displayName ?? "Você",
    image: me.data?.image ?? null,
  };

  return (
    <div>
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-[var(--jq-border)] bg-[var(--jq-bg)]/90 px-4 py-3 backdrop-blur-md">
        <Button variant="ghost" size="icon" className="rounded-full" asChild>
          <Link href="/rede-teste" aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-lg font-bold">Publicação</h1>
      </header>

      <JqQueryState
        isLoading={pub.isLoading}
        isError={pub.isError || (!pub.isLoading && !parent)}
        error={pub.error}
        onRetry={() => void pub.refetch()}
        errorFallback="Não foi possível carregar esta publicação."
      >
      {parent ? (
        <>
          <PublicationMetrics
            repliesCount={parent.repliesCount}
            repostsCount={parent.repostsCount}
            quotesCount={parent.quotesCount ?? 0}
            likesCount={parent.likesCount}
            bookmarksCount={parent.bookmarksCount ?? 0}
            viewsCount={parent.viewsCount}
          />
          <PublicationCard
            item={parent}
            registerViewOnMount
            onUpdate={(patch) => setParentPatch((prev) => ({ ...prev, ...patch }))}
          />
        </>
      ) : null}
      </JqQueryState>

      {parent ? (
        <>
          <PublicationComposer
            user={user}
            parentId={publicationId}
            parentAllowGifReplies={parent.allowGifReplies}
            placeholder="Escreva sua resposta…"
          />
          {replies.data && replyItems.length > 0 ? (
            <h2 className="border-b border-[var(--jq-border)] px-4 py-3 text-sm font-bold text-[var(--jq-muted)]">
              Respostas
            </h2>
          ) : null}
          {replies.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-[var(--jq-muted)]" />
            </div>
          ) : (
            <PublicationList
              items={replyItems}
              hasMore={replies.hasNextPage}
              loadingMore={replies.isFetchingNextPage}
              onLoadMore={() => void replies.fetchNextPage()}
              emptyMessage="Seja o primeiro a responder."
            />
          )}
        </>
      ) : null}
    </div>
  );
}
