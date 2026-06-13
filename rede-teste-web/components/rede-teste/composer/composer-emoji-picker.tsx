"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Smile, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadRecentEmojis, pushRecentEmoji } from "@/lib/rede-teste/draft-storage";
import { cn } from "@/lib/utils";

const Picker = dynamic(
  () => import("@emoji-mart/react").then((m) => m.default),
  { ssr: false, loading: () => <p className="p-4 text-sm text-[var(--jq-muted)]">Carregando…</p> },
);

function useJqEmojiTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    const root = document.querySelector("[data-rede-teste].jq-theme");
    const read = () =>
      setTheme(root?.classList.contains("jq-light") ? "light" : "dark");
    read();
    const obs = new MutationObserver(read);
    if (root) obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

type Props = {
  disabled?: boolean;
  onPick: (emoji: string) => void;
  className?: string;
};

export function ComposerEmojiPicker({ disabled, onPick, className }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<object | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const emojiTheme = useJqEmojiTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    void import("@emoji-mart/data").then((m) => setData(m.default));
    setRecent(loadRecentEmojis());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handlePick = useCallback(
    (emoji: string) => {
      onPick(emoji);
      pushRecentEmoji(emoji);
      setRecent(loadRecentEmojis());
      setOpen(false);
    },
    [onPick],
  );

  const modal =
    open && mounted ? (
      <div
        className="fixed inset-0 z-[250] flex items-end justify-center p-0 sm:items-center sm:p-4"
        role="presentation"
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/60"
          aria-label="Fechar seletor de emoji"
          onClick={() => setOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="emoji-picker-title"
          className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-[var(--jq-border)] bg-[var(--jq-bg)] text-[var(--jq-text)] shadow-2xl sm:rounded-2xl"
          style={{ maxHeight: "min(85vh, 520px)" }}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--jq-border)] px-4 py-3">
            <h2 id="emoji-picker-title" className="text-lg font-semibold">
              Emoji
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

          {recent.length > 0 ? (
            <div className="shrink-0 border-b border-[var(--jq-border)] px-4 py-2">
              <p className="mb-1 text-xs text-[var(--jq-muted)]">Frequentes</p>
              <div className="flex flex-wrap gap-1">
                {recent.map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="rounded p-1 text-lg hover:bg-[var(--jq-surface)]"
                    aria-label={`Inserir ${e}`}
                    onClick={() => handlePick(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--jq-bg)] [&_em-emoji-picker]:bg-[var(--jq-bg)]">
            {data ? (
              <Picker
                data={data}
                locale="pt"
                theme={emojiTheme}
                previewPosition="none"
                skinTonePosition="search"
                onEmojiSelect={(emoji: { native: string }) => handlePick(emoji.native)}
              />
            ) : (
              <p className="p-6 text-center text-sm text-[var(--jq-muted)]">Carregando emojis…</p>
            )}
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
        aria-label="Inserir emoji"
        title="Emoji"
        onClick={() => setOpen(true)}
      >
        <Smile className="size-5" strokeWidth={1.75} />
      </Button>
      {mounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
