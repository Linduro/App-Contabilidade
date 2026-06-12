"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

function PortalAuthInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get("token")
    const returnTo = searchParams.get("return") || "/rede-teste/"

    if (!token) {
      const portal =
        process.env.NEXT_PUBLIC_PORTAL_URL ||
        "https://linduro.github.io/App-Contabilidade"
      window.location.replace(`${portal}/dashboard/rede-teste/`)
      return
    }

    fetch("/api/auth/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ idToken: token }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}))
          throw new Error(data.error || "Falha na autenticação")
        }
        router.replace(returnTo)
      })
      .catch((e: Error) => setError(e.message))
  }, [router, searchParams])

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-red-400">{error}</p>
        <a className="text-sm underline" href="/auth/portal">
          Tentar novamente pelo portal
        </a>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3">
      <Loader2 className="size-8 animate-spin" />
      <p className="text-sm opacity-80">Entrando na Rede Teste…</p>
    </main>
  )
}

export default function PortalAuthPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex flex-col items-center justify-center gap-3">
          <Loader2 className="size-8 animate-spin" />
          <p className="text-sm opacity-80">Entrando na Rede Teste…</p>
        </main>
      }
    >
      <PortalAuthInner />
    </Suspense>
  )
}
