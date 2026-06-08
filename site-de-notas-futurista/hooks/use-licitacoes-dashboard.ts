"use client"

import { useCallback, useEffect, useState } from "react"
import {
  fetchLicitacoesDashboard,
  seedLicitacoesFirestore,
  updateLicitacaoMatchStatus,
} from "@/lib/licitacoes/client"
import {
  runCollectInBrowser,
  type CollectStats,
} from "@/lib/licitacoes/collect-client"
import type {
  AdvogadoEspecialidade,
  DashboardStats,
  Match,
  MatchFilters,
  MatchStatus,
} from "@/lib/licitacoes/types"

const DEFAULT_FILTERS: MatchFilters = {
  especialidadeId: "all",
  valorMin: "",
  valorMax: "",
  cidade: "",
}

export function useLicitacoesDashboard(enabled: boolean) {
  const [advogadoNome, setAdvogadoNome] = useState("")
  const [advogadoEmail, setAdvogadoEmail] = useState("")
  const [matches, setMatches] = useState<Match[]>([])
  const [especialidades, setEspecialidades] = useState<AdvogadoEspecialidade[]>(
    [],
  )
  const [stats, setStats] = useState<DashboardStats>({
    abertasMes: 0,
    inscricoesMes: 0,
  })
  const [filters, setFilters] = useState<MatchFilters>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [collectMessage, setCollectMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!enabled) return

    setLoading(true)
    setError(null)

    try {
      let data = await fetchLicitacoesDashboard()

      if (!data.advogado) {
        await seedLicitacoesFirestore()
        data = await fetchLicitacoesDashboard()
      }

      if (!data.advogado) {
        throw new Error(
          "Não foi possível criar o perfil de licitações. Verifique se está logado como cartoonhq@gmail.com.",
        )
      }

      setAdvogadoNome(data.advogado.nome)
      setAdvogadoEmail(data.advogado.email)
      setMatches(data.matches)
      setEspecialidades(data.especialidades)
      setStats(data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar licitações.")
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    loadData()
  }, [loadData])

  const collectNow = async (): Promise<CollectStats> => {
    setCollecting(true)
    setCollectMessage(null)
    setError(null)

    try {
      const stats = await runCollectInBrowser()
      setCollectMessage(stats.mensagem ?? "Coleta concluída.")
      await loadData()
      return stats
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao caçar licitações."
      setError(message)
      throw err
    } finally {
      setCollecting(false)
    }
  }

  const updateMatchStatus = async (matchId: string, status: MatchStatus) => {
    await updateLicitacaoMatchStatus(matchId, status)
    const now = new Date().toISOString()

    if (status === "arquivado") {
      setMatches((prev) => prev.filter((m) => m.id !== matchId))
    } else {
      setMatches((prev) =>
        prev.map((m) =>
          m.id === matchId
            ? {
                ...m,
                status,
                visto_em: status === "visto" ? now : m.visto_em,
                inscrito_em: status === "inscrito" ? now : m.inscrito_em,
              }
            : m,
        ),
      )

      if (status === "inscrito") {
        setStats((prev) => ({
          ...prev,
          inscricoesMes: prev.inscricoesMes + 1,
        }))
      }
    }
  }

  return {
    advogadoNome,
    advogadoEmail,
    matches,
    especialidades,
    stats,
    filters,
    setFilters,
    loading,
    collecting,
    collectMessage,
    error,
    reload: loadData,
    collectNow,
    updateMatchStatus,
  }
}
