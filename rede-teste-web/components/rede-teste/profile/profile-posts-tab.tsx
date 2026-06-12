"use client";

import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { PublicationList } from "../feed/publication-list";
import type { PublicationItem } from "../feed/publication-card";
import { useJqProfile } from "./profile-context";

type QueryKey =
  | "userPublications"
  | "userReplies"
  | "userMedia"
  | "userLikedPublications"
  | "userHighlights";

type Props = {
  query: QueryKey;
  emptyMessage?: string;
};

function useProfileTimeline(query: QueryKey, handle: string) {
  const pub = trpc.redeTeste.userPublications.useInfiniteQuery(
    { handle, limit: 20 },
    { enabled: query === "userPublications" && handle.length > 0, getNextPageParam: (l) => l.nextCursor ?? undefined },
  );
  const replies = trpc.redeTeste.userReplies.useInfiniteQuery(
    { handle, limit: 20 },
    { enabled: query === "userReplies" && handle.length > 0, getNextPageParam: (l) => l.nextCursor ?? undefined },
  );
  const media = trpc.redeTeste.userMedia.useInfiniteQuery(
    { handle, limit: 20 },
    { enabled: query === "userMedia" && handle.length > 0, getNextPageParam: (l) => l.nextCursor ?? undefined },
  );
  const likes = trpc.redeTeste.userLikedPublications.useInfiniteQuery(
    { handle, limit: 20 },
    { enabled: query === "userLikedPublications" && handle.length > 0, getNextPageParam: (l) => l.nextCursor ?? undefined },
  );
  const highlights = trpc.redeTeste.userHighlights.useInfiniteQuery(
    { handle, limit: 20 },
    { enabled: query === "userHighlights" && handle.length > 0, getNextPageParam: (l) => l.nextCursor ?? undefined },
  );

  if (query === "userReplies") return replies;
  if (query === "userMedia") return media;
  if (query === "userLikedPublications") return likes;
  if (query === "userHighlights") return highlights;
  return pub;
}

export function ProfilePostsTab({ query, emptyMessage }: Props) {
  const profile = useJqProfile();
  const handle = profile.handle;
  const timeline = useProfileTimeline(query, handle);

  const items =
    timeline.data?.pages.flatMap((p) => p.items as PublicationItem[]) ?? [];

  if (timeline.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-6 animate-spin text-[var(--jq-muted)]" />
      </div>
    );
  }

  return (
    <PublicationList
      items={items}
      trackViewInFeed
      hasMore={timeline.hasNextPage}
      loadingMore={timeline.isFetchingNextPage}
      onLoadMore={() => void timeline.fetchNextPage()}
      emptyMessage={
        emptyMessage ??
        (profile.isSelf
          ? "Você ainda não tem conteúdo nesta aba."
          : "Nada para exibir aqui.")
      }
    />
  );
}
