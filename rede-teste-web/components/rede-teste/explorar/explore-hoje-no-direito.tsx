"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { shuffleNews, type LegalNewsItem } from "@/lib/rede-teste/legal-news";

const PAGE_SIZE = 8;
const MAX_PAGES = 5;

export function ExploreHojeNoDireito() {
  const [items, setItems] = useState<LegalNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    void fetch("/api/rede-teste/legal-news")
      .then((r) => r.json())
      .then((d: { items?: LegalNewsItem[] }) => {
        // Ordem aleatória, misturando as fontes (ConJur, InfoMoney, Migalhas, G1).
        setItems(shuffleNews(d.items ?? []));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const totalPages = useMemo(
    () => Math.min(MAX_PAGES, Math.max(1, Math.ceil(items.length / PAGE_SIZE))),
    [items.length],
  );

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-[var(--jq-muted)]" />
      </div>
    );
  }

  if (error || items.length === 0) {
    return (
      <p className="p-8 text-center text-sm text-[var(--jq-muted)]">
        Não foi possível carregar as notícias. Tente novamente em alguns minutos.
      </p>
    );
  }

  return (
    <section className="p-4">
      <h2 className="mb-3 text-sm font-bold text-[var(--jq-muted)]">
        Notícias jurídicas — ConJur, InfoMoney, Migalhas e G1
      </h2>
      <ul className="space-y-2">
        {pageItems.map((n) => (
          <li key={n.id}>
            <a
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border border-[var(--jq-border)] bg-[var(--jq-surface)] p-3 transition hover:bg-[var(--jq-bg)]/50"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-snug text-[var(--jq-text)]">
                  {n.title}
                </p>
                <ExternalLink className="mt-0.5 size-4 shrink-0 text-[var(--jq-muted)]" />
              </div>
              {n.description ? (
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--jq-muted)]">
                  {n.description}
                </p>
              ) : null}
              <p className="mt-1 text-[10px] font-medium text-[var(--jq-reply)]">{n.meta}</p>
            </a>
          </li>
        ))}
      </ul>

      {totalPages > 1 ? (
        <nav className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPage(p);
                if (typeof window !== "undefined") {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              className={`size-9 rounded-full text-sm font-medium ${
                page === p
                  ? "bg-[var(--jq-primary)] text-[var(--jq-on-primary)]"
                  : "bg-[var(--jq-surface)] text-[var(--jq-muted)] hover:bg-[var(--jq-bg)]"
              }`}
              aria-label={`Página ${p}`}
              aria-current={page === p ? "page" : undefined}
            >
              {p}
            </button>
          ))}
        </nav>
      ) : null}
    </section>
  );
}
