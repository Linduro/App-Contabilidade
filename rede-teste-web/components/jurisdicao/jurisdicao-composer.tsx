"use client";

import { useRef, useState } from "react";
import {
  AlignLeft,
  Image as ImageIcon,
  Quote,
  Link2,
  MessageSquare,
  Film,
  Music,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc-client";
import {
  type JrdPost,
  type JrdPostType,
  jrdUploadAudio,
  jrdUploadImage,
} from "./jurisdicao-utils";

const TYPES: { type: JrdPostType; label: string; icon: typeof AlignLeft }[] = [
  { type: "TEXT", label: "Texto", icon: AlignLeft },
  { type: "PHOTO", label: "Fotos", icon: ImageIcon },
  { type: "QUOTE", label: "Citação", icon: Quote },
  { type: "LINK", label: "Link", icon: Link2 },
  { type: "CHAT", label: "Chat", icon: MessageSquare },
  { type: "VIDEO", label: "Vídeo", icon: Film },
  { type: "AUDIO", label: "Áudio", icon: Music },
];

const inputCls =
  "w-full rounded-[3px] border border-white/15 bg-neutral-800 px-3 py-2 text-[15px] text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-white/40";

type Props = {
  accent: string;
  onCreated: (post: JrdPost) => void;
};

export function JurisdicaoComposer({ accent, onCreated }: Props) {
  const [type, setType] = useState<JrdPostType>("TEXT");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [quoteSource, setQuoteSource] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);

  const create = trpc.jurisdicao.createPost.useMutation({
    onSuccess: (post) => {
      onCreated(post as unknown as JrdPost);
      setTitle("");
      setBody("");
      setImageUrls([]);
      setAudioUrl(null);
      setQuoteSource("");
      setLinkUrl("");
      setVideoUrl("");
      setTagsInput("");
      setType("TEXT");
      toast.success("Publicado na sua Jurisdição");
    },
    onError: (e) => toast.error(e.message),
  });

  async function onPickImages(files: FileList) {
    setUploading(true);
    try {
      const remaining = Math.max(0, 10 - imageUrls.length);
      const list = Array.from(files).slice(0, remaining);
      const urls = await Promise.all(list.map((f) => jrdUploadImage(f)));
      setImageUrls((prev) => [...prev, ...urls].slice(0, 10));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  async function onPickAudio(file: File) {
    setUploading(true);
    try {
      const url = await jrdUploadAudio(file);
      setAudioUrl(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no upload do áudio");
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    const tags = tagsInput
      .split(/[,\n]/)
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean)
      .slice(0, 20);
    const normUrl = (u: string) => {
      const v = u.trim();
      if (!v) return undefined;
      return /^https?:\/\//i.test(v) ? v : `https://${v}`;
    };
    create.mutate({
      type,
      title: title.trim() || undefined,
      body: body.trim() || undefined,
      imageUrls: imageUrls.length ? imageUrls : undefined,
      audioUrl: audioUrl ?? undefined,
      quoteSource: quoteSource.trim() || undefined,
      linkUrl: normUrl(linkUrl),
      videoUrl: normUrl(videoUrl),
      tags,
    });
  }

  return (
    <div className="rounded-[3px] border border-white/10 bg-neutral-900 text-neutral-100 shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
      <div className="flex flex-wrap border-b border-white/10">
        {TYPES.map((t) => {
          const Icon = t.icon;
          const active = type === t.type;
          return (
            <button
              key={t.type}
              type="button"
              onClick={() => setType(t.type)}
              className="flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-sm font-semibold"
              style={active ? { background: accent, color: "#fff" } : { color: "#aaa" }}
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3 p-4">
        {(type === "TEXT" || type === "CHAT" || type === "LINK" || type === "AUDIO") && (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={type === "LINK" ? "Título do link (opcional)" : "Título (opcional)"}
            className={`${inputCls} text-lg font-bold`}
          />
        )}

        {type === "PHOTO" && (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void onPickImages(e.target.files);
                e.target.value = "";
              }}
            />
            {imageUrls.length ? (
              <div className="mb-2 grid grid-cols-3 gap-2">
                {imageUrls.map((u, i) => (
                  <div key={u} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="h-24 w-full rounded-[3px] object-cover" />
                    <button
                      type="button"
                      aria-label="Remover"
                      onClick={() => setImageUrls((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5 text-white"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-[3px] border border-dashed border-white/30 px-3 py-2 text-sm text-neutral-200"
              disabled={uploading || imageUrls.length >= 10}
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
              {imageUrls.length ? "Adicionar mais fotos" : "Enviar fotos (photoset)"}
            </button>
          </div>
        )}

        {type === "AUDIO" && (
          <div className="space-y-2">
            <input
              ref={audioRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPickAudio(f);
                e.target.value = "";
              }}
            />
            {audioUrl ? (
              <div className="flex items-center gap-2">
                <audio src={audioUrl} controls className="w-full" />
                <button
                  type="button"
                  aria-label="Remover áudio"
                  onClick={() => setAudioUrl(null)}
                  className="rounded-full bg-black/60 p-1 text-white"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => audioRef.current?.click()}
              className="flex items-center gap-2 rounded-[3px] border border-dashed border-white/30 px-3 py-2 text-sm text-neutral-200"
              disabled={uploading}
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Music className="size-4" />}
              {audioUrl ? "Trocar áudio" : "Enviar áudio (MP3, OGG, WAV)"}
            </button>
          </div>
        )}

        {type === "LINK" && (
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://exemplo.com"
            className={inputCls}
          />
        )}

        {type === "VIDEO" && (
          <input
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="URL do vídeo (YouTube, Vimeo…)"
            className={inputCls}
          />
        )}

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={type === "QUOTE" ? 3 : type === "CHAT" ? 5 : 4}
          placeholder={placeholderFor(type)}
          className={`${inputCls} resize-y`}
        />

        {type === "QUOTE" && (
          <input
            value={quoteSource}
            onChange={(e) => setQuoteSource(e.target.value)}
            placeholder="Fonte da citação (ex: STF, ADI 1234)"
            className={inputCls}
          />
        )}

        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="#tags separadas por vírgula"
          className={inputCls}
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={create.isPending || uploading}
            className="rounded-[3px] px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: accent }}
          >
            {create.isPending ? "Publicando…" : "Publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function placeholderFor(type: JrdPostType): string {
  switch (type) {
    case "QUOTE":
      return "Digite a citação…";
    case "CHAT":
      return "Fulano: oi\nBeltrano: olá!";
    case "LINK":
      return "Descrição do link (opcional)";
    case "PHOTO":
      return "Legenda das fotos (opcional)";
    case "VIDEO":
      return "Legenda do vídeo (opcional)";
    case "AUDIO":
      return "Descrição do áudio (opcional)";
    case "TEXT":
    default:
      return "Escreva o que quiser…";
  }
}
