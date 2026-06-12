"use client";

import Link from "next/link";
import { Scale, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export type JurisFeedCardData = {
  postId: string;
  slug: string;
  titulo: string;
  tribunal: string | null;
  relator: string | null;
  dataJulgamento: string | null;
  ementaExcerpt: string | null;
  fonteUrl: string | null;
  tipoDecisao: string | null;
};

type Props = {
  juris: JurisFeedCardData;
  className?: string;
};

export function JurisFeedCard({ juris, className }: Props) {
  return (
    <div
      className={cn(
        "mt-2 rounded-xl border border-[var(--jq-border)] bg-[var(--jq-surface)] p-3 transition-colors hover:bg-[var(--jq-hover)]",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Scale className="mt-0.5 size-4 shrink-0 text-[var(--jq-accent)]" aria-hidden />
        <Link
          href={`/rede-teste/jurisprudencia/${juris.slug}`}
          className="min-w-0 flex-1"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--jq-muted)]">
            Jurisprudência
            {juris.tribunal ? ` · ${juris.tribunal}` : ""}
            {juris.tipoDecisao ? ` · ${juris.tipoDecisao}` : ""}
          </p>
          <p className="mt-0.5 font-semibold leading-snug text-[var(--jq-fg)]">{juris.titulo}</p>
          {(juris.relator || juris.dataJulgamento) && (
            <p className="mt-1 text-xs text-[var(--jq-muted)]">
              {[juris.relator, juris.dataJulgamento].filter(Boolean).join(" · ")}
            </p>
          )}
          {juris.ementaExcerpt && (
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--jq-fg)]/90">
              {juris.ementaExcerpt}
            </p>
          )}
        </Link>
        {juris.fonteUrl ? (
          <a
            href={juris.fonteUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Ver fonte original"
            className="shrink-0 rounded p-1 text-[var(--jq-muted)] hover:text-[var(--jq-accent)]"
          >
            <ExternalLink className="size-4" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
