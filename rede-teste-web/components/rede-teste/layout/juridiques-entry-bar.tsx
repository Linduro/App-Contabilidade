"use client";

import { Scale } from "lucide-react";

/**
 * Barra informativa — rede social vs operação do escritório (sem CTA para o painel).
 */
export function RedeTesteEntryBar() {
  return (
    <div
      className="border-b border-[var(--jq-border)] bg-gradient-to-r from-[var(--jq-primary)] to-[#243656] px-4 py-3 text-white"
      role="region"
      aria-label="Você está no Rede Teste"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15"
          aria-hidden
        >
          <Scale className="size-5 text-[var(--jq-accent)]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">Você está no Rede Teste</p>
          <p className="mt-0.5 text-xs text-white/75">
            Rede aberta do Direito — conecte-se com qualquer profissional na plataforma. Clientes,
            processos e intimações ficam no Portal do seu escritório.
          </p>
        </div>
      </div>
    </div>
  );
}
