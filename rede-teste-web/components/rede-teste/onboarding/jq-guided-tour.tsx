"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import { Button } from "@/components/ui/button";

const STEPS: { selector: string; text: string }[] = [
  { selector: "[data-tour='compose']", text: "Aqui você cria sua primeira publicação." },
  { selector: "a[href='/rede-teste/explorar']", text: "Descubra tendências e profissionais." },
  { selector: "a[href='/rede-teste/mensagens']", text: "Converse de forma sigilosa com colegas." },
  { selector: "a[href='/rede-teste/notificacoes']", text: "Acompanhe quem interage com você." },
  { selector: "[data-tour='right-rail']", text: "Tendências jurídicas do momento." },
];

export function JqGuidedTour() {
  const me = trpc.redeTeste.me.useQuery();
  const complete = trpc.redeTeste.completeTour.useMutation();
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!me.data?.onboardingCompleted || me.data.tourCompleted) return;
    const t = setTimeout(() => setActive(true), 800);
    return () => clearTimeout(t);
  }, [me.data?.onboardingCompleted, me.data?.tourCompleted]);

  if (!active || step >= STEPS.length) return null;

  const current = STEPS[step]!;
  const el =
    typeof document !== "undefined"
      ? document.querySelector(current.selector)
      : null;

  function finish() {
    setActive(false);
    complete.mutate();
  }

  function next() {
    if (step >= STEPS.length - 1) finish();
    else setStep((s) => s + 1);
  }

  const rect = el?.getBoundingClientRect();

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label="Tour guiado">
      <div className="absolute inset-0 bg-black/60" onClick={finish} />
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-[var(--jq-primary)] ring-offset-2 ring-offset-transparent"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        />
      ) : null}
      <div className="absolute bottom-24 left-1/2 z-10 w-[min(340px,90vw)] -translate-x-1/2 rounded-xl border border-[var(--jq-border)] bg-[var(--jq-bg)] p-4 shadow-xl">
        <p className="text-sm">{current.text}</p>
        <p className="mt-2 text-xs text-[var(--jq-muted)]">
          {step + 1} de {STEPS.length}
        </p>
        <div className="mt-4 flex justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={finish}>
            Pular tour
          </Button>
          <Button
            type="button"
            size="sm"
            className="rounded-full bg-[var(--jq-primary)]"
            onClick={next}
          >
            {step >= STEPS.length - 1 ? "Concluir" : "Próximo"}
          </Button>
        </div>
      </div>
    </div>
  );
}
