export type JqLinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

export function parseLinkPreview(raw: unknown): JqLinkPreview | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const url = typeof o.url === "string" ? o.url : null;
  if (!url) return null;
  return {
    url,
    title: typeof o.title === "string" ? o.title : null,
    description: typeof o.description === "string" ? o.description : null,
    image: typeof o.image === "string" ? o.image : null,
    siteName: typeof o.siteName === "string" ? o.siteName : null,
  };
}
