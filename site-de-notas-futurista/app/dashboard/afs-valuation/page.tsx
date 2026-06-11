"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { RequireAuth } from "@/components/require-auth"
import { RequireOwner } from "@/components/require-owner"
import { Button } from "@/components/ui/button"
import { getAfsApiBase, getAfsAppPath, isAfsApiConfigured } from "@/lib/afs-config"

function AfsValuationContent() {
  const apiBase = getAfsApiBase()
  const iframeSrc = `${getAfsAppPath()}?apiBase=${encodeURIComponent(apiBase)}`
  const apiReady = isAfsApiConfigured()

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
        {!apiReady && (
          <div className="px-4 py-2 text-xs text-center bg-amber-500/10 text-amber-800 dark:text-amber-200 border-t border-amber-500/20">
            API não configurada no deploy. Defina a variável <code>AFS_API_URL</code> no GitHub
            (Settings → Secrets and variables → Actions) com a URL pública do backend Flask.
          </div>
        )}
      </header>

      <iframe
        src={iframeSrc}
        title="Asset Solutions Valuation"
        className="flex-1 w-full border-0 bg-[#0f1419]"
        allow="clipboard-read; clipboard-write"
      />
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
