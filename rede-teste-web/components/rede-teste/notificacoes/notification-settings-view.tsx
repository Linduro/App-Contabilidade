"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc-client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { JqQueryState } from "../shared/jq-query-state";
import type { JqNotifPrefs } from "@/lib/rede-teste/notification-prefs";

type RowProps = {
  label: string;
  inApp: boolean;
  email: boolean;
  push: boolean;
  onInApp: (v: boolean) => void;
  onEmail: (v: boolean) => void;
  onPush: (v: boolean) => void;
  hidePush?: boolean;
};

function PrefRow({
  label,
  inApp,
  email,
  push,
  onInApp,
  onEmail,
  onPush,
  hidePush,
}: RowProps) {
  return (
    <div className="border-b border-[var(--jq-border)] px-4 py-4">
      <p className="mb-3 text-sm font-bold">{label}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-8">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={inApp} onCheckedChange={onInApp} />
          No app
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={email} onCheckedChange={onEmail} />
          E-mail
        </label>
        {!hidePush ? (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={push} onCheckedChange={onPush} />
            Push
          </label>
        ) : null}
      </div>
    </div>
  );
}

export function NotificationSettingsView() {
  const prefs = trpc.redeTeste.notificationPreferences.useQuery();
  const update = trpc.redeTeste.updateNotificationPreferences.useMutation({
    onSuccess: () => {
      toast.success("Preferências salvas");
      void prefs.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const p = prefs.data;

  function save(patch: Partial<JqNotifPrefs>) {
    update.mutate(patch);
  }

  return (
    <div>
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--jq-border)] bg-[var(--jq-bg)]/90 px-4 py-3 backdrop-blur-md">
        <Link href="/rede-teste/configuracoes" className="rounded-full p-2 hover:bg-[var(--jq-surface)]" aria-label="Voltar">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-bold">Notificações</h1>
      </header>

      <JqQueryState
        isLoading={prefs.isLoading}
        isError={prefs.isError}
        error={prefs.error}
        onRetry={() => void prefs.refetch()}
        errorFallback="Não foi possível carregar as preferências."
      >
        {p ? (
          <div>
            <PrefRow
              label="Curtidas"
              inApp={p.likesInApp}
              email={p.likesEmail}
              push={p.likesPush}
              hidePush
              onInApp={(v) => save({ likesInApp: v })}
              onEmail={(v) => save({ likesEmail: v })}
              onPush={(v) => save({ likesPush: v })}
            />
            <PrefRow
              label="Comentários e respostas"
              inApp={p.commentsInApp}
              email={p.commentsEmail}
              push={p.commentsPush}
              onInApp={(v) => save({ commentsInApp: v })}
              onEmail={(v) => save({ commentsEmail: v })}
              onPush={(v) => save({ commentsPush: v })}
            />
            <PrefRow
              label="Menções"
              inApp={p.mentionsInApp}
              email={p.mentionsEmail}
              push={p.mentionsPush}
              onInApp={(v) => save({ mentionsInApp: v })}
              onEmail={(v) => save({ mentionsEmail: v })}
              onPush={(v) => save({ mentionsPush: v })}
            />
            <PrefRow
              label="Novos seguidores"
              inApp={p.followersInApp}
              email={p.followersEmail}
              push={p.followersPush}
              onInApp={(v) => save({ followersInApp: v })}
              onEmail={(v) => save({ followersEmail: v })}
              onPush={(v) => save({ followersPush: v })}
            />
            <PrefRow
              label="Republicações"
              inApp={p.repostsInApp}
              email={p.repostsEmail}
              push={p.repostsPush}
              hidePush
              onInApp={(v) => save({ repostsInApp: v })}
              onEmail={(v) => save({ repostsEmail: v })}
              onPush={(v) => save({ repostsPush: v })}
            />
            <div className="border-b border-[var(--jq-border)] px-4 py-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="weekly-digest" className="text-sm font-bold">
                  Resumo semanal por e-mail
                </Label>
                <Switch
                  id="weekly-digest"
                  checked={p.weeklyDigestEmail}
                  onCheckedChange={(v) => save({ weeklyDigestEmail: v })}
                />
              </div>
            </div>
            <div className="px-4 py-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="marketing-opt-out" className="text-sm text-[var(--jq-muted)]">
                  Não receber e-mails de marketing
                </Label>
                <Switch
                  id="marketing-opt-out"
                  checked={p.marketingOptOut}
                  onCheckedChange={(v) => save({ marketingOptOut: v })}
                />
              </div>
            </div>
            {update.isPending ? (
              <p className="flex items-center justify-center gap-2 py-2 text-xs text-[var(--jq-muted)]">
                <Loader2 className="size-3 animate-spin" /> Salvando…
              </p>
            ) : null}
          </div>
        ) : null}
      </JqQueryState>
    </div>
  );
}
