/** Utilidades leves para embed de YouTube (sem carga no VPS). */

/** Extrai o ID do vídeo de uma URL do YouTube (watch, youtu.be, shorts, embed). */
export function parseYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return isValidId(id) ? id : null;
    }
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const v = u.searchParams.get("v");
      if (v && isValidId(v)) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      // /embed/ID, /shorts/ID, /live/ID
      if (
        (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") &&
        isValidId(parts[1] ?? "")
      ) {
        return parts[1]!;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

/** Procura o primeiro link de YouTube em um texto e retorna o ID. */
export function findYouTubeIdInText(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/g);
  if (!match) return null;
  for (const url of match) {
    const id = parseYouTubeId(url);
    if (id) return id;
  }
  return null;
}

/** Thumbnail servida pela CDN do YouTube (zero carga no VPS). */
export function youTubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
