"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  fetchTrabalhistaDashboard,
  filterLeads,
  updateLeadStatus,
} from "@/lib/trabalhista-leads/client"
import { runTrabalhistaCollectInBrowser } from "@/lib/trabalhista-leads/collect-client"
import { DATAJUD_SEARCH_DAYS } from "@/lib/datajud/normalize"
import { useRegionalFilters } from "@/hooks/use-regional-filters"
import { matchesRegionalFilter } from "@/lib/regional-filters/regioes"
import {
  DEFAULT_LEAD_FILTERS,
  type Lead,
  type LeadFilters,
  type LeadStatus,
  type TrabalhistaStats,
} from "@/lib/trabalhista-leads/types"

export function useTrabalhistaLeadsDashboard(enabled: boolean) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<TrabalhistaStats>({
    total: 0,
    novos: 0,
    contatados: 0,
    respondeu: 0,
    clientes: 0,
    scoreMedio: 0,
  })
  const [filters, setFilters] = useState<LeadFilters>(DEFAULT_LEAD_FILTERS)
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [collectMessage, setCollectMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const {
    filters: regionalFilters,
    updateFilters: setRegionalFilters,
    userId,
  } = useRegionalFilters("trabalhista")

  const filteredLeads = useMemo(() => {
    const byTable = filterLeads(leads, filters)
    return byTable.filter((lead) =>
      matchesRegionalFilter(
        [lead.comarca, lead.municipio, lead.vara],
        regionalFilters,
      ),
    )
  }, [leads, filters, regionalFilters])

  const loadData = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTrabalhistaDashboard()
      setLeads(data.leads)
      setStats(data.stats)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar leads.",
      )
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    loadData()
  }, [loadData])

  const collectNow = useCallback(async () => {
    setCollecting(true)
    setCollectMessage(null)
    setError(null)
    try {
      const result = await runTrabalhistaCollectInBrowser(userId, {
        dataDe: filters.dataDe || undefined,
        dataAte: filters.dataAte || undefined,
        daysBack: filters.dataDe ? undefined : DATAJUD_SEARCH_DAYS,
      })
      setCollectMessage(result.mensagem ?? "Busca concluída.")
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na busca Datajud.")
      throw err
    } finally {
      setCollecting(false)
    }
  }, [userId, filters.dataDe, filters.dataAte, loadData])

  const changeStatus = useCallback(
    async (leadId: string, status: LeadStatus) => {
      await updateLeadStatus(leadId, status)
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status } : l)),
      )
    },
    [],
  )

  return {
    leads,
    filteredLeads,
    stats,
    filters,
    setFilters,
    loading,
    collecting,
    collectMessage,
    error,
    changeStatus,
    collectNow,
    reload: loadData,
    regionalFilters,
    setRegionalFilters,
  }
}
