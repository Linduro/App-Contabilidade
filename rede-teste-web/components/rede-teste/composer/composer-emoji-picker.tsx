"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  const [data, setData] = useState<object | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const emojiTheme = useJqEmojiTheme();

  useEffect(() => {
    void import("@emoji-mart/data").then((m) => setData(m.default));
    setRecent(loadRecentEmojis());
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
        >
          <Smile className="size-5" strokeWidth={1.75} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="z-[250] w-auto border-[var(--jq-border)] bg-[var(--jq-bg)] p-0 shadow-xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
      >
        {recent.length > 0 ? (
          <div className="border-b border-[var(--jq-border)] bg-[var(--jq-bg)] px-2 py-2">
            <p className="mb-1 text-xs text-[var(--jq-muted)]">Frequentes</p>
            <div className="flex flex-wrap gap-1">
              {recent.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="rounded p-1 text-lg hover:bg-[var(--jq-surface)]"
                  aria-label={`Inserir ${e}`}
                  onClick={() => {
                    onPick(e);
                    pushRecentEmoji(e);
                    setOpen(false);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="bg-[var(--jq-bg)] [&_em-emoji-picker]:bg-[var(--jq-bg)]">
          {data ? (
            <Picker
              data={data}
              locale="pt"
              theme={emojiTheme}
              previewPosition="none"
              skinTonePosition="search"
              onEmojiSelect={(emoji: { native: string }) => {
                onPick(emoji.native);
                pushRecentEmoji(emoji.native);
                setRecent(loadRecentEmojis());
                setOpen(false);
              }}
            />
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
