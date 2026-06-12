"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { youTubeThumb } from "@/lib/rede-teste/youtube";

type Props = {
  id: string;
  title?: string | null;
  description?: string | null;
  className?: string;
};

/**
 * Embed leve do YouTube (lite). Mostra só a thumbnail (CDN do YouTube, zero carga no VPS)
 * com botão de play. Ao passar o mouse (desktop), toca uma prévia mudo em loop —
 * o vídeo é transmitido pelos servidores do YouTube, sem custo para o VPS.
 * Ao clicar, abre com som. No mobile (sem hover), fica só a thumbnail + resumo.
 */
export function YouTubeEmbed({ id, title, description, className }: Props) {
  const [playing, setPlaying] = useState(false);
  const [preview, setPreview] = useState(false);
  const hoverTimer = useRef<number | null>(null);

  function startPreview() {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    // pequeno atraso evita carregar a prévia ao só passar de raspão
    hoverTimer.current = window.setTimeout(() => setPreview(true), 220);
  }
  function stopPreview() {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    setPreview(false);
  }

  const showSummary = (title || description) && !preview && !playing;

  return (
    <div
      className={
        className ??
        "group relative mt-3 aspect-video w-full overflow-hidden rounded-2xl border border-[var(--jq-border)] bg-black"
      }
      onMouseEnter={startPreview}
      onMouseLeave={stopPreview}
    >
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title ?? "Vídeo do YouTube"}
          className="absolute inset-0 size-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          className="absolute inset-0 block size-full"
          aria-label={title ? `Assistir: ${title}` : "Assistir no YouTube"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setPlaying(true);
          }}
        >
          {preview ? (
            // Prévia mudo em loop, servida pelo YouTube (não pesa no VPS).
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${id}&modestbranding=1&rel=0&playsinline=1`}
              title=""
              tabIndex={-1}
              aria-hidden
              className="pointer-events-none absolute inset-0 size-full"
              allow="autoplay; encrypted-media"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={youTubeThumb(id)}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover"
            />
          )}

          <span
            className={`pointer-events-none absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/70 text-white transition group-hover:scale-110 group-hover:bg-red-600 ${
              preview ? "opacity-0" : "opacity-100"
            }`}
          >
            <Play className="size-7 translate-x-0.5 fill-white" />
          </span>

          {showSummary ? (
            <span className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 text-left text-white">
              {title ? (
                <span className="line-clamp-1 text-sm font-bold">{title}</span>
              ) : null}
              {description ? (
                <span className="line-clamp-2 text-xs text-white/80 max-sm:line-clamp-1">
                  {description}
                </span>
              ) : null}
            </span>
          ) : null}
        </button>
      )}
    </div>
  );
}
