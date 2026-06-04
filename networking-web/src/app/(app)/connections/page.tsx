"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { ConnectionRequestCard } from "@/components/connections/connection-request-card"
import { ConnectionProfileCard } from "@/components/connections/connection-profile-card"
import { ErrorBoundary } from "@/components/error-boundary"
import { api, ApiError } from "@/lib/api"
import { useAuthStore } from "@/store/auth-store"
import type { ConnectionItem } from "@/types/api"

function Section({
  title,
  description,
  children,
  empty,
}: {
  title: string
  description?: string
  children: React.ReactNode
  empty?: string
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
      {empty ? (
        <p className="text-sm text-slate-500 py-4 rounded-lg border border-dashed border-slate-200 text-center">
          {empty}
        </p>
      ) : (
        children
      )}
    </section>
  )
}

export default function ConnectionsPage() {
  const token = useAuthStore((s) => s.token)!
  const queryClient = useQueryClient()
  const [received, setReceived] = useState<ConnectionItem[]>([])
  const [actingId, setActingId] = useState<string | null>(null)

  const pendingQuery = useQuery({
    queryKey: ["pending-connections"],
    queryFn: () => api.getPendingConnections(token),
  })

  const acceptedQuery = useQuery({
    queryKey: ["connections", "aceita"],
    queryFn: () => api.getConnections(token, "aceita"),
  })

  const allPendingQuery = useQuery({
    queryKey: ["connections", "pendente"],
    queryFn: () => api.getConnections(token, "pendente"),
  })

  useEffect(() => {
    if (pendingQuery.data?.connections) {
      setReceived(pendingQuery.data.connections)
    }
  }, [pendingQuery.data])

  const respondMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string
      status: "aceita" | "ignorada"
    }) => {
      setActingId(id)
      return api.updateConnection(token, id, status)
    },
    onSuccess: (_data, variables) => {
      setReceived((prev) => prev.filter((c) => c.id !== variables.id))
      if (variables.status === "aceita") {
        toast.success("Conexão aceita!")
      } else {
        toast.success("Solicitação ignorada.")
      }
      void queryClient.invalidateQueries({ queryKey: ["connections"] })
      void queryClient.invalidateQueries({ queryKey: ["pending-connections"] })
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível atualizar.")
    },
    onSettled: () => setActingId(null),
  })

  const accepted = acceptedQuery.data?.connections ?? []
  const sentPending =
    allPendingQuery.data?.connections.filter((c) => c.direction === "sent") ?? []

  const isLoading =
    pendingQuery.isLoading || acceptedQuery.isLoading || allPendingQuery.isLoading

  return (
    <div className="max-w-2xl mx-auto space-y-10 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Conexões</h1>
        <p className="text-sm text-slate-500 mt-1">
          Gerencie solicitações recebidas, enviadas e sua rede
        </p>
      </div>

      {isLoading && (
        <p className="text-sm text-slate-500">Carregando conexões...</p>
      )}

      <ErrorBoundary fallbackTitle="Erro ao carregar solicitações">
        <Section
          title="Solicitações recebidas"
          description="Aceite ou ignore quem quer se conectar com você"
          empty={!isLoading && received.length === 0 ? "Nenhuma solicitação pendente." : undefined}
        >
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {received.map((connection) => (
                <ConnectionRequestCard
                  key={connection.id}
                  connection={connection}
                  isLoading={actingId === connection.id}
                  onAccept={() =>
                    respondMutation.mutate({ id: connection.id, status: "aceita" })
                  }
                  onIgnore={() =>
                    respondMutation.mutate({ id: connection.id, status: "ignorada" })
                  }
                />
              ))}
            </AnimatePresence>
          </div>
        </Section>
      </ErrorBoundary>

      <Section
        title="Minhas conexões"
        description="Profissionais com quem você já está conectado"
        empty={
          !isLoading && accepted.length === 0
            ? "Você ainda não tem conexões aceitas."
            : undefined
        }
      >
        <div className="space-y-3">
          {accepted.map((c) => (
            <ConnectionProfileCard key={c.id} profile={c.otherProfile} />
          ))}
        </div>
      </Section>

      <Section
        title="Solicitações enviadas"
        description="Aguardando resposta do outro profissional"
        empty={
          !isLoading && sentPending.length === 0
            ? "Nenhuma solicitação enviada aguardando resposta."
            : undefined
        }
      >
        <div className="space-y-3">
          {sentPending.map((c) => (
            <ConnectionProfileCard
              key={c.id}
              profile={c.otherProfile}
              statusBadge="Aguardando resposta"
            />
          ))}
        </div>
      </Section>
    </div>
  )
}
