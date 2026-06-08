"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  enqueueManualOutreach,
  fetchTrabalhistaDashboard,
  filterLeads,
  saveTrabalhistaSettings,
  seedTrabalhistaConfig,
  updateLeadStatus,
} from "@/lib/trabalhista-leads/client"
import { DEFAULT_TRABALHISTA_SETTINGS } from "@/lib/trabalhista-leads/seed-data"
import type {
  Lead,
  LeadFilters,
  LeadStatus,
  OutreachLogEntry,
  TrabalhistaSettings,
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
  const [logs, setLogs] = useState<OutreachLogEntry[]>([])
  const [settings, setSettings] = useState<TrabalhistaSettings>({
    ...DEFAULT_TRABALHISTA_SETTINGS,
  })
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
  const [savingConfig, setSavingConfig] = useState(false)
  const [dispatchingId, setDispatchingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filteredLeads = useMemo(
    () => filterLeads(leads, filters),
    [leads, filters],
  )

  const loadData = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      await seedTrabalhistaConfig()
      const data = await fetchTrabalhistaDashboard()
      setLeads(data.leads)
      setLogs(data.logs)
      setStats(data.stats)
      setSettings(data.settings)
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

  const dispatchManual = useCallback(
    async (leadId: string) => {
      setDispatchingId(leadId)
      setMessage(null)
      setError(null)
      try {
        await enqueueManualOutreach(leadId)
        setMessage(
          "Disparo enfileirado — o worker na nuvem processará em até 15 min.",
        )
        await loadData()
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao enfileirar disparo.",
        )
      } finally {
        setDispatchingId(null)
      }
    },
    [loadData],
  )

  const saveConfig = useCallback(async (next: TrabalhistaSettings) => {
    setSavingConfig(true)
    setMessage(null)
    setError(null)
    try {
      await saveTrabalhistaSettings(next)
      setSettings(next)
      setMessage("Configuração salva. O worker na nuvem usará na próxima execução.")
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao salvar configuração.",
      )
    } finally {
      setSavingConfig(false)
    }
  }, [])

  return {
    leads,
    filteredLeads,
    logs,
    settings,
    stats,
    filters,
    setFilters,
    loading,
    savingConfig,
    dispatchingId,
    message,
    error,
    changeStatus,
    dispatchManual,
    saveConfig,
    reload: loadData,
  }
}
