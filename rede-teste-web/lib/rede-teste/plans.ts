import type { TenantPlan } from "@prisma/client";

/** Plano Junior (agendamento): Trial+ para Rede Teste demo. */
export function hasJqJuniorPlan(plan: TenantPlan): boolean {
  return (
    plan === "TRIAL" ||
    plan === "SOLO" ||
    plan === "EQUIPE" ||
    plan === "ESCRITORIO"
  );
}

/** Plano Pleno (threads): Trial+ para Rede Teste demo. */
export function hasJqPlenoPlan(plan: TenantPlan): boolean {
  return plan === "TRIAL" || plan === "EQUIPE" || plan === "ESCRITORIO";
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
