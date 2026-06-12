"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Shield, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { jqProfilePath } from "@/lib/rede-teste/profile-path";

export function RedeTesteModerationPanel() {
  const utils = trpc.useUtils();
  const summary = trpc.redeTeste.moderationSummary.useQuery();
  const analytics = trpc.redeTeste.juridiquesAnalytics.useQuery();
  const referrals = trpc.redeTeste.listReferrals.useQuery({ take: 15 });
  const leaderboard = trpc.redeTeste.referralLeaderboard.useQuery({ take: 5 });
  const { data, isLoading, refetch } = trpc.redeTeste.listModerationReports.useQuery({
    take: 50,
  });

  const resolve = trpc.redeTeste.resolveModeration.useMutation({
    onSuccess: (res) => {
      toast.success(
        res.action === "remove"
          ? "Publicação removida"
          : "Denúncias arquivadas",
      );
      void utils.juridiques.moderationSummary.invalidate();
      void refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="min-h-full border-x border-[var(--jq-border)]">
      <header className="sticky top-0 z-10 border-b border-[var(--jq-border)] bg-[var(--jq-bg)]/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/rede-teste"
            className="rounded-full p-2 transition hover:bg-[var(--jq-surface)]"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex-1">
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <Shield className="size-5 text-[var(--jq-primary)]" />
              Moderação
            </h1>
            <p className="text-sm text-[var(--jq-muted)]">
              Denúncias na rede — visível só para o proprietário do escritório
            </p>
          </div>
          {summary.data && summary.data.pendingReports > 0 ? (
            <Badge variant="destructive">{summary.data.pendingReports} pendente(s)</Badge>
          ) : null}
        </div>
      </header>

      {analytics.data ? (
        <div className="grid grid-cols-2 gap-2 border-b border-[var(--jq-border)] p-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Publicações", value: analytics.data.publications },
            { label: "Perfis", value: analytics.data.members },
            { label: "Convites", value: analytics.data.referrals },
            { label: "Denúncias", value: analytics.data.reports },
            { label: "Comunidades", value: analytics.data.communities },
            { label: "Mensagens DM", value: analytics.data.dms },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-[var(--jq-border)] bg-[var(--jq-surface)] px-3 py-2 text-center"
            >
              <p className="text-lg font-bold tabular-nums">{s.value}</p>
              <p className="text-xs text-[var(--jq-muted)]">{s.label}</p>
            </div>
          ))}
        </div>
      ) : null}

      {analytics.data ? (
        <div className="border-b border-[var(--jq-border)] p-4 space-y-4">
          <h2 className="font-semibold">Convites (?ref=)</h2>
          {leaderboard.data && leaderboard.data.length > 0 ? (
            <div>
              <p className="mb-2 text-xs text-[var(--jq-muted)]">Top indicadores</p>
              <ul className="space-y-1 text-sm">
                {leaderboard.data.map((row) => (
                  <li key={row.userId} className="flex justify-between gap-2">
                    <Link
                      href={jqProfilePath(row.handle)}
                      className="font-medium hover:underline"
                    >
                      @{row.handle}
                    </Link>
                    <span className="tabular-nums text-[var(--jq-muted)]">{row.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {referrals.data && referrals.data.length > 0 ? (
            <div>
              <p className="mb-2 text-xs text-[var(--jq-muted)]">Últimas atribuições</p>
              <ul className="divide-y divide-[var(--jq-border)] rounded-lg border border-[var(--jq-border)] text-sm">
                {referrals.data.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span>
                      <Link href={jqProfilePath(r.referred.handle)} className="hover:underline">
                        @{r.referred.handle}
                      </Link>
                      <span className="text-[var(--jq-muted)]"> via </span>
                      <Link href={jqProfilePath(r.referrer.handle)} className="hover:underline">
                        @{r.referrer.handle}
                      </Link>
                    </span>
                    <time className="text-xs text-[var(--jq-muted)]">
                      {format(new Date(r.createdAt), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </time>
                  </li>
                ))}
              </ul>
            </div>
          ) : !referrals.isLoading ? (
            <p className="text-sm text-[var(--jq-muted)]">Nenhum convite registrado ainda.</p>
          ) : null}
        </div>
      ) : null}

      <div className="p-4 space-y-4">
        <h2 className="font-semibold">Denúncias</h2>
        {isLoading ? (
          <p className="py-12 text-center text-[var(--jq-muted)]">Carregando fila…</p>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div className="rounded-xl border border-[var(--jq-border)] bg-[var(--jq-surface)] p-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 size-10 text-emerald-600" />
            <p className="font-medium">Nenhuma denúncia pendente</p>
            <p className="mt-1 text-sm text-[var(--jq-muted)]">
              Quando alguém denunciar uma publicação, ela aparecerá aqui.
            </p>
          </div>
        ) : (
          data?.items.map((item) => (
            <article
              key={item.publicationId}
              className="rounded-xl border border-[var(--jq-border)] bg-[var(--jq-surface)] overflow-hidden"
            >
              <div className="border-b border-[var(--jq-border)] px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link
                      href={jqProfilePath(item.author.handle)}
                      className="font-semibold hover:underline"
                    >
                      @{item.author.handle}
                    </Link>
                    <p className="text-xs text-[var(--jq-muted)]">
                      {format(new Date(item.createdAt), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {item.reports.length} denúncia(s)
                  </Badge>
                </div>
                <p className="mt-2 text-sm whitespace-pre-wrap">{item.content}</p>
                <Link
                  href={`/rede-teste/publicacao/${item.publicationId}`}
                  className="mt-2 inline-block text-sm text-[var(--jq-reply)] hover:underline"
                >
                  Ver publicação
                </Link>
              </div>

              <ul className="divide-y divide-[var(--jq-border)] px-4">
                {item.reports.map((r) => (
                  <li key={r.id} className="py-3 text-sm">
                    <p className="font-medium">
                      @{r.reporter.handle}{" "}
                      <span className="font-normal text-[var(--jq-muted)]">
                        — {format(new Date(r.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </p>
                    <p className="mt-1 text-[var(--jq-muted)]">{r.reason}</p>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-2 border-t border-[var(--jq-border)] p-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={resolve.isPending}
                  onClick={() =>
                    resolve.mutate({
                      publicationId: item.publicationId,
                      action: "dismiss",
                    })
                  }
                >
                  Arquivar denúncias
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={resolve.isPending}
                  onClick={() => {
                    if (
                      confirm(
                        "Remover esta publicação do Rede Teste? Esta ação não pode ser desfeita pelo autor.",
                      )
                    ) {
                      resolve.mutate({
                        publicationId: item.publicationId,
                        action: "remove",
                      });
                    }
                  }}
                >
                  <Trash2 className="mr-1 size-4" />
                  Remover publicação
                </Button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
