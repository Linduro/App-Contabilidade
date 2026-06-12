"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  fetchExecucoesRurais,
  filterExecucoes,
  updateExecucaoStatus,
} from "@/lib/execucoes-rurais/client"
import { runExecucoesCollectInBrowser } from "@/lib/execucoes-rurais/collect-client"
import { DATAJUD_SEARCH_DAYS } from "@/lib/datajud/normalize"
import type { ExecucaoFilters, ExecucaoRural, ExecucaoStatus } from "@/lib/execucoes-rurais/types"
import { DEFAULT_EXECUCAO_FILTERS } from "@/lib/execucoes-rurais/types"
import { useRegionalFilters } from "@/hooks/use-regional-filters"
import { matchesRegionalFilter } from "@/lib/regional-filters/regioes"

export function useExecucoesRuraisDashboard(enabled: boolean) {
  const [items, setItems] = useState<ExecucaoRural[]>([])
  const [filters, setFilters] = useState<ExecucaoFilters>(DEFAULT_EXECUCAO_FILTERS)
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [collectMessage, setCollectMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const {
    filters: regionalFilters,
    updateFilters: setRegionalFilters,
    userId,
  } = useRegionalFilters("execucoesRurais")

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      setItems(await fetchExecucoesRurais())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar execuções.")
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const table = filterExecucoes(items, filters)
    return table.filter((item) =>
      matchesRegionalFilter(
        [item.comarca, item.municipio_imovel, item.vara],
        regionalFilters,
      ),
    )
  }, [items, filters, regionalFilters])

  const collectNow = useCallback(async () => {
    setCollecting(true)
    setCollectMessage(null)
    setError(null)
    try {
      const result = await runExecucoesCollectInBrowser(userId, {
        dataDe: filters.dataDe || undefined,
        dataAte: filters.dataAte || undefined,
        daysBack: filters.dataDe ? undefined : DATAJUD_SEARCH_DAYS,
      })
      setCollectMessage(result.mensagem ?? "Busca concluída.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro na busca Datajud.")
      throw e
    } finally {
      setCollecting(false)
    }
  }, [userId, filters.dataDe, filters.dataAte, load])

  const changeStatus = useCallback(async (id: string, status: ExecucaoStatus) => {
    await updateExecucaoStatus(id, status)
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)))
  }, [])

  return {
    items: filtered,
    filters,
    setFilters,
    regionalFilters,
    setRegionalFilters,
    loading,
    collecting,
    collectMessage,
    error,
    reload: load,
    collectNow,
    changeStatus,
  }
}
