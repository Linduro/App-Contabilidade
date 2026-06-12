/** Garante URL estática distinta da animada (GIPHY: .gif → w.webp). */
export function ensureGifStillUrl(animatedUrl: string, stillUrl?: string | null): string {
  if (stillUrl && stillUrl !== animatedUrl) return stillUrl;
  try {
    const u = new URL(animatedUrl);
    const host = u.hostname.replace(/^media\d?\./, "media.");
    if (host.includes("giphy.com") && /\.gif$/i.test(u.pathname)) {
      u.pathname = u.pathname.replace(/\.gif$/i, "w.webp");
      return u.toString();
    }
  } catch {
    /* ignore */
  }
  return stillUrl ?? animatedUrl;
}
