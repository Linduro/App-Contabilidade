"use client"

import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { ExpertiseTag } from "@/components/profile/expertise-tag"
import { Badge } from "@/components/ui/badge"
import { ConnectButton } from "@/components/connections/connect-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"

export default function PublicProfilePage() {
  const params = useParams()
  const id = params.id as string

  const { data, isLoading, isError } = useQuery({
    queryKey: ["profile", id],
    queryFn: () => api.getProfile(id),
  })

  const profile = data?.profile

  if (isLoading) {
    return <p className="text-slate-500">Carregando perfil...</p>
  }

  if (isError || !profile) {
    return <p className="text-red-600">Perfil não encontrado.</p>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-2xl">{profile.nome}</CardTitle>
              <p className="text-slate-500 text-sm mt-1">
                {profile.cargoAtual ?? "—"} · {profile.empresa ?? "—"}
              </p>
              {profile.turma && (
                <p className="text-xs text-slate-400 mt-1">Turma {profile.turma}</p>
              )}
            </div>
            {profile.disponivelMentoria && (
              <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200">
                Disponível para mentoria
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {profile.bio && (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Bio</h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{profile.bio}</p>
            </section>
          )}

          {profile.areaAtuacao.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Áreas</h3>
              <div className="flex flex-wrap gap-1">
                {profile.areaAtuacao.map((a) => (
                  <ExpertiseTag key={a} label={a} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Expertises</h3>
            <div className="flex flex-wrap gap-1">
              {profile.expertises.map((t) => (
                <ExpertiseTag key={t} label={t} />
              ))}
            </div>
          </section>

          {profile.oQueOfeco && (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Oferece</h3>
              <p className="text-sm text-slate-600">{profile.oQueOfeco}</p>
            </section>
          )}

          {profile.oQueBusco && (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-1">Busca</h3>
              <p className="text-sm text-slate-600">{profile.oQueBusco}</p>
            </section>
          )}

          <ConnectButton
            targetProfileId={profile.id}
            className="w-full sm:w-auto"
          />
        </CardContent>
      </Card>
    </motion.div>
  )
}
