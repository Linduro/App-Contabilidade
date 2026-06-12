"use client";

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { pollIsOpen, type JqPollStored } from "@/lib/rede-teste/poll";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  publicationId: string;
  poll: JqPollStored;
  viewerOptionId: string | null;
  onVote?: (optionId: string, poll: JqPollStored) => void;
};

function resultsToPoll(
  data: {
    expiresAt: Date | null;
    options: { id: string; text: string; votesCount: number }[];
  },
  prev: JqPollStored,
): JqPollStored {
  return {
    endsAt: data.expiresAt
      ? data.expiresAt instanceof Date
        ? data.expiresAt.toISOString()
        : String(data.expiresAt)
      : prev.endsAt,
    options: data.options.map((o) => ({
      id: o.id,
      label: o.text,
      votes: o.votesCount,
    })),
  };
}

export function PublicationPoll({ publicationId, poll, viewerOptionId, onVote }: Props) {
  const [localPoll, setLocalPoll] = useState(poll);
  const [localVote, setLocalVote] = useState(viewerOptionId);

  useEffect(() => {
    setLocalPoll(poll);
    setLocalVote(viewerOptionId);
  }, [poll, viewerOptionId]);

  const utils = trpc.useUtils();
  const vote = trpc.redeTeste.votePoll.useMutation({
    onSuccess: (data, vars) => {
      const next = resultsToPoll(data, localPoll);
      setLocalPoll(next);
      setLocalVote(vars.optionId);
      onVote?.(vars.optionId, next);
      void utils.juridiques.feed.invalidate();
      void utils.juridiques.communityFeed.invalidate();
      void utils.juridiques.userPublications.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const open = pollIsOpen(localPoll);
  const total = localPoll.options.reduce((a, o) => a + o.votes, 0);
  const topVotes = Math.max(...localPoll.options.map((o) => o.votes), 0);
  const endsLabel =
    localPoll.endsAt && open
      ? `Encerra ${formatDistanceToNow(new Date(localPoll.endsAt), { addSuffix: true, locale: ptBR })}`
      : localPoll.endsAt
        ? "Encerrada"
        : null;

  return (
    <div
      className="relative z-10 mt-3 space-y-2 rounded-xl border border-[var(--jq-border)] bg-[var(--jq-surface)] p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-[var(--jq-muted)]">Enquete</p>
        {endsLabel ? <p className="text-xs text-[var(--jq-reply)]">{endsLabel}</p> : null}
      </div>
      {localPoll.options.map((opt) => {
        const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
        const selected = localVote === opt.id;
        const isTop = !open && opt.votes === topVotes && topVotes > 0;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={!open || vote.isPending}
            className={cn(
              "relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition",
              selected || isTop
                ? "border-[var(--jq-primary)] bg-[var(--jq-primary)]/10"
                : "border-[var(--jq-border)] hover:bg-[var(--jq-bg)]/80",
              !open && "cursor-default opacity-80",
            )}
            onClick={(e) => {
              e.stopPropagation();
              vote.mutate({ publicationId, optionId: opt.id });
            }}
          >
            <div
              className="absolute inset-y-0 left-0 bg-[var(--jq-primary)]/15"
              style={{ width: `${pct}%` }}
            />
            <span className="relative flex justify-between gap-2">
              <span>{opt.label}</span>
              <span className="tabular-nums text-[var(--jq-muted)]">{pct}%</span>
            </span>
          </button>
        );
      })}
      <p className="text-xs text-[var(--jq-muted)]">
        {total} {total === 1 ? "voto" : "votos"}
      </p>
    </div>
  );
}
