/** Normaliza URL de mídia armazenada (sem dependências Node). */
export function normalizeMediaUrl(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (stored.startsWith("/uploads/")) return stored;
  try {
    const u = new URL(stored);
    if (u.pathname.startsWith("/uploads/")) {
      return `${u.pathname}${u.search}`;
    }
  } catch {
    /* não é URL absoluta */
  }
  return stored;
}
