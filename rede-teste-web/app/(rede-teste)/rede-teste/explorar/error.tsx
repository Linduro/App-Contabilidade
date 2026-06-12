"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { captureException } from "@/lib/observability";

export default function RedeTesteExplorarError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  captureException(error);
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-lg font-bold text-[var(--jq-primary)]">Não foi possível carregar a busca</h1>
      <p className="mt-2 max-w-sm text-sm text-[var(--jq-muted)]">
        Tente novamente ou volte ao início.
      </p>
      <div className="mt-6 flex gap-3">
        <Button type="button" variant="outline" className="rounded-full" onClick={reset}>
          Tentar novamente
        </Button>
        <Button asChild className="rounded-full bg-[var(--jq-primary)]">
          <Link href="/rede-teste">Voltar ao início</Link>
        </Button>
      </div>
    </div>
  );
}

