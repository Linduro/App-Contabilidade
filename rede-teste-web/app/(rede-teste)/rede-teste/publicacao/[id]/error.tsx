"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { captureException } from "@/lib/observability";

export default function RedeTestePublicationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  captureException(error);
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-lg font-bold text-[var(--jq-primary)]">Não foi possível abrir a publicação</h1>
      <p className="mt-2 max-w-sm text-sm text-[var(--jq-muted)]">
        Tente novamente. Se persistir, volte ao início e abra a publicação por lá.
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

