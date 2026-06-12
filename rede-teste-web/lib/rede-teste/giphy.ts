import { ensureGifStillUrl } from "@/lib/rede-teste/gif-preview-urls";

export type GifResult = {
  id: string;
  url: string;
  /** Miniatura estática na grade */
  stillUrl: string;
  /** GIF leve para hover / visível na tela */
  animatedUrl: string;
  /** Compat: mesma URL animada (composer após seleção) */
  previewUrl: string;
  title: string;
};

type GiphyImage = { url?: string; width?: string; height?: string };

type GiphyItem = {
  id: string;
  title?: string;
  images?: {
    original?: GiphyImage;
    downsized?: GiphyImage;
    downsized_medium?: GiphyImage;
    fixed_width?: GiphyImage;
    fixed_width_still?: GiphyImage;
    downsized_still?: GiphyImage;
    fixed_width_downsampled?: GiphyImage;
    preview_gif?: GiphyImage;
  };
};

function pickGiphyUrls(item: GiphyItem): { url: string; still: string; animated: string } | null {
  const imgs = item.images;
  if (!imgs) return null;
  const url =
    imgs.downsized_medium?.url ??
    imgs.downsized?.url ??
    imgs.original?.url ??
    imgs.fixed_width?.url;
  if (!url) return null;
  const animated =
    imgs.fixed_width_downsampled?.url ??
    imgs.fixed_width?.url ??
    imgs.preview_gif?.url ??
    url;
  const still = ensureGifStillUrl(
    animated,
    imgs.fixed_width_still?.url ?? imgs.downsized_still?.url,
  );
  return { url, still, animated };
}

/** Busca GIFs no GIPHY (chave gratuita em developers.giphy.com). */
export async function searchGiphyGifs(
  query: string,
  opts: { limit?: number; pos?: string } = {},
): Promise<{ gifs: GifResult[]; next?: string }> {
  const key = process.env.GIPHY_API_KEY;
  if (!key) throw new Error("Busca de GIF indisponível no momento.");

  const limit = opts.limit ?? 20;
  const offset = Number(opts.pos) || 0;
  const trimmed = query.trim();

  const endpoint = trimmed
    ? "https://api.giphy.com/v1/gifs/search"
    : "https://api.giphy.com/v1/gifs/trending";

  const params = new URLSearchParams({
    api_key: key,
    limit: String(limit),
    offset: String(offset),
    rating: "pg-13",
    lang: "pt",
  });
  if (trimmed) params.set("q", trimmed);

  const { withCircuitBreaker } = await import("@/lib/circuit-breaker");
  const res = await withCircuitBreaker("giphy", () =>
    fetch(`${endpoint}?${params}`, { next: { revalidate: 300 } }),
  );
  if (!res.ok) throw new Error("Falha ao buscar GIFs.");
  const data = (await res.json()) as {
    data?: GiphyItem[];
    pagination?: { offset?: number; count?: number; total_count?: number };
  };

  const gifs: GifResult[] = [];
  for (const item of data.data ?? []) {
    const picked = pickGiphyUrls(item);
    if (!picked) continue;
    gifs.push({
      id: item.id,
      url: picked.url,
      stillUrl: picked.still,
      animatedUrl: picked.animated,
      previewUrl: picked.animated,
      title: item.title ?? "",
    });
  }

  const pg = data.pagination;
  const nextOffset =
    pg && typeof pg.total_count === "number"
      ? offset + (pg.count ?? gifs.length)
      : offset + gifs.length;
  const hasMore =
    pg && typeof pg.total_count === "number"
      ? nextOffset < pg.total_count
      : gifs.length >= limit;

  return { gifs, next: hasMore ? String(nextOffset) : undefined };
}
