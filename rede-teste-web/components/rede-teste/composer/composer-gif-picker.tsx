"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ensureGifStillUrl } from "@/lib/rede-teste/gif-preview-urls";
import { cn } from "@/lib/utils";

export type SelectedGif = { url: string; previewUrl: string; title: string };

type Props = {
  disabled?: boolean;
  onSelect: (gif: SelectedGif) => void;
  className?: string;
};

type GifItem = {
  id: string;
  url: string;
  stillUrl: string;
  animatedUrl: string;
  previewUrl: string;
  title: string;
};

const GIF_CELL_PX = 96;

function mergeGifs(prev: GifItem[], incoming: GifItem[], append: boolean): GifItem[] {
  if (!append) return incoming;
  const seen = new Set(prev.map((g) => g.id));
  const added = incoming.filter((g) => {
    if (seen.has(g.id)) return false;
    seen.add(g.id);
    return true;
  });
  return [...prev, ...added];
}

function normalizeGifItem(raw: {
  id: string;
  url: string;
  title: string;
  stillUrl?: string;
  animatedUrl?: string;
  previewUrl?: string;
}): GifItem {
  const animated = raw.animatedUrl ?? raw.previewUrl ?? raw.url;
  const still = ensureGifStillUrl(animated, raw.stillUrl ?? raw.previewUrl);
  return {
    id: raw.id,
    url: raw.url,
    stillUrl: still,
    animatedUrl: animated,
    previewUrl: animated,
    title: raw.title,
  };
}

function readHoverCapable() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function useHoverCapable() {
  const [hoverCapable, setHoverCapable] = useState(readHoverCapable);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setHoverCapable(mq.matches);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return hoverCapable;
}

function GifPickerCell({
  gif,
  scrollRoot,
  hoverCapable,
  onPick,
}: {
  gif: GifItem;
  scrollRoot: HTMLDivElement | null;
  hoverCapable: boolean;
  onPick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (hoverCapable) {
      setAnimate(false);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setAnimate(entry.isIntersecting),
      {
        root: scrollRoot,
        rootMargin: "48px",
        threshold: 0.35,
      },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      setAnimate(false);
    };
  }, [hoverCapable, scrollRoot]);

  const displayUrl = animate ? gif.animatedUrl : gif.stillUrl;

  return (
    <button
      ref={ref}
      type="button"
      className="overflow-hidden rounded-lg border border-[var(--jq-border)] bg-[var(--jq-surface)] transition hover:ring-2 hover:ring-[var(--jq-primary)]"
      style={{ height: GIF_CELL_PX, width: "100%" }}
      aria-label={gif.title || "Selecionar GIF"}
      onClick={onPick}
      onMouseEnter={() => {
        if (hoverCapable) setAnimate(true);
      }}
      onMouseLeave={() => {
        if (hoverCapable) setAnimate(false);
      }}
      onFocus={() => {
        if (hoverCapable) setAnimate(true);
      }}
      onBlur={() => {
        if (hoverCapable) setAnimate(false);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={displayUrl}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        className="block size-full object-cover"
      />
    </button>
  );
}

export function ComposerGifPicker({ disabled, onSelect, className }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState<string | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hoverCapable = useHoverCapable();

  const load = useCallback(async (query: string, pos?: string, append = false) => {
    if (append && loadingMoreRef.current) return;
    if (append) loadingMoreRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (pos) params.set("pos", pos);
      const res = await fetch(`/api/gif/search?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao buscar GIFs");
      const incoming = (data.gifs as Parameters<typeof normalizeGifItem>[0][]).map(
        normalizeGifItem,
      );
      setGifs((prev) => mergeGifs(prev, incoming, append));
      setNext(data.next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao buscar GIFs");
    } finally {
      setLoading(false);
      loadingMoreRef.current = false;
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void load(q), q ? 400 : 0);
    return () => clearTimeout(t);
  }, [open, q, load]);

  useEffect(() => {
    if (!open) {
      setQ("");
      setGifs([]);
      setNext(undefined);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!open || !root || !sentinel || !next) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading && next) {
          void load(q, next, true);
        }
      },
      { root, rootMargin: "120px", threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, next, loading, q, load]);

  const modal =
    open && mounted ? (
      <div
        className="fixed inset-0 z-[250] flex items-center justify-center p-4"
        role="presentation"
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/60"
          aria-label="Fechar busca de GIF"
          onClick={() => setOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gif-picker-title"
          className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--jq-border)] bg-[var(--jq-bg)] text-[var(--jq-text)] shadow-2xl"
          style={{ maxHeight: "min(85vh, 640px)" }}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--jq-border)] px-4 py-3">
            <h2 id="gif-picker-title" className="text-lg font-semibold">
              Buscar GIF
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-full"
              aria-label="Fechar"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="relative shrink-0 px-4 pt-3">
            <Search className="absolute left-7 top-1/2 size-4 -translate-y-1/2 text-[var(--jq-muted)]" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar GIF…"
              className="border-[var(--jq-border)] bg-[var(--jq-surface)] pl-9"
              aria-label="Buscar GIF"
            />
          </div>

          {!q.trim() ? (
            <p className="shrink-0 px-4 pt-2 text-sm text-[var(--jq-muted)]">Tendências</p>
          ) : null}
          {error ? (
            <p className="shrink-0 px-4 pt-2 text-sm text-red-400">{error}</p>
          ) : null}

          <div
            ref={(el) => {
              scrollRef.current = el;
              setScrollRoot(el);
            }}
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div
              className="grid grid-cols-3 gap-2"
              style={{ gridAutoRows: `${GIF_CELL_PX}px` }}
            >
              {gifs.map((g, index) => (
                <GifPickerCell
                  key={`${g.id}-${index}`}
                  gif={g}
                  scrollRoot={scrollRoot}
                  hoverCapable={hoverCapable}
                  onPick={() => {
                    onSelect({
                      url: g.url,
                      previewUrl: g.previewUrl,
                      title: g.title,
                    });
                    setOpen(false);
                  }}
                />
              ))}
            </div>
            <div ref={sentinelRef} className="h-2 w-full shrink-0" aria-hidden />
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-6 animate-spin text-[var(--jq-primary)]" />
              </div>
            ) : null}
            {!loading && gifs.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--jq-muted)]">
                Nenhum GIF encontrado
              </p>
            ) : null}
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        className={cn(
          "size-8 rounded-full text-[var(--jq-reply)] hover:bg-[var(--jq-primary)]/15 hover:text-[var(--jq-primary)]",
          className,
        )}
        aria-label="Inserir GIF"
        title="GIF"
        onClick={() => setOpen(true)}
      >
        <span className="rounded-[5px] border-[1.5px] border-current px-1 py-px text-[10px] font-extrabold leading-none tracking-tight">
          GIF
        </span>
      </Button>
      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
