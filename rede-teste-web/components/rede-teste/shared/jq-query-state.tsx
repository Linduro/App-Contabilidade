"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jqErrorMessage } from "@/lib/rede-teste/trpc-error-message";

type Props = {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry?: () => void;
  loadingLabel?: string;
  errorFallback: string;
  children: React.ReactNode;
};

export function JqQueryState({
  isLoading,
  isError,
  error,
  onRetry,
  loadingLabel = "Carregando…",
  errorFallback,
  children,
}: Props) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16" role="status">
        <Loader2 className="size-6 animate-spin text-[var(--jq-muted)]" aria-hidden />
        <span className="text-sm text-[var(--jq-muted)]">{loadingLabel}</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-sm text-red-400">{jqErrorMessage(error, errorFallback)}</p>
        {onRetry ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 rounded-full"
            onClick={onRetry}
          >
            Tentar novamente
          </Button>
        ) : null}
      </div>
    );
  }

  return <>{children}</>;
}
