"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"
import { RequireAuth } from "@/components/require-auth"
import { RequireOwner } from "@/components/require-owner"
import { Button } from "@/components/ui/button"
import { assetPath } from "@/lib/base-path"

function AfsValuationContent() {
  useEffect(() => {
    window.location.replace(assetPath("/afs-valuation/index.html"))
  }, [])

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="shrink-0 border-b border-border/50 bg-background/95 backdrop-blur z-10">
        <div className="max-w-[1600px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao painel
            </Link>
          </Button>
          <div className="text-sm font-semibold text-foreground truncate">
            Asset Solutions Valuation
          </div>
          <div className="w-[120px]" aria-hidden />
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-[#f97316]" />
        <p className="text-sm">Abrindo Asset Solutions Valuation…</p>
        <a
          href={assetPath("/afs-valuation/index.html")}
          className="text-sm text-[#ea580c] hover:underline"
        >
          Clique aqui se não redirecionar automaticamente
        </a>
      </div>
    </div>
  )
}

export default function AfsValuationPage() {
  return (
    <RequireAuth>
      <RequireOwner>
        <AfsValuationContent />
      </RequireOwner>
    </RequireAuth>
  )
}
