"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History, Loader2, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

type Props = {
  onContinue: (draft: { id: string; content: string; practiceArea: string | null }) => void;
};

export function ComposerDraftsDrawer({ onContinue }: Props) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const drafts = trpc.redeTeste.listDrafts.useQuery(
    { limit: 10 },
    { enabled: open, staleTime: 0 },
  );
  const remove = trpc.redeTeste.deleteDraft.useMutation({
    onSuccess: () => {
      void utils.redeTeste.listDrafts.invalidate();
      toast.success("Rascunho excluído");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void drafts.refetch();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-full text-[var(--jq-muted)] hover:bg-[var(--jq-primary)]/15 hover:text-[var(--jq-primary)]"
          aria-label="Ver rascunhos salvos"
        >
          <History className="size-5" strokeWidth={1.75} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="z-[60] w-[min(calc(100vw-2rem),20rem)] border-[var(--jq-border)] bg-[var(--jq-bg)] p-0 text-[var(--jq-text)] shadow-xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b border-[var(--jq-border)] px-4 py-3">
          <p className="text-sm font-semibold">Rascunhos</p>
        </div>
        <ul className="max-h-[min(60vh,320px)] space-y-3 overflow-y-auto p-3">
          {drafts.isError ? (
            <li className="py-2 text-sm text-red-500">
              Não foi possível carregar rascunhos.
              {drafts.error?.message ? ` (${drafts.error.message})` : null}
            </li>
          ) : null}
          {drafts.isLoading || drafts.isFetching ? (
            <li className="flex items-center justify-center gap-2 py-6 text-sm text-[var(--jq-muted)]">
              <Loader2 className="size-4 animate-spin" /> Carregando…
            </li>
          ) : null}
          {drafts.data?.drafts.map((d) => (
            <li
              key={d.id}
              className="rounded-lg border border-[var(--jq-border)] bg-[var(--jq-surface)] p-3"
            >
              <p className="line-clamp-3 text-sm">
                {d.content.trim().slice(0, 100) || "(sem texto)"}
              </p>
              <p className="mt-1 text-xs text-[var(--jq-muted)]">
                {format(new Date(d.createdAt), "dd MMM yyyy, HH:mm", { locale: ptBR })}
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    onContinue(d);
                    setOpen(false);
                  }}
                >
                  Continuar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Excluir rascunho"
                  onClick={() => remove.mutate({ id: d.id })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
          {!drafts.data?.drafts.length && !drafts.isLoading && !drafts.isFetching ? (
            <p className="py-2 text-sm text-[var(--jq-muted)]">Nenhum rascunho salvo.</p>
          ) : null}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
