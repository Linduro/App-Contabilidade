import { ensureGifStillUrl } from "@/lib/rede-teste/gif-preview-urls";

export type TenorGif = {
  id: string;
  url: string;
  stillUrl: string;
  animatedUrl: string;
  previewUrl: string;
  title: string;
};

type TenorMedia = {
  url?: string;
  preview?: string;
};

type TenorResult = {
  id: string;
  title?: string;
  media_formats?: Record<string, TenorMedia>;
};

function pickGifUrl(formats: Record<string, TenorMedia> | undefined): {
  url: string;
  still: string;
  animated: string;
} | null {
  if (!formats) return null;
  const gif =
    formats.gif?.url ??
    formats.mediumgif?.url ??
    formats.tinygif?.url ??
    formats.nanogif?.url;
  const animated =
    formats.tinygif?.url ??
    formats.nanogif?.url ??
    formats.mediumgif?.url ??
    gif;
  const still = ensureGifStillUrl(animated, formats.gifpreview?.url);
  if (!gif) return null;
  return { url: gif, still, animated };
}

export async function searchTenorGifs(
  query: string,
  opts: { limit?: number; pos?: string } = {},
): Promise<{ gifs: TenorGif[]; next?: string }> {
  const key = process.env.TENOR_API_KEY;
  if (!key) throw new Error("Busca de GIF indisponível no momento.");

  const limit = opts.limit ?? 20;
  const endpoint = query.trim()
    ? "https://tenor.googleapis.com/v2/search"
    : "https://tenor.googleapis.com/v2/featured";

  const params = new URLSearchParams({
    key,
    client_key: "juridiques",
    limit: String(limit),
    media_filter: "gif,tinygif",
    locale: "pt_BR",
  });
  if (query.trim()) params.set("q", query.trim());
  if (opts.pos) params.set("pos", opts.pos);

  const { withCircuitBreaker } = await import("@/lib/circuit-breaker");
  const res = await withCircuitBreaker("tenor", () =>
    fetch(`${endpoint}?${params}`, { next: { revalidate: 300 } }),
  );
  if (!res.ok) throw new Error("Falha ao buscar GIFs.");
  const data = (await res.json()) as { results?: TenorResult[]; next?: string };

  const gifs: TenorGif[] = [];
  for (const r of data.results ?? []) {
    const picked = pickGifUrl(r.media_formats);
    if (!picked) continue;
    gifs.push({
      id: r.id,
      url: picked.url,
      stillUrl: picked.still,
      animatedUrl: picked.animated,
      previewUrl: picked.animated,
      title: r.title ?? "",
    });
  }

  return { gifs, next: data.next };
}
