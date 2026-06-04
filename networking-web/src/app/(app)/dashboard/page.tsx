"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { ErrorBoundary } from "@/components/error-boundary"
import { MatchCard } from "@/components/profile/match-card"
import { ProfileCompleteness } from "@/components/profile/profile-completeness"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"
import { calcProfileCompleteness } from "@/lib/utils"
import { useAuthStore } from "@/store/auth-store"

export default function DashboardPage() {
  const token = useAuthStore((s) => s.token)!
  const user = useAuthStore((s) => s.user)

  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => api.getMyProfile(token),
  })

  const matchesQuery = useQuery({
    queryKey: ["match-suggestions"],
    queryFn: () => api.getMatchSuggestions(token),
    enabled: Boolean(profileQuery.data),
  })

  const profile = profileQuery.data?.profile ?? null
  const completeness = calcProfileCompleteness(profile)
  const topMatches = (matchesQuery.data?.suggestions ?? []).slice(0, 3)

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-bold text-slate-900">
          Olá, {user?.nome?.split(" ")[0] ?? "profissional"}
        </h1>
        <p className="text-slate-500 text-sm mt-1">Visão geral do seu networking</p>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Seu perfil</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {profileQuery.isLoading ? (
              <p className="text-sm text-slate-500">Carregando...</p>
            ) : (
              <>
                <div className="relative">
                  <ProfileCompleteness percent={completeness} />
                </div>
                <p className="text-sm text-slate-600 text-center">
                  {profile?.cargoAtual ?? "Complete seu cargo"} ·{" "}
                  {profile?.empresa ?? "empresa"}
                </p>
                <Link href="/profile/setup">
                  <Button variant="outline" className="w-full">
                    Editar perfil
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-1 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Top matches (IA)</CardTitle>
            <Link href="/network">
              <Button size="sm" variant="ghost">
                Ver teia
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {matchesQuery.isLoading && (
              <p className="text-sm text-slate-500">Buscando sugestões...</p>
            )}
            {matchesQuery.isError && (
              <p className="text-sm text-amber-600">
                Complete o perfil e aguarde o embedding para ver matches.
              </p>
            )}
            {!matchesQuery.isLoading && topMatches.length === 0 && (
              <p className="text-sm text-slate-500">Nenhuma sugestão ainda.</p>
            )}
            <ErrorBoundary fallbackTitle="Erro ao exibir matches">
              {topMatches.map((m) => (
                <MatchCard key={m.profile.id} match={m} />
              ))}
            </ErrorBoundary>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
