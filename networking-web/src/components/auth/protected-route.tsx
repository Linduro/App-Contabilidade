"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { useAuthStore } from "@/store/auth-store"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!token) {
      router.replace("/login")
    }
  }, [token, router])

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Redirecionando...
      </div>
    )
  }

  return <>{children}</>
}
