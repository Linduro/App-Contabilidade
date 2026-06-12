"use client";

import Link from "next/link";
import { ArrowLeft, Users, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CommunitySettingsPanel } from "./community-settings-panel";

export function CommunitiesView() {
  const { data, isLoading, refetch } = trpc.redeTeste.listCommunities.useQuery();
  const join = trpc.redeTeste.joinCommunity.useMutation({
    onSuccess: () => {
      toast.success("Você entrou na comunidade");
      void refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="min-h-full border-x border-[var(--jq-border)]">
      <header className="sticky top-0 z-10 border-b border-[var(--jq-border)] bg-[var(--jq-bg)]/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/rede-teste" className="rounded-full p-2 hover:bg-[var(--jq-surface)]">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Jurisdição</h1>
            <p className="text-sm text-[var(--jq-muted)]">
              Espaços que você participa — seu território livre na rede
            </p>
          </div>
        </div>
      </header>

      <div className="border-b border-[var(--jq-border)] bg-[var(--jq-surface)] px-4 py-3 text-sm text-[var(--jq-muted)]">
        Cada <strong className="text-[var(--jq-text)]">Jurisdição</strong> é um espaço seu, com
        liberdade criativa — use como página do escritório ou como um cantinho pessoal totalmente
        livre.
      </div>

      <div className="divide-y divide-[var(--jq-border)]">
        {isLoading ? (
          <p className="p-8 text-center text-[var(--jq-muted)]">Carregando…</p>
        ) : (
          data?.map((c) => (
            <article key={c.id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/rede-teste/comunidades/${c.slug}`}
                    className="text-lg font-bold hover:underline"
                  >
                    {c.name}
                  </Link>
                  {c.description ? (
                    <p className="mt-1 text-sm text-[var(--jq-muted)]">{c.description}</p>
                  ) : null}
                  <div className="mt-2 flex gap-4 text-xs text-[var(--jq-muted)]">
                    <span className="flex items-center gap-1">
                      <Users className="size-3" />
                      {c.membersCount} membros
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="size-3" />
                      {c.publicationsCount} posts
                    </span>
                  </div>
                  {c.isMember ? (
                    <CommunitySettingsPanel
                      communityId={c.id}
                      name={c.name}
                      description={c.description}
                      isMember={c.isMember}
                      memberRole={c.memberRole}
                      onUpdated={() => void refetch()}
                    />
                  ) : null}
                </div>
                {c.isMember ? (
                  <Button asChild variant="outline" size="sm" className="jq-btn-outline shrink-0">
                    <Link href={`/rede-teste/comunidades/${c.slug}`}>Abrir</Link>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[var(--jq-primary)] text-[var(--jq-on-primary)]"
                    disabled={join.isPending}
                    onClick={() => join.mutate({ communityId: c.id })}
                  >
                    Entrar
                  </Button>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
