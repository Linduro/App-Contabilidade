"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { buildRedeTesteProfileInviteUrl } from "@/lib/rede-teste/invite-url";

import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { JqVerifiedBadge } from "../shared/jq-verified-badge";
import { formatJqHandle } from "@/lib/rede-teste/format";
import { jqProfilePath } from "@/lib/rede-teste/profile-path";

const schema = z.object({
  displayName: z.string().min(2).max(80),
  bio: z.string().max(280),
  location: z.string().max(80),
});

export function RedeTesteConfigForm() {
  const me = trpc.redeTeste.me.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.redeTeste.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil atualizado");
      void utils.redeTeste.me.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: "", bio: "", location: "" },
  });

  useEffect(() => {
    if (!me.data) return;
    form.reset({
      displayName: me.data.displayName,
      bio: me.data.bio ?? "",
      location: me.data.location ?? "",
    });
  }, [me.data, form]);

  function onSubmit(data: z.infer<typeof schema>) {
    update.mutate({
      displayName: data.displayName,
      bio: data.bio || null,
      location: data.location || null,
    });
  }

  if (me.isLoading) {
    return <p className="p-8 text-sm text-[var(--jq-muted)]">Carregando…</p>;
  }

  return (
    <div className="p-4">
      <header className="mb-6 flex items-center gap-3">
        <Link href="/rede-teste" className="text-sm text-[var(--jq-reply)] hover:underline">
          ← Início
        </Link>
        <h1 className="text-xl font-bold">Configurações</h1>
      </header>

      {me.data?.oabVerified && me.data.oabNumber && me.data.oabUf ? (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-[var(--jq-border)] bg-[var(--jq-surface)] px-4 py-3 text-sm">
          <JqVerifiedBadge type="LAWYER" showOabBeta={!me.data.oabRegistryVerified} />
          <span>
            OAB {me.data.oabNumber}/{me.data.oabUf} — selo de advogado
            {me.data.oabRegistryVerified ? " (verificado no registro)" : " (declaratório, Beta)"}
          </span>
        </div>
      ) : (
        <p className="mb-6 rounded-xl border border-dashed border-[var(--jq-border)] px-4 py-3 text-sm text-[var(--jq-muted)]">
          Cadastre sua OAB em{" "}
          <Link href="/intimacoes/config" className="text-[var(--jq-reply)] underline">
            Intimações → OAB
          </Link>{" "}
          para exibir o selo de advogado no Rede Teste.
        </p>
      )}

      <p className="mb-4 text-sm">
        <Link
          href="/rede-teste/configuracoes/notificacoes"
          className="text-[var(--jq-reply)] underline"
        >
          Preferências de notificações
        </Link>
        {" · "}
        <span className="text-[var(--jq-muted)]">
          {me.data?.handle ? formatJqHandle(me.data.handle) : ""} — o @ não pode ser alterado aqui.
        </span>
        {me.data?.handle ? (
          <>
            {" "}
            <Link href={jqProfilePath(me.data.handle)} className="text-[var(--jq-reply)] underline">
              Ver perfil público (estilo X)
            </Link>
          </>
        ) : null}
      </p>

      {me.data?.handle ? (
        <section className="mx-auto mb-6 max-w-md rounded-xl border border-[var(--jq-border)] bg-[var(--jq-surface)] p-4">
          <h2 className="font-semibold text-[var(--jq-text)]">Convidar colegas</h2>
          <p className="mt-1 text-sm text-[var(--jq-muted)]">
            Compartilhe seu perfil. Quem abrir o link verá sua página no Rede Teste.
          </p>
          {me.data.referralsFromMyLink != null && me.data.referralsFromMyLink > 0 ? (
            <p className="mt-2 text-sm text-[var(--jq-primary)]">
              {me.data.referralsFromMyLink} colega(s) entraram pelo seu link.
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Input
              readOnly
              value={buildRedeTesteProfileInviteUrl(me.data.handle)}
              className="bg-[var(--jq-bg)] text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 border border-[var(--jq-border)] bg-white text-black hover:bg-neutral-100 hover:text-black"
              aria-label="Copiar link"
              onClick={async () => {
                const url = buildRedeTesteProfileInviteUrl(me.data!.handle);
                await navigator.clipboard.writeText(url);
                toast.success("Link copiado");
              }}
            >
              <Copy className="size-4" />
            </Button>
          </div>
        </section>
      ) : null}

      <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto max-w-md space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Nome exibido</label>
          <Input {...form.register("displayName")} className="bg-[var(--jq-surface)]" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Bio</label>
          <Textarea {...form.register("bio")} rows={3} className="bg-[var(--jq-surface)]" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Localização</label>
          <Input {...form.register("location")} placeholder="São Paulo, SP" className="bg-[var(--jq-surface)]" />
        </div>
        <Button
          type="submit"
          disabled={update.isPending}
          className="w-full rounded-full bg-[var(--jq-primary)]"
        >
          {update.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          Salvar
        </Button>
      </form>
    </div>
  );
}
