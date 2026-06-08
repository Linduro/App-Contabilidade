"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { hasExtendedScope } from "@/lib/admin-access"
import { assetPath } from "@/lib/base-path"

export function RequireOwner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace(assetPath("/sign-in/"))
      return
    }
    if (!hasExtendedScope(user.email)) {
      router.replace(assetPath("/dashboard/"))
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center grid-pattern">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user || !hasExtendedScope(user.email)) return null

  return <>{children}</>
}
