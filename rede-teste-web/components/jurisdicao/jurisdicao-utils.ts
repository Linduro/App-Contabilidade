export type JrdPostType = "TEXT" | "PHOTO" | "QUOTE" | "LINK" | "CHAT" | "VIDEO" | "AUDIO";

export type JrdPost = {
  id: string;
  type: JrdPostType;
  title: string | null;
  body: string | null;
  imageUrl: string | null;
  imageUrls: string[];
  audioUrl: string | null;
  quoteSource: string | null;
  linkUrl: string | null;
  videoUrl: string | null;
  tags: string[];
  likesCount: number;
  reblogsCount: number;
  rebloggedFromHandle: string | null;
  rebloggedFromTitle: string | null;
  createdAt: Date | string;
  viewerLiked: boolean;
  blog: { id: string; handle: string; title: string; avatarUrl: string | null };
};

export function jrdFontStack(font: string | null | undefined): string {
  switch (font) {
    case "sans":
      return "Helvetica, Arial, sans-serif";
    case "mono":
      return "'Courier New', Courier, monospace";
    case "cursive":
      return "'Comic Sans MS', 'Comic Sans', cursive";
    case "serif":
    default:
      return "Georgia, 'Times New Roman', Times, serif";
  }
}

/** Converte URLs de vídeo conhecidas para URL de embed. */
export function jrdVideoEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    return null;
  }
  return null;
}

/** Faz upload de imagem para o Jurisdição. */
export async function jrdUploadImage(file: File): Promise<string> {
  return jrdUploadMedia(file, "image");
}

/** Faz upload de áudio para o Jurisdição. */
export async function jrdUploadAudio(file: File): Promise<string> {
  return jrdUploadMedia(file, "audio");
}

async function jrdUploadMedia(file: File, kind: "image" | "audio"): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const res = await fetch("/api/jurisdicao/media", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Falha no upload");
  return data.url as string;
}

/** Rádios online comuns para tocar automaticamente na Jurisdição. */
export const JRD_RADIOS: { id: string; label: string; url: string }[] = [
  { id: "antena1", label: "Antena 1 (MPB/Pop)", url: "https://antena1.newradio.it/stream" },
  { id: "jovempan", label: "Jovem Pan FM", url: "https://stream.zeno.fm/0r0xa792kwzuv" },
  { id: "lofi", label: "Lo-fi para estudar", url: "https://streams.ilovemusic.de/iloveradio17.mp3" },
  { id: "jazz", label: "Smooth Jazz", url: "https://streams.ilovemusic.de/iloveradio33.mp3" },
  { id: "classica", label: "Clássica", url: "https://live.musopen.org:8085/streamvbr0" },
  { id: "somafm-groove", label: "SomaFM Groove Salad", url: "https://ice1.somafm.com/groovesalad-128-mp3" },
  { id: "somafm-lush", label: "SomaFM Lush", url: "https://ice1.somafm.com/lush-128-mp3" },
];
