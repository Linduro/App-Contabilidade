"use client";

import { cn } from "@/lib/utils";

type Tab = "for-you" | "following";

type Props = {
  value: Tab;
  onChange: (tab: Tab) => void;
  /** Fundo mais translúcido quando posts passam por baixo (scroll do feed) */
  scrolled?: boolean;
};

const tabs: { id: Tab; label: string }[] = [
  { id: "for-you", label: "Para você" },
  { id: "following", label: "Seguindo" },
];

export function FeedTabs({ value, onChange, scrolled = false }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Abas do feed"
      className={cn(
        "jq-feed-tabs-sticky",
        scrolled && "jq-feed-tabs-sticky--scrolled",
      )}
    >
      {tabs.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "border-none bg-transparent py-4 text-center text-sm font-bold transition hover:bg-[var(--jq-surface)]/50",
              active
                ? "border-b-4 border-[var(--jq-reply)] text-[var(--jq-text)]"
                : "border-b-4 border-transparent font-medium text-[var(--jq-muted)]",
            )}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
