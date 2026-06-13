"use client";

import { useState } from "react";
import { Landmark, X } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Court = { id: string; code: string; name: string };

type Props = {
  disabled?: boolean;
  value: Court | null;
  onChange: (court: Court | null) => void;
  className?: string;
};

export function ComposerCourtPicker({ disabled, value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const search = trpc.redeTeste.searchCourts.useQuery(
    { q, limit: 15 },
    { enabled: open },
  );

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
            value && "text-[var(--jq-primary)]",
            className,
          )}
          aria-label="Tag de jurisdição ou tribunal"
          title="Tribunal ou jurisdição"
        >
          <Landmark className="size-5" strokeWidth={1.75} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 border-[var(--jq-border)] bg-[var(--jq-bg)] p-3"
        align="start"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar tribunal (ex: TJSP)"
          className="mb-2 border-[var(--jq-border)] bg-[var(--jq-surface)]"
          aria-label="Buscar tribunal"
        />
        <ul className="max-h-48 overflow-y-auto">
          {search.data?.courts.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="w-full rounded-md px-2 py-2 text-left text-sm hover:bg-[var(--jq-primary)]/10"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{c.code}</span>
                <span className="ml-2 text-[var(--jq-muted)]">{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
      {value ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--jq-primary)]/40 bg-[var(--jq-primary)]/10 px-2 py-0.5 text-xs text-[var(--jq-primary)]">
          ⚖️ {value.code}
          <button
            type="button"
            aria-label="Remover tribunal"
            onClick={() => onChange(null)}
          >
            <X className="size-3" />
          </button>
        </span>
      ) : null}
    </Popover>
  );
}
