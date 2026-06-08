import { BadgeCheck, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { OnChainCredential } from "@/lib/api"

function formatDate(ts: number) {
  if (!ts) return "—"
  return new Date(ts * 1000).toLocaleDateString("pt-BR")
}

export function CredentialCard({ credential }: { credential: OnChainCredential }) {
  const scanUrl = credential.tokenId
    ? `https://amoy.polygonscan.com/token/${credential.tokenId}`
    : undefined

  return (
    <Card className="border-indigo-100 bg-indigo-50/40">
      <CardContent className="pt-4 flex gap-3">
        <div className="shrink-0 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
          <BadgeCheck className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-semibold text-slate-900">{credential.title}</p>
          <p className="text-sm text-slate-600">
            {credential.institution} · {credential.credentialType}
          </p>
          <p className="text-xs text-slate-500">Emitido em {formatDate(credential.issueDate)}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">
              Verificado on-chain
            </Badge>
            {scanUrl && (
              <a
                href={scanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
              >
                Polygonscan
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
