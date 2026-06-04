"use client"

import { useQuery } from "@tanstack/react-query"
import { Star } from "lucide-react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

export function ReputationStars({
  walletAddress,
  className,
  size = "sm",
}: {
  walletAddress: string
  className?: string
  size?: "sm" | "md"
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["reputation", walletAddress],
    queryFn: () => api.getReputation(walletAddress),
    staleTime: 60_000,
  })

  const stars = data?.reputation.stars ?? 0
  const total = data?.reputation.total ?? 0
  const iconSize = size === "md" ? "w-4 h-4" : "w-3 h-3"

  if (isLoading) {
    return <span className={cn("text-[10px] text-slate-400", className)}>...</span>
  }

  if (!data?.reputation.configured || total === 0) {
    return null
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5",
        className
      )}
      title={`Reputação on-chain: ${stars}/5 (${total} avaliações)`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            iconSize,
            i < stars ? "fill-amber-400 text-amber-500" : "text-slate-300"
          )}
        />
      ))}
    </span>
  )
}
