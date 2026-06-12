"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { JqAvatar } from "../shared/jq-avatar";
import { JqFollowButton } from "../shared/follow-button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const USER_TYPES = [
  "Advogado",
  "Estagiário",
  "Estudante",
  "Juiz",
  "Promotor",
  "Servidor",
  "Outro",
] as const;

const LAW_AREAS = [
  "Civil",
  "Penal",
  "Trabalhista",
  "Tributário",
  "Constitucional",
  "Administrativo",
  "Empresarial",
  "Consumidor",
  "Família",
  "Previdenciário",
  "Digital",
  "Ambiental",
  "Eleitoral",
] as const;

const POST_TEMPLATES = [
  "Olá! Sou [nome] e atuo em [área]. Feliz em fazer parte da comunidade.",
  "Compartilhando uma vitória recente no escritório…",
  "Alguém já lidou com [tema]? Gostaria de trocar experiências.",
] as const;

export function OnboardingView() {
  const router = useRouter();
  const me = trpc.redeTeste.me.useQuery();
  const suggestions = trpc.redeTeste.onboardingSuggestions.useQuery(undefined, {
    enabled: step >= 4,
  });

  const saveStep = trpc.redeTeste.saveOnboardingStep.useMutation();
  const complete = trpc.redeTeste.completeOnboarding.useMutation({
    onSuccess: () => {
      toast.success("Bem-vindo ao Rede Teste!");
      router.replace("/rede-teste");
    },
  });

  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [userType, setUserType] = useState<string>("Advogado");
  const [oabNumber, setOabNumber] = useState("");
  const [oabState, setOabState] = useState("");
  const [institution, setInstitution] = useState("");
  const [location, setLocation] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [firstPost, setFirstPost] = useState("");

  const busy = saveStep.isPending || complete.isPending;

  function toggleInterest(area: string) {
    setInterests((prev) => {
      if (prev.includes(area)) return prev.filter((a) => a !== area);
      if (prev.length >= 8) return prev;
      return [...prev, area];
    });
  }

  async function goNext(payload: Parameters<typeof saveStep.mutateAsync>[0]) {
    await saveStep.mutateAsync(payload);
    if (payload.step >= 5) {
      await complete.mutateAsync();
      return;
    }
    if (payload.step === 3) {
      void suggestions.refetch();
    }
    setStep(payload.step + 1);
  }

  if (me.isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[var(--jq-muted)]" />
      </div>
    );
  }

  const progress = Math.round((step / 5) * 100);

  return (
    <div className="mx-auto min-h-svh max-w-lg px-4 py-8">
      <div className="mb-8">
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-[var(--jq-surface)]">
          <div
            className="h-full bg-[var(--jq-primary)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-[var(--jq-muted)]">
          Etapa {step} de 5
        </p>
      </div>

      {step === 1 ? (
        <section className="space-y-4">
          <h1 className="text-xl font-bold">Seu perfil</h1>
          <p className="text-sm text-[var(--jq-muted)]">
            Perfis completos recebem mais conexões na comunidade.
          </p>
          <Input
            placeholder="Nome de exibição"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={50}
          />
          <Textarea
            placeholder="Bio curta (até 160 caracteres)"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={160}
            rows={3}
          />
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={busy}
              onClick={() => void goNext({ step: 1 })}
            >
              Pular
            </Button>
            <Button
              type="button"
              className="flex-1 rounded-full bg-[var(--jq-primary)]"
              disabled={busy || !displayName.trim()}
              onClick={() =>
                void goNext({
                  step: 1,
                  displayName: displayName.trim(),
                  bio: bio.trim() || null,
                })
              }
            >
              Continuar
            </Button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-4">
          <h1 className="text-xl font-bold">Identidade profissional</h1>
          <label className="text-sm font-medium">Tipo de usuário</label>
          <select
            className="w-full rounded-md border border-[var(--jq-border)] bg-[var(--jq-bg)] px-3 py-2 text-sm"
            value={userType}
            onChange={(e) => setUserType(e.target.value)}
          >
            {USER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {userType === "Advogado" ? (
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Nº OAB"
                value={oabNumber}
                onChange={(e) => setOabNumber(e.target.value)}
              />
              <Input
                placeholder="UF"
                value={oabState}
                onChange={(e) => setOabState(e.target.value.toUpperCase())}
                maxLength={2}
              />
            </div>
          ) : null}
          {userType === "Estudante" ? (
            <Input
              placeholder="Instituição"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            />
          ) : null}
          <Input
            placeholder="Cidade / UF"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={busy}
              onClick={() => void goNext({ step: 2 })}
            >
              Pular
            </Button>
            <Button
              type="button"
              className="flex-1 rounded-full bg-[var(--jq-primary)]"
              disabled={busy}
              onClick={() =>
                void goNext({
                  step: 2,
                  userType,
                  oabNumber: oabNumber || null,
                  oabState: oabState || null,
                  institution: institution || null,
                  location: location || null,
                })
              }
            >
              Continuar
            </Button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-4">
          <h1 className="text-xl font-bold">Áreas de interesse</h1>
          <p className="text-sm text-[var(--jq-muted)]">Escolha de 3 a 8 áreas.</p>
          <div className="flex flex-wrap gap-2">
            {LAW_AREAS.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => toggleInterest(area)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  interests.includes(area)
                    ? "border-[var(--jq-primary)] bg-[var(--jq-primary)]/20 text-[var(--jq-primary)]"
                    : "border-[var(--jq-border)]"
                }`}
              >
                {area}
              </button>
            ))}
          </div>
          <Button
            type="button"
            className="w-full rounded-full bg-[var(--jq-primary)]"
            disabled={busy || interests.length < 3}
            onClick={() => void goNext({ step: 3, interests })}
          >
            Continuar
          </Button>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="space-y-4">
          <h1 className="text-xl font-bold">Siga colegas</h1>
          <p className="text-sm text-[var(--jq-muted)]">
            Siga pelo menos 3 perfis ou pule esta etapa.
          </p>
          <ul className="space-y-3">
            {(suggestions.data ?? []).map((p) => (
              <li
                key={p.userId}
                className="flex items-center gap-3 rounded-lg border border-[var(--jq-border)] p-3"
              >
                <JqAvatar src={p.image} name={p.displayName} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm">{p.displayName}</p>
                  <p className="text-xs text-[var(--jq-muted)]">
                    {p.followersCount} seguidores
                  </p>
                </div>
                <JqFollowButton
                  userId={p.userId}
                  following={followed.has(p.userId)}
                  onSuccess={(following) => {
                    setFollowed((prev) => {
                      const next = new Set(prev);
                      if (following) next.add(p.userId);
                      else next.delete(p.userId);
                      return next;
                    });
                  }}
                />
              </li>
            ))}
          </ul>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={busy}
              onClick={() => void goNext({ step: 4 })}
            >
              Pular
            </Button>
            <Button
              type="button"
              className="flex-1 rounded-full bg-[var(--jq-primary)]"
              disabled={busy}
              onClick={() =>
                void goNext({
                  step: 4,
                  followUserIds: [...followed],
                })
              }
            >
              Continuar
            </Button>
          </div>
        </section>
      ) : null}

      {step === 5 ? (
        <section className="space-y-4">
          <h1 className="text-xl font-bold">Primeira publicação</h1>
          <p className="text-sm text-[var(--jq-muted)]">Opcional — você pode pular.</p>
          <div className="flex flex-wrap gap-2">
            {POST_TEMPLATES.map((t) => (
              <button
                key={t}
                type="button"
                className="rounded-lg border border-[var(--jq-border)] px-3 py-2 text-left text-xs hover:bg-[var(--jq-surface)]"
                onClick={() => setFirstPost(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <Textarea
            value={firstPost}
            onChange={(e) => setFirstPost(e.target.value)}
            maxLength={560}
            rows={4}
            placeholder="Escreva sua primeira publicação…"
          />
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={busy}
              onClick={() => void goNext({ step: 5 })}
            >
              Pular
            </Button>
            <Button
              type="button"
              className="flex-1 rounded-full bg-[var(--jq-primary)]"
              disabled={busy}
              onClick={() =>
                void goNext({
                  step: 5,
                  firstPostContent: firstPost.trim() || null,
                })
              }
            >
              Entrar no feed
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
