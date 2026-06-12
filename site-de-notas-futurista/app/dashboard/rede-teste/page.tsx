"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { RequireAuth } from "@/components/require-auth"
import { Button } from "@/components/ui/button"

const REDE_TESTE_URL = (
  process.env.NEXT_PUBLIC_REDE_TESTE_URL || "http://localhost:3003"
).replace(/\/$/, "")

export default function RedeTestePage() {
  const [status, setStatus] = useState("Verificando sessão…")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatus("Redirecionando para login…")
        return
      }
      try {
        setStatus("Abrindo Rede Teste…")
        const token = await user.getIdToken(true)
        const target = `${REDE_TESTE_URL}/auth/portal?token=${encodeURIComponent(token)}&return=${encodeURIComponent("/rede-teste/")}`
        window.location.replace(target)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao obter sessão")
      }
    })
    return () => unsub()
  }, [])

  return (
    <RequireAuth>
      <main className="min-h-screen grid-pattern p-6 flex items-center justify-center">
        <div className="max-w-lg w-full glass-card rounded-2xl p-8 neon-border text-center">
          <h1 className="text-2xl font-bold gradient-text mb-2">Rede Teste</h1>
          {error ? (
            <p className="text-destructive text-sm mb-4">{error}</p>
          ) : (
            <p className="text-muted-foreground text-sm mb-4 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {status}
            </p>
          )}
          <Link href="/dashboard/">
            <Button variant="ghost" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao dashboard
            </Button>
          </Link>
        </div>
      </main>
    </RequireAuth>
  )
}
