"use client";

import {
  MessageCircle,
  Repeat2,
  Quote,
  Heart,
  Bookmark,
  BarChart2,
} from "lucide-react";
import { pluralize } from "@/lib/i18n/plural";

type Props = {
  repliesCount: number;
  repostsCount: number;
  quotesCount?: number;
  likesCount: number;
  bookmarksCount: number;
  viewsCount: number;
};

export function PublicationMetrics({
  repliesCount,
  repostsCount,
  quotesCount = 0,
  likesCount,
  bookmarksCount,
  viewsCount,
}: Props) {
  const cells = [
    {
      icon: MessageCircle,
      value: repliesCount,
      label: pluralize(repliesCount, "Resposta", "Respostas"),
      color: "text-[var(--jq-reply)]",
    },
    {
      icon: Repeat2,
      value: repostsCount,
      label: pluralize(repostsCount, "Repost", "Reposts"),
      color: "text-[var(--jq-repost)]",
    },
    {
      icon: Quote,
      value: quotesCount,
      label: pluralize(quotesCount, "Citação", "Citações"),
      color: "text-[var(--jq-muted)]",
    },
    {
      icon: Heart,
      value: likesCount,
      label: pluralize(likesCount, "Curtida", "Curtidas"),
      color: "text-[var(--jq-like)]",
    },
    {
      icon: Bookmark,
      value: bookmarksCount,
      label: pluralize(bookmarksCount, "Salvo", "Salvos"),
      color: "text-[var(--jq-accent)]",
    },
    {
      icon: BarChart2,
      value: viewsCount,
      label: pluralize(viewsCount, "Visualização", "Visualizações"),
      color: "text-[var(--jq-muted)]",
    },
  ];

  return (
    <div
      className="grid grid-cols-3 gap-px border-b border-[var(--jq-border)] bg-[var(--jq-border)] sm:grid-cols-6"
      aria-label="Métricas da publicação"
    >
      {cells.map(({ icon: Icon, value, label, color }) => (
        <div
          key={label}
          className="flex flex-col items-center gap-1 bg-[var(--jq-bg)] px-2 py-4 text-center"
        >
          <Icon className={`size-5 ${color}`} aria-hidden />
          <span className="text-xl font-bold tabular-nums">{formatMetric(value)}</span>
          <span className="text-xs text-[var(--jq-muted)]">{label}</span>
        </div>
      ))}
    </div>
  );
}

function formatMetric(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}
