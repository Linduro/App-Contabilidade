"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, ImageOff } from "lucide-react";
import { normalizeMediaUrl } from "@/lib/media-url";
import type { DmPublicationPreview, DmPublicationPreviewResult } from "@/lib/rede-teste/dm-publication-preview-shared";
import { JqAvatar } from "../shared/jq-avatar";
import { JqMediaLightbox } from "../shared/jq-media-lightbox";
import { YouTubeEmbed } from "../feed/youtube-embed";
import { formatJqHandle } from "@/lib/rede-teste/format";
import {
  findYouTubeIdInText,
  parseYouTubeId,
} from "@/lib/rede-teste/youtube";
import { cn } from "@/lib/utils";

type Props = {
  preview: DmPublicationPreviewResult;
  isMine?: boolean;
};

function isUnavailable(
  p: DmPublicationPreviewResult,
): p is { id: string; unavailable: true } {
  return "unavailable" in p && p.unavailable === true;
}

export function DmSharedPublicationCard({ preview, isMine }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [failedMedia, setFailedMedia] = useState<Set<string>>(() => new Set());

  const href = `/rede-teste/publicacao/${preview.id}`;

  if (isUnavailable(preview)) {
    return (
      <Link
        href={href}
        className={cn(
          "mt-2 block rounded-xl border p-3 text-left transition hover:opacity-90",
          isMine
            ? "border-white/25 bg-black/15"
            : "border-[var(--jq-border)] bg-[var(--jq-bg)]",
        )}
      >
        <p className="text-xs opacity-80">Publicação indisponível ou removida</p>
        <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium underline">
          Abrir link
          <ExternalLink className="size-3" />
        </span>
      </Link>
    );
  }

  const pub = preview as DmPublicationPreview;
  const excerpt =
    pub.content.length > 140 ? `${pub.content.slice(0, 140).trim()}…` : pub.content;
  const first = pub.media[0];
  const firstSrc = first ? (normalizeMediaUrl(first.url) ?? first.url) : null;
  const isVideo = first?.type === "VIDEO";
  const firstFailed = first ? failedMedia.has(first.id) : false;
  const youTubeId =
    parseYouTubeId(pub.linkPreview?.url) ?? findYouTubeIdInText(pub.content);
  const linkThumb = pub.linkPreview?.image
    ? (normalizeMediaUrl(pub.linkPreview.image) ?? pub.linkPreview.image)
    : null;

  return (
    <>
      <div
        className={cn(
          "mt-2 overflow-hidden rounded-xl border text-left",
          isMine
            ? "border-white/25 bg-black/15"
            : "border-[var(--jq-border)] bg-[var(--jq-bg)]",
        )}
      >
        <Link href={href} className="block p-2.5 transition hover:opacity-95">
          <div className="flex items-center gap-2">
            <JqAvatar src={pub.author.image} name={pub.author.displayName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{pub.author.displayName}</p>
              <p className="truncate text-[10px] opacity-70">
                {formatJqHandle(pub.author.handle)}
              </p>
            </div>
          </div>
          {excerpt ? (
            <p className="mt-2 line-clamp-3 text-xs leading-snug opacity-90">{excerpt}</p>
          ) : null}
        </Link>

        {first && firstSrc && !firstFailed ? (
          <div className="border-t border-inherit">
            {isVideo ? (
              <video
                src={firstSrc}
                className="aspect-video w-full bg-black object-contain"
                controls
                playsInline
                preload="metadata"
                onClick={(e) => e.stopPropagation()}
                onError={() =>
                  setFailedMedia((prev) => new Set(prev).add(first.id))
                }
              />
            ) : (
              <button
                type="button"
                className="relative block aspect-video w-full cursor-zoom-in bg-black/40"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLightboxIndex(0);
                  setLightboxOpen(true);
                }}
              >
                {first.type === "GIF" ? (
                  <span className="absolute left-2 top-2 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--jq-primary)]">
                    GIF
                  </span>
                ) : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={firstSrc}
                  alt=""
                  className="size-full object-cover"
                  onError={() =>
                    setFailedMedia((prev) => new Set(prev).add(first.id))
                  }
                />
              </button>
            )}
            {pub.media.length > 1 ? (
              <p className="px-2 py-1 text-center text-[10px] opacity-60">
                +{pub.media.length - 1} mídia(s)
              </p>
            ) : null}
          </div>
        ) : !first && youTubeId ? (
          <div
            className="border-t border-inherit px-1 pb-1"
            onClick={(e) => e.stopPropagation()}
          >
            <YouTubeEmbed
              id={youTubeId}
              title={pub.linkPreview?.title}
              description={pub.linkPreview?.description}
              className="group relative mt-0 aspect-video w-full overflow-hidden rounded-lg border-0 bg-black"
            />
          </div>
        ) : !first && linkThumb ? (
          <div className="border-t border-inherit">
            <a
              href={pub.linkPreview!.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block aspect-video overflow-hidden bg-black/40"
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={linkThumb}
                alt=""
                className="size-full object-cover"
              />
            </a>
          </div>
        ) : first ? (
          <div className="flex aspect-video items-center justify-center border-t border-inherit text-[var(--jq-muted)]">
            <ImageOff className="size-5" strokeWidth={1.5} />
          </div>
        ) : null}

        <div className="border-t border-inherit px-2 py-1.5">
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-[11px] font-medium underline opacity-90 hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            Ver publicação completa
            <ExternalLink className="size-3" />
          </Link>
        </div>
      </div>

      <JqMediaLightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        items={pub.media}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
      />
    </>
  );
}
