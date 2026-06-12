"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { normalizeMediaUrl } from "@/lib/media-url";
import { cn } from "@/lib/utils";

type Media = { id: string; url: string; type: string };

type Props = {
  media: Media[];
  onOpen?: (index: number) => void;
};

export function PublicationMedia({ media, onOpen }: Props) {
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  if (!media.length) return null;

  return (
    <div
      className={
        media.length > 1
          ? "mt-3 grid grid-cols-2 gap-1 overflow-hidden rounded-2xl border border-[var(--jq-border)]"
          : "mt-3 overflow-hidden rounded-2xl border border-[var(--jq-border)]"
      }
    >
      {media.map((m, index) => {
        const src = normalizeMediaUrl(m.url) ?? m.url;
        const isVideo = m.type === "VIDEO";
        const hasFailed = failed.has(m.id);
        const clickable =
          !hasFailed && !!onOpen && (m.type === "IMAGE" || m.type === "GIF" || isVideo);
        return (
          <button
            key={m.id}
            type="button"
            disabled={!clickable}
            className={cn(
              "relative block aspect-video w-full bg-[var(--jq-surface)] text-left",
              clickable && "cursor-zoom-in",
            )}
            onClick={(e) => {
              if (!clickable) return;
              e.preventDefault();
              e.stopPropagation();
              onOpen(index);
            }}
          >
            {hasFailed ? (
              <span className="flex size-full flex-col items-center justify-center gap-1 text-[var(--jq-muted)]">
                <ImageOff className="size-6" strokeWidth={1.5} />
                <span className="text-xs">Mídia indisponível</span>
              </span>
            ) : (
              <>
                {m.type === "GIF" ? (
                  <span className="absolute left-2 top-2 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--jq-primary)]">
                    GIF
                  </span>
                ) : null}
                {isVideo ? (
                  <video
                    src={src}
                    className="size-full object-cover"
                    controls={!clickable}
                    playsInline
                    preload="metadata"
                    onError={() => setFailed((prev) => new Set(prev).add(m.id))}
                    onClick={(e) => {
                      if (clickable) e.preventDefault();
                    }}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 size-full object-cover"
                    onError={() => setFailed((prev) => new Set(prev).add(m.id))}
                  />
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
