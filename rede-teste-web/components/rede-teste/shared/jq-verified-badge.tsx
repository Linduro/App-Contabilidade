import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  type?: string | null;
  className?: string;
  /** OAB declarada no perfil, sem validação no registro (Beta). */
  showOabBeta?: boolean;
};

export function JqVerifiedBadge({ type, className, showOabBeta }: Props) {
  if (!type || type === "NONE") return null;

  const color =
    type === "LAWYER"
      ? "text-[var(--jq-reply)]"
      : type === "FIRM"
        ? "text-[var(--jq-accent)]"
        : "text-[var(--jq-muted)]";

  const ariaLabel =
    type === "LAWYER"
      ? showOabBeta
        ? "Advogado — OAB declarada (Beta)"
        : "Advogado verificado"
      : type === "FIRM"
        ? "Escritório verificado"
        : "Instituição verificada";

  return (
    <span className="inline-flex items-center gap-0.5">
      <Scale className={cn("size-4 shrink-0", color, className)} aria-label={ariaLabel} />
      {showOabBeta ? (
        <span className="rounded bg-[var(--jq-surface)] px-1 text-[10px] font-semibold uppercase text-[var(--jq-muted)]">
          Beta
        </span>
      ) : null}
    </span>
  );
}
