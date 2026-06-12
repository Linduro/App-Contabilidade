"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MoreHorizontal, Share2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  hideLegalNewsItem,
  loadHiddenLegalNewsIds,
} from "@/lib/rede-teste/legal-news-prefs";
import {
  pickDiverseNews,
  shuffleNews,
  type LegalNewsItem,
} from "@/lib/rede-teste/legal-news";

const VISIBLE_COUNT = 4;

const MENU_ACTIONS = [
  { key: "irrelevant", label: "O conteúdo associado não é relevante." },
  { key: "spam", label: "Essa tendência é spam." },
  { key: "abusive", label: "Essa tendência é abusiva ou prejudicial." },
  { key: "not_interested", label: "Não tenho interesse nisso." },
  { key: "duplicate", label: "Essa tendência está duplicada." },
] as const;

export function HojeNoDireito() {
  const [pool, setPool] = useState<LegalNewsItem[]>([]);
  const [visible, setVisible] = useState<LegalNewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hiddenIds = loadHiddenLegalNewsIds();
    void fetch("/api/rede-teste/legal-news")
      .then((r) => r.json())
      .then((d: { items?: LegalNewsItem[] }) => {
        const items = d.items ?? [];
        setPool(items);
        const available = items.filter((n) => !hiddenIds.includes(n.id));
        // Embaralha a cada carregamento → notícias diferentes a cada reload.
        setVisible(pickDiverseNews(shuffleNews(available), VISIBLE_COUNT));
      })
      .catch(() => {
        setPool([]);
        setVisible([]);
      })
      .finally(() => setLoading(false));
  }, []);

  function dismiss(id: string, reason: string) {
    hideLegalNewsItem(id);
    const hiddenIds = loadHiddenLegalNewsIds();
    setVisible((prev) => {
      const remaining = prev.filter((n) => n.id !== id);
      const shownIds = new Set(remaining.map((n) => n.id));
      const candidates = shuffleNews(
        pool.filter((n) => !hiddenIds.includes(n.id) && !shownIds.has(n.id)),
      );
      // Prioriza repor com a mesma fonte que saiu, senão usa qualquer outra.
      const removed = prev.find((n) => n.id === id);
      const replacement =
        candidates.find((n) => n.source === removed?.source) ?? candidates[0];
      return replacement ? [...remaining, replacement] : remaining;
    });
    toast.success("Preferência registrada", {
      description: reason.slice(0, 80),
    });
  }

  async function shareItem(item: LegalNewsItem) {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: item.title, text: item.description, url: item.url });
        return;
      }
    } catch {
      /* cancelado */
    }
    try {
      await navigator.clipboard.writeText(item.url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível compartilhar");
    }
  }

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-[var(--jq-border)] bg-[var(--jq-surface)]">
      <h2 className="px-4 py-3 text-xl font-bold">Hoje no Direito</h2>
      <ul>
        {loading ? (
          <li className="px-4 py-3 text-sm text-[var(--jq-muted)]">Carregando notícias…</li>
        ) : visible.length === 0 ? (
          <li className="px-4 py-3 text-sm text-[var(--jq-muted)]">
            Nenhuma notícia disponível no momento.
          </li>
        ) : (
          visible.map((n) => (
            <li key={n.id} className="border-t border-[var(--jq-border)]/60">
              <div className="flex gap-1 px-2 py-2">
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 rounded-lg px-2 py-2 transition hover:bg-[var(--jq-bg)]/50"
                >
                  <p className="text-sm font-semibold leading-snug text-[var(--jq-text)]">
                    {n.title}
                  </p>
                  {n.description ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--jq-muted)]">
                      {n.description}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[10px] text-[var(--jq-reply)]">{n.meta}</p>
                </a>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="shrink-0 rounded-full p-2 text-[var(--jq-muted)] hover:bg-[var(--jq-bg)] hover:text-[var(--jq-text)]"
                      aria-label="Opções da notícia"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="max-w-[280px] border-[var(--jq-border)] bg-[var(--jq-bg)] text-[var(--jq-text)]"
                  >
                    {MENU_ACTIONS.map((a) => (
                      <DropdownMenuItem
                        key={a.key}
                        className="whitespace-normal text-sm"
                        onClick={() => dismiss(n.id, a.label)}
                      >
                        {a.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void shareItem(n)}>
                      <Share2 className="mr-2 size-4" />
                      Enviar para…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))
        )}
      </ul>
      <Link
        href="/rede-teste/explorar?type=hoje-no-direito"
        className="block border-t border-[var(--jq-border)]/60 px-4 py-3 text-sm text-[var(--jq-reply)] hover:bg-[var(--jq-bg)]/50"
      >
        Ver mais
      </Link>
    </section>
  );
}
