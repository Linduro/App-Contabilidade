"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { useEffect, useState, useCallback } from "react";
import { PublicationComposer } from "../composer/publication-composer";
import { PublicationCard, type PublicationItem } from "../feed/publication-card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { CommunitySettingsPanel } from "./community-settings-panel";

type Props = {
  slug: string;
};

export function CommunityFeedView({ slug }: Props) {
  const me = trpc.redeTeste.me.useQuery();
  const user = {
    name: me.data?.displayName ?? "Você",
    image: me.data?.image ?? null,
  };
  const feed = trpc.redeTeste.communityFeed.useInfiniteQuery(
    { slug, limit: 20 },
    {
      getNextPageParam: (last) => last.nextCursor ?? undefined,
    },
  );

  const community = feed.data?.pages[0]?.community;
  const [items, setItems] = useState<PublicationItem[]>([]);

  useEffect(() => {
    if (!feed.data) return;
    setItems(feed.data.pages.flatMap((p) => p.items as PublicationItem[]));
  }, [feed.data]);

  const updateItem = useCallback((id: string, patch: Partial<PublicationItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  return (
    <div className="min-h-full border-x border-[var(--jq-border)]">
      <header className="sticky top-0 z-10 border-b border-[var(--jq-border)] bg-[var(--jq-bg)]/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/rede-teste/comunidades"
            className="rounded-full p-2 hover:bg-[var(--jq-surface)]"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">{community?.name ?? slug}</h1>
            {community?.description ? (
              <p className="text-sm text-[var(--jq-muted)]">{community.description}</p>
            ) : null}
            {community ? (
              <CommunitySettingsPanel
                communityId={community.id}
                name={community.name}
                description={community.description}
                isMember={community.isMember}
                memberRole={community.memberRole}
                onUpdated={() => void feed.refetch()}
              />
            ) : null}
          </div>
        </div>
      </header>

      {community?.isMember ? (
        <PublicationComposer
          user={user}
          communityId={community.id}
          enablePoll
        />
      ) : (
        <p className="border-b border-[var(--jq-border)] p-4 text-sm text-[var(--jq-muted)]">
          Entre na comunidade para publicar.
        </p>
      )}

      {feed.isLoading ? (
        <p className="p-8 text-center text-[var(--jq-muted)]">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="p-8 text-center text-[var(--jq-muted)]">Nenhuma publicação nesta comunidade.</p>
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
                className="rounded-full"
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
