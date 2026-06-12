"use client";

import { BarChart3, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JQ_POLL_MAX_OPTIONS } from "@/lib/rede-teste/composer-validations";

export type PollState = {
  question: string;
  options: string[];
  durationDays: 1 | 3 | 7;
};

type Props = {
  poll: PollState;
  onChange: (poll: PollState) => void;
  onClose: () => void;
};

export function ComposerPollEditor({ poll, onChange, onClose }: Props) {
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-[var(--jq-border)] bg-[var(--jq-surface)] p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="size-4 text-[var(--jq-primary)]" />
          Enquete
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-full"
          aria-label="Cancelar enquete"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>
      <label className="sr-only" htmlFor="jq-poll-question">
        Pergunta da enquete
      </label>
      <textarea
        id="jq-poll-question"
        rows={2}
        maxLength={560}
        placeholder="Pergunta da enquete"
        className="w-full resize-none rounded-md border border-[var(--jq-border)] bg-[var(--jq-bg)] px-3 py-2 text-sm"
        value={poll.question}
        onChange={(e) => onChange({ ...poll, question: e.target.value })}
      />
      {poll.options.map((opt, i) => (
        <input
          key={i}
          value={opt}
          maxLength={80}
          placeholder={`Opção ${i + 1}`}
          aria-label={`Opção ${i + 1} da enquete`}
          className="w-full rounded-md border border-[var(--jq-border)] bg-[var(--jq-bg)] px-3 py-2 text-sm"
          onChange={(e) =>
            onChange({
              ...poll,
              options: poll.options.map((v, j) => (j === i ? e.target.value : v)),
            })
          }
        />
      ))}
      {poll.options.length < JQ_POLL_MAX_OPTIONS ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => onChange({ ...poll, options: [...poll.options, ""] })}
        >
          <Plus className="mr-1 size-3" />
          Adicionar opção
        </Button>
      ) : null}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--jq-muted)]">Duração</span>
        <Select
          value={String(poll.durationDays)}
          onValueChange={(v) =>
            onChange({ ...poll, durationDays: Number(v) as 1 | 3 | 7 })
          }
        >
          <SelectTrigger className="h-8 w-28 border-[var(--jq-border)] bg-[var(--jq-bg)] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-[var(--jq-border)] bg-[var(--jq-bg)]">
            <SelectItem value="1">1 dia</SelectItem>
            <SelectItem value="3">3 dias</SelectItem>
            <SelectItem value="7">7 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
