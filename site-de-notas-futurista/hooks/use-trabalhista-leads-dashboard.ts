"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  fetchTrabalhistaDashboard,
  filterLeads,
  updateLeadStatus,
} from "@/lib/trabalhista-leads/client"
import { useRegionalFilters } from "@/hooks/use-regional-filters"
import { matchesRegionalFilter } from "@/lib/regional-filters/regioes"
import type {
  Lead,
  LeadFilters,
  LeadStatus,
  TrabalhistaStats,
} from "@/lib/trabalhista-leads/types"

const DEFAULT_FILTERS: LeadFilters = {
  comarca: "",
  valorMin: "",
  valorMax: "",
  status: "all",
}

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
  const [filters, setFilters] = useState<LeadFilters>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const {
    filters: regionalFilters,
    updateFilters: setRegionalFilters,
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
    error,
    changeStatus,
    reload: loadData,
    regionalFilters,
    setRegionalFilters,
  }
}
