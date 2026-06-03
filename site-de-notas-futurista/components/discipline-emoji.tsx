import type { DisciplineType } from "@/lib/progression-data"
import { DISCIPLINE_PRESETS } from "@/lib/progression-data"
import { cn } from "@/lib/utils"

export function DisciplineEmoji({
  type,
  className,
}: {
  type: DisciplineType
  className?: string
}) {
  if (type === "essential") {
    return (
      <span
        className={cn(
          "inline-flex flex-row items-center justify-center gap-0.5 leading-none whitespace-nowrap",
          className
        )}
        aria-hidden="true"
      >
        <span className="text-[0.85em]">🔥</span>
        <span className="text-[0.85em]">🔥</span>
      </span>
    )
  }

  return (
    <span className={cn("inline-flex items-center justify-center leading-none", className)}>
      {DISCIPLINE_PRESETS[type].emoji}
    </span>
  )
}
