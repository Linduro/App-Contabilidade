"use client";

import { Calendar, MapPin, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { Loader2 } from "lucide-react";
import { useJqProfile } from "./profile-context";

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 border-b border-[var(--jq-border)] py-4 last:border-0">
      <Icon className="mt-0.5 size-5 shrink-0 text-[var(--jq-muted)]" aria-hidden />
      <div>
        <dt className="text-sm text-[var(--jq-muted)]">{label}</dt>
        <dd className="mt-0.5 font-medium">{value}</dd>
      </div>
    </div>
  );
}

export function ProfileAboutTab() {
  const profile = useJqProfile();
  const about = trpc.redeTeste.profileAbout.useQuery({ handle: profile.handle });

  if (about.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-6 animate-spin text-[var(--jq-muted)]" />
      </div>
    );
  }

  if (!about.data) return null;

  const joined = new Date(about.data.createdAt).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  return (
    <dl className="px-4">
      <Row icon={Calendar} label="Entrou em" value={joined} />
      {about.data.location ? (
        <Row icon={MapPin} label="Localização" value={about.data.location} />
      ) : null}
      {about.data.oabVerified ? (
        <Row icon={ShieldCheck} label="OAB" value="Verificada no Rede Teste" />
      ) : null}
    </dl>
  );
}
