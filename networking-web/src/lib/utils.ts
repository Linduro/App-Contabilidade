import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Profile } from "@/types/api"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calcProfileCompleteness(profile: Profile | null): number {
  if (!profile) return 0

  const checks = [
    Boolean(profile.nome?.trim()),
    Boolean(profile.cargoAtual?.trim()),
    Boolean(profile.empresa?.trim()),
    profile.areaAtuacao.length > 0,
    profile.expertises.length > 0,
    Boolean(profile.oQueOfeco?.trim()),
    Boolean(profile.oQueBusco?.trim()),
    Boolean(profile.bio?.trim()),
  ]

  const filled = checks.filter(Boolean).length
  return Math.round((filled / checks.length) * 100)
}

export function expertiseCategoryColor(label: string): string {
  const hash = label.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const colors = [
    "bg-blue-100 text-blue-800 border-blue-200",
    "bg-emerald-100 text-emerald-800 border-emerald-200",
    "bg-amber-100 text-amber-800 border-amber-200",
    "bg-violet-100 text-violet-800 border-violet-200",
    "bg-rose-100 text-rose-800 border-rose-200",
  ]
  return colors[hash % colors.length] ?? colors[0]
}
