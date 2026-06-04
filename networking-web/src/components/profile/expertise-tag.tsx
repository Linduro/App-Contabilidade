import { cn, expertiseCategoryColor } from "@/lib/utils"

export function ExpertiseTag({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
        expertiseCategoryColor(label),
        className
      )}
    >
      {label}
    </span>
  )
}
