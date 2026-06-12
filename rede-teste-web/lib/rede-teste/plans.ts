import type { TenantPlan } from "@prisma/client";

/** Plano Junior (agendamento): Solo e acima. */
export function hasJqJuniorPlan(plan: TenantPlan): boolean {
  return plan === "SOLO" || plan === "EQUIPE" || plan === "ESCRITORIO";
}

/** Plano Pleno (threads): Equipe e Escritório. */
export function hasJqPlenoPlan(plan: TenantPlan): boolean {
  return plan === "EQUIPE" || plan === "ESCRITORIO";
}

export type JqComposerFeatures = {
  schedule: boolean;
  threads: boolean;
  plan: TenantPlan;
  juniorLabel: string;
  plenoLabel: string;
};

export function getJqComposerFeatures(plan: TenantPlan): JqComposerFeatures {
  return {
    schedule: hasJqJuniorPlan(plan),
    threads: hasJqPlenoPlan(plan),
    plan,
    juniorLabel: "Junior",
    plenoLabel: "Pleno",
  };
}
