"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { JqPublicationDto } from "@/lib/rede-teste/publication-dto";

export function ScheduledPublicationsView({
  initial,
}: {
  initial: JqPublicationDto[];
}) {
  const utils = trpc.useUtils();
  const list = trpc.redeTeste.listScheduledPublications.useQuery(undefined, {
    initialData: initial,
  });
  const cancel = trpc.redeTeste.cancelScheduledPublication.useMutation({
    onSuccess: () => {
      toast.success("Agendamento cancelado");
      void utils.juridiques.listScheduledPublications.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen border-x border-[var(--jq-border)]">
      <header className="sticky top-0 z-10 border-b border-[var(--jq-border)] bg-[var(--jq-bg)]/90 px-4 py-3 backdrop-blur">
        <h1 className="text-xl font-bold">Publicações agendadas</h1>
        <p className="text-sm text-[var(--jq-muted)]">
          Gerencie o que será publicado automaticamente.
        </p>
      </header>
      <ul>
        {list.data?.map((pub) => (
          <li
            key={pub.id}
            className="flex gap-3 border-b border-[var(--jq-border)] px-4 py-4"
          >
            <CalendarClock className="mt-1 size-5 shrink-0 text-[var(--jq-primary)]" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-3 text-sm">{pub.content}</p>
              {pub.scheduledAt ? (
                <p className="mt-1 text-xs text-[var(--jq-primary)]">
                  {format(new Date(pub.scheduledAt), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                asChild
              >
                <Link href={`/rede-teste/publicacao/${pub.id}`}>Ver</Link>
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Cancelar agendamento"
                onClick={() => cancel.mutate({ id: pub.id })}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
        {!list.data?.length ? (
          <li className="px-4 py-12 text-center text-sm text-[var(--jq-muted)]">
            Nenhuma publicação agendada.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
