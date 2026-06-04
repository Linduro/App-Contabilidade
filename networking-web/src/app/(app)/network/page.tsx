"use client"

import { useQuery } from "@tanstack/react-query"
import { ErrorBoundary } from "@/components/error-boundary"
import { ExpertiseWeb } from "@/components/graph/expertise-web"
import { MatchCard } from "@/components/profile/match-card"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth-store"

export default function NetworkPage() {
  const token = useAuthStore((s) => s.token)!

  const { data, isLoading } = useQuery({
    queryKey: ["match-suggestions-full"],
    queryFn: () => api.getMatchSuggestions(token),
  })

  const matches = (data?.suggestions ?? []).slice(0, 10)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Hub de networking</h1>
        <p className="text-sm text-slate-500">
          Matches sugeridos e visualização da teia de expertises
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr] min-h-[500px]">
        <Card className="max-h-[calc(100vh-8rem)] overflow-y-auto">
          <CardHeader>
            <CardTitle className="text-base">Top 10 matches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            {isLoading && (
              <p className="text-sm text-slate-500">Carregando sugestões...</p>
            )}
            {!isLoading && matches.length === 0 && (
              <p className="text-sm text-slate-500">
                Nenhum match ainda. Complete o perfil e aguarde o embedding.
              </p>
            )}
            {matches.map((m) => (
              <MatchCard
                key={m.profile.id}
                match={m}
                onConnect={() => alert("Conexão em breve no backend.")}
              />
            ))}
          </CardContent>
        </Card>

        <div className="min-h-[400px] lg:min-h-[calc(100vh-8rem)]">
          <ErrorBoundary fallbackTitle="Erro na teia de expertises">
            <ExpertiseWeb />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
