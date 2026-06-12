"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc-client";
import { JqAvatar } from "../shared/jq-avatar";
import { formatJqHandle } from "@/lib/rede-teste/format";
import { jqProfilePath } from "@/lib/rede-teste/profile-path";
import {
  loadSearchHistory,
  pushSearchHistory,
  removeSearchHistoryItem,
} from "@/lib/rede-teste/search-history";
import { cn } from "@/lib/utils";

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

type Props = {
  /** Barra no topo do feed (Início) — fundo mais transparente ao rolar */
  variant?: "rail" | "feed";
  scrolled?: boolean;
};

export function RedeTesteSearchBox({ variant = "rail", scrolled = false }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounced = useDebounced(q.trim(), 280);

  useEffect(() => {
    if (focused) setHistory(loadSearchHistory());
  }, [focused]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const live = trpc.redeTeste.search.useQuery(
    {
      q: debounced.replace(/^[@#]/, ""),
      type: debounced.startsWith("@")
        ? "people"
        : debounced.startsWith("#")
          ? "hashtags"
          : "top",
      limit: 6,
    },
    { enabled: focused && debounced.length >= 2 },
  );

  function goSearch(term: string) {
    const trimmed = term.trim();
    if (!trimmed) return;
    pushSearchHistory(trimmed);
    setHistory(loadSearchHistory());
    const type = trimmed.startsWith("@")
      ? "people"
      : trimmed.startsWith("#")
        ? "hashtags"
        : "top";
    router.push(`/rede-teste/explorar?q=${encodeURIComponent(trimmed)}&type=${type}`);
    setFocused(false);
    setQ("");
  }

  const showPanel = focused && (history.length > 0 || debounced.length >= 2 || q.length > 0);
  const showHistory = focused && history.length > 0 && debounced.length < 2;

  return (
    <div ref={wrapRef} className="relative">
      <form
        className={cn(
          "relative rounded-full transition-colors duration-200",
          variant === "rail" && "bg-[var(--jq-surface)]",
          variant === "feed" &&
            (scrolled ? "bg-[var(--jq-surface)]/45" : "bg-[var(--jq-surface)]/90"),
        )}
        onSubmit={(e) => {
          e.preventDefault();
          goSearch(q);
        }}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--jq-muted)]" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Buscar no Rede Teste"
          className={cn(
            "h-11 rounded-full border border-transparent bg-transparent py-3 pl-11 pr-4 text-[var(--jq-text)] focus-visible:bg-[var(--jq-bg)] focus-visible:ring-0",
            variant === "rail" &&
              "focus-visible:border-[var(--jq-reply)]",
          )}
          aria-label="Buscar no Rede Teste"
          aria-expanded={showPanel}
          autoComplete="off"
        />
      </form>

      {showPanel ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[min(70vh,420px)] overflow-y-auto rounded-2xl border border-[var(--jq-border)] bg-[var(--jq-bg)] shadow-xl">
          {showHistory ? (
            <>
              <p className="px-4 py-2 text-xs font-medium text-[var(--jq-muted)]">Buscas recentes</p>
              <ul>
                {history.map((term) => (
                  <li key={term} className="flex items-center border-t border-[var(--jq-border)]/60">
                    <button
                      type="button"
                      className="min-w-0 flex-1 px-4 py-2.5 text-left text-sm hover:bg-[var(--jq-surface)]"
                      onClick={() => goSearch(term)}
                    >
                      {term}
                    </button>
                    <button
                      type="button"
                      className="shrink-0 p-2 text-[var(--jq-muted)] hover:text-[var(--jq-text)]"
                      aria-label={`Remover ${term} do histórico`}
                      onClick={() => {
                        removeSearchHistoryItem(term);
                        setHistory(loadSearchHistory());
                      }}
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {debounced.length >= 2 ? (
            <div className={showHistory ? "border-t border-[var(--jq-border)]" : ""}>
              {live.isLoading ? (
                <p className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--jq-muted)]">
                  <Loader2 className="size-4 animate-spin" />
                  Buscando…
                </p>
              ) : null}
              {live.data?.people?.length ? (
                <div>
                  <p className="px-4 py-2 text-xs font-medium text-[var(--jq-muted)]">Pessoas</p>
                  <ul>
                    {live.data.people.slice(0, 3).map((p) => (
                      <li key={p.userId}>
                        <Link
                          href={jqProfilePath(p.handle)}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-[var(--jq-surface)]"
                          onClick={() => setFocused(false)}
                        >
                          <JqAvatar src={p.image} name={p.displayName} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{p.displayName}</p>
                            <p className="truncate text-xs text-[var(--jq-muted)]">
                              {formatJqHandle(p.handle)}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {live.data?.hashtags?.length ? (
                <div>
                  <p className="px-4 py-2 text-xs font-medium text-[var(--jq-muted)]">Hashtags</p>
                  <ul>
                    {live.data.hashtags.slice(0, 3).map((h) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--jq-surface)]"
                          onClick={() => goSearch(`#${h.tag}`)}
                        >
                          #{h.tag}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {live.data?.publications?.length ? (
                <div>
                  <p className="px-4 py-2 text-xs font-medium text-[var(--jq-muted)]">
                    Publicações
                  </p>
                  <ul>
                    {live.data.publications.slice(0, 4).map((pub) => (
                      <li key={pub.id}>
                        <Link
                          href={`/rede-teste/publicacao/${pub.id}`}
                          className="block px-4 py-2 hover:bg-[var(--jq-surface)]"
                          onClick={() => setFocused(false)}
                        >
                          <p className="line-clamp-2 text-sm">{pub.content}</p>
                          <p className="mt-0.5 text-xs text-[var(--jq-muted)]">
                            {pub.author.name}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {live.data &&
              !live.isLoading &&
              !live.data.people?.length &&
              !live.data.hashtags?.length &&
              !live.data.publications?.length ? (
                <p className="px-4 py-3 text-sm text-[var(--jq-muted)]">Nenhum resultado.</p>
              ) : null}
              {debounced.length >= 2 ? (
                <button
                  type="button"
                  className="w-full border-t border-[var(--jq-border)] px-4 py-2.5 text-left text-sm text-[var(--jq-reply)] hover:bg-[var(--jq-surface)]"
                  onClick={() => goSearch(debounced)}
                >
                  Ver todos os resultados para &quot;{debounced}&quot;
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
