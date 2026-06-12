"use client";

import Image from "next/image";
import { X } from "lucide-react";
import type { JqLinkPreview } from "@/lib/rede-teste/link-preview-parsers";

type Props = {
  preview: JqLinkPreview;
  onRemove: () => void;
};

export function ComposerLinkPreview({ preview, onRemove }: Props) {
  let hostname = preview.siteName ?? "";
  try {
    hostname = hostname || new URL(preview.url).hostname;
  } catch {
    /* ignore */
  }

  return (
    <div className="relative mt-3 overflow-hidden rounded-xl border border-[var(--jq-border)] bg-[var(--jq-surface)]">
      <button
        type="button"
        className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-1 text-white"
        aria-label="Remover pré-visualização do link"
        onClick={onRemove}
      >
        <X className="size-4" />
      </button>
      {preview.image ? (
        <div className="relative aspect-[2/1] w-full bg-[var(--jq-bg)]">
          <Image
            src={preview.image}
            alt=""
            fill
            className="object-cover"
            unoptimized
            sizes="600px"
          />
        </div>
      ) : null}
      <div className="p-3">
        {preview.title ? (
          <p className="line-clamp-2 font-medium text-[var(--jq-text)]">{preview.title}</p>
        ) : null}
        {preview.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-[var(--jq-muted)]">
            {preview.description}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-[var(--jq-reply)]">{hostname}</p>
      </div>
    </div>
  );
}
