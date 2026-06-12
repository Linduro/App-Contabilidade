"use client";

import Image from "next/image";
import type { JqLinkPreview } from "@/lib/rede-teste/link-preview-parsers";

export function PublicationLinkPreview({ preview }: { preview: JqLinkPreview }) {
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 block overflow-hidden rounded-xl border border-[var(--jq-border)] bg-[var(--jq-surface)] transition hover:bg-[var(--jq-primary)]/5"
    >
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
          <p className="line-clamp-2 font-medium">{preview.title}</p>
        ) : null}
        {preview.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-[var(--jq-muted)]">
            {preview.description}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-[var(--jq-reply)]">
          {preview.siteName ?? new URL(preview.url).hostname}
        </p>
      </div>
    </a>
  );
}
