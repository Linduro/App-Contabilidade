"use client"

import Link from "next/link"
import { Lock } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { hasExtendedScope } from "@/lib/admin-access"

export function RestrictedAreaButton({ className }: { className?: string }) {
  const { user } = useAuth()

  if (!hasExtendedScope(user?.email)) return null

  return (
    <Button
      variant="outline"
      size="sm"
      asChild
      className={className ?? "shrink-0 max-md:w-full max-md:min-h-11 border-primary/40 text-primary hover:bg-primary/10"}
      title="Aplicações pessoais — Gabriel e Vinícius"
    >
      <Link href="/dashboard/area-restrita/">
        <Lock className="w-4 h-4 mr-2" />
        Área restrita
      </Link>
    </Button>
  )
}
