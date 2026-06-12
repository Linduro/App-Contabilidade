"use client";

import Link from "next/link";
import { ArrowLeft, Check, Crown, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const PLAN_PERKS: Record<string, string[]> = {
  SOLO: [
    "Agendamento de publicações",
    "Publicações estendidas",
    "Selo de profissional verificado",
  ],
  EQUIPE: [
    "Tudo do Solo",
    "Threads (publicações encadeadas)",
    "Analytics do perfil",
  ],
  ESCRITORIO: [
    "Tudo do Equipe",
    "Página do escritório (Jurisdição)",
    "Usuários ilimitados e sigilo do escritório",
  ],
};

export function JqPlanosView() {
  const { data, isLoading } = trpc.billing.status.useQuery();
  const checkout = trpc.billing.createCheckout.useMutation({
    onSuccess: (r) => {
      window.location.href = r.url;
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--jq-border)] bg-[var(--jq-bg)]/90 px-4 py-3 backdrop-blur-md">
        <Link
          href="/rede-teste"
          className="rounded-full p-2 hover:bg-[var(--jq-surface)]"
          aria-label="Voltar"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <Crown className="size-5 text-[var(--jq-accent)]" />
            Plano
          </h1>
        </div>
      </header>

      <div className="space-y-5 p-4">
        <div className="rounded-2xl border border-[var(--jq-border)] bg-[var(--jq-surface)] p-4">
          <p className="text-sm">
            Sua assinatura vale nos <strong>dois mundos</strong>: além dos recursos do
            Rede Teste, o mesmo plano libera as ferramentas de gestão do escritório no{" "}
            <strong>Portal</strong> (clientes, processos, prazos, financeiro e mais).
          </p>
        </div>

        {isLoading || !data ? (
          <p className="flex items-center justify-center gap-2 py-10 text-[var(--jq-muted)]">
            <Loader2 className="size-5 animate-spin" />
            Carregando planos…
          </p>
        ) : (
          <>
            <p className="text-sm text-[var(--jq-muted)]">
              Plano atual: <strong className="text-[var(--jq-text)]">{data.tenant.plan}</strong>
              {data.tenant.status === "TRIAL" ? " · período de avaliação" : ""}
            </p>

            {!data.stripeConfigured ? (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-300">
                Pagamentos ainda não habilitados neste ambiente. Tente novamente em breve.
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.plans.map((p) => {
                const isCurrent = data.tenant.plan === p.plan;
                const perks = PLAN_PERKS[p.plan] ?? [];
                return (
                  <div
                    key={p.plan}
                    className="flex flex-col rounded-2xl border border-[var(--jq-border)] bg-[var(--jq-surface)] p-5"
                  >
                    <p className="text-lg font-bold">{p.label}</p>
                    <p className="mt-1 text-2xl font-extrabold">
                      R$ {p.priceBrl}
                      <span className="text-sm font-medium text-[var(--jq-muted)]">/mês</span>
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--jq-muted)]">
                      {p.maxUsers >= 999 ? "Usuários ilimitados" : `Até ${p.maxUsers} usuários`}
                    </p>
                    <ul className="mt-4 flex-1 space-y-2 text-sm">
                      {perks.map((perk) => (
                        <li key={perk} className="flex items-start gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-[var(--jq-repost)]" />
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="mt-5 w-full rounded-full bg-[var(--jq-primary)] font-bold text-[var(--jq-on-primary)] hover:bg-[var(--jq-primary)]/90"
                      disabled={
                        isCurrent ||
                        !data.stripeConfigured ||
                        checkout.isPending ||
                        !p.priceId
                      }
                      onClick={() =>
                        checkout.mutate({
                          plan: p.plan as "SOLO" | "EQUIPE" | "ESCRITORIO",
                        })
                      }
                    >
                      {checkout.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : isCurrent ? (
                        "Plano atual"
                      ) : (
                        "Assinar"
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-xs text-[var(--jq-muted)]">
              Gerencie faturas e forma de pagamento no Portal ·{" "}
              <Link href="/billing" className="text-[var(--jq-reply)] hover:underline">
                abrir assinatura
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
