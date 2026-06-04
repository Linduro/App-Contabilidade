"use client"

import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { ExpertiseTag } from "@/components/profile/expertise-tag"
import { Badge } from "@/components/ui/badge"
import { ConnectButton } from "@/components/connections/connect-button"
import { ReputationStars } from "@/components/web3/reputation-stars"
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

  const credentialsQuery = useQuery({
    queryKey: ["credentials", profile?.walletAddress],
    queryFn: () => api.getCredentials(profile!.walletAddress!),
    enabled: Boolean(profile?.walletAddress),
  })

  const validCredentials =
    credentialsQuery.data?.credentials.filter((c) => c.isValid) ?? []

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
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-2xl">{profile.nome}</CardTitle>
                {profile.walletAddress && (
                  <ReputationStars walletAddress={profile.walletAddress} size="md" />
                )}
              </div>
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

          {profile.walletAddress && (
            <section>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                Credenciais verificadas
              </h3>
              {credentialsQuery.isLoading && (
                <p className="text-sm text-slate-500">Buscando credenciais on-chain...</p>
              )}
              {!credentialsQuery.isLoading && validCredentials.length === 0 && (
                <p className="text-sm text-slate-500">Nenhuma credencial NFT válida vinculada.</p>
              )}
              <div className="space-y-3">
                {validCredentials.map((cred) => (
                  <Card key={cred.tokenId} className="border-indigo-100 bg-indigo-50/30">
                    <CardContent className="pt-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">{cred.title}</p>
                          <p className="text-sm text-slate-600">
                            {cred.institution} · {cred.credentialType}
                          </p>
                        </div>
                        <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">
                          Verificado on-chain
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
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
