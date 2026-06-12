"use client";

import Image from "next/image";
import { useEffect } from "react";
import { X } from "lucide-react";
import { normalizeMediaUrl } from "@/lib/media-url";

type Props = {
  open: boolean;
  onClose: () => void;
  items: { url: string; type: string }[];
  index: number;
  onIndexChange?: (i: number) => void;
};

export function JqMediaLightbox({ open, onClose, items, index, onIndexChange }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && items.length > 1) {
        onIndexChange?.((index + 1) % items.length);
      }
      if (e.key === "ArrowLeft" && items.length > 1) {
        onIndexChange?.((index - 1 + items.length) % items.length);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, index, items.length, onIndexChange]);

  if (!open || !items[index]) return null;

  const current = items[index];
  const src = normalizeMediaUrl(current.url) ?? current.url;
  const isVideo = current.type === "VIDEO";

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Visualizar mídia"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        aria-label="Fechar"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <X className="size-6" />
      </button>
      <div
        className="relative max-h-[90vh] max-w-[min(100%,900px)] w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo ? (
          <video
            src={src}
            className="mx-auto max-h-[90vh] w-full rounded-lg"
            controls
            autoPlay
            playsInline
          />
        ) : (
          <div className="relative mx-auto aspect-auto max-h-[90vh] min-h-[200px] w-full">
            <Image
              src={src}
              alt=""
              width={1200}
              height={900}
              className="mx-auto max-h-[90vh] w-auto rounded-lg object-contain"
              unoptimized={current.type === "GIF"}
            />
          </div>
        )}
        {items.length > 1 ? (
          <p className="mt-2 text-center text-sm text-white/70">
            {index + 1} / {items.length}
          </p>
        ) : null}
      </div>
    </div>
  );
}
