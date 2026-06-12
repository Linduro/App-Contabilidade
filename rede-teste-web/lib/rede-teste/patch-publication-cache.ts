export type PublicationMetricsPatch = {
  publicationId: string;
  likesCount: number;
  viewsCount: number;
  repostsCount: number;
  repliesCount: number;
  bookmarksCount: number;
};

type PubItem = { id: string } & Partial<PublicationMetricsPatch>;

type InfinitePage = { items: PubItem[] };
type InfiniteData = { pages: InfinitePage[] };

type RedeTesteUtils = {
  juridiques: {
    getPublication: {
      setData: (
        input: { id: string },
        updater: (old: PubItem | undefined) => PubItem | undefined,
      ) => void;
    };
    feed: {
      setInfiniteData: (
        input: { tab: string; limit: number },
        updater: (old: InfiniteData | undefined) => InfiniteData | undefined,
      ) => void;
    };
    listBookmarks: {
      setInfiniteData: (
        input: { limit: number },
        updater: (old: InfiniteData | undefined) => InfiniteData | undefined,
      ) => void;
    };
  };
};

function patchItems(items: PubItem[], patch: PublicationMetricsPatch): PubItem[] {
  return items.map((it) =>
    it.id === patch.publicationId
      ? {
          ...it,
          likesCount: patch.likesCount,
          viewsCount: patch.viewsCount,
          repostsCount: patch.repostsCount,
          repliesCount: patch.repliesCount,
          bookmarksCount: patch.bookmarksCount,
        }
      : it,
  );
}

/** Atualiza contadores da publicação em feeds infinitos e detalhe (SSE). */
export function patchPublicationMetricsInCaches(
  utils: RedeTesteUtils,
  data: PublicationMetricsPatch,
) {
  void utils.juridiques.getPublication.setData({ id: data.publicationId }, (old) =>
    old ? { ...old, ...data } : old,
  );

  const patchInfinite = (
    input: { tab: string; limit: number },
    setter: RedeTesteUtils["juridiques"]["feed"]["setInfiniteData"],
  ) => {
    setter(input, (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: patchItems(page.items, data),
        })),
      };
    });
  };

  patchInfinite({ tab: "for-you", limit: 20 }, utils.juridiques.feed.setInfiniteData);
  patchInfinite(
    { tab: "following", limit: 20 },
    utils.juridiques.feed.setInfiniteData,
  );

  utils.juridiques.listBookmarks.setInfiniteData({ limit: 20 }, (old) => {
    if (!old) return old;
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        items: patchItems(page.items, data),
      })),
    };
  });
}
