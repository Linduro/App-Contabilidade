"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  fetchExecucoesAltoValor,
  filterAltoValor,
  updateAltoValorStatus,
} from "@/lib/execucoes-alto-valor/client"
import { runAltoValorCollectInBrowser } from "@/lib/execucoes-alto-valor/collect-client"
import { DATAJUD_SEARCH_DAYS } from "@/lib/datajud/normalize"
import {
  DEFAULT_ALTO_VALOR_FILTERS,
  type ExecucaoAltoValor,
  type ExecucaoAltoValorStatus,
} from "@/lib/execucoes-alto-valor/types"
import type { AltoValorFilters } from "@/lib/execucoes-alto-valor/types"
import { useRegionalFilters } from "@/hooks/use-regional-filters"
import { matchesRegionalFilter } from "@/lib/regional-filters/regioes"

export function useExecucoesAltoValorDashboard(enabled: boolean) {
  const [items, setItems] = useState<ExecucaoAltoValor[]>([])
  const [filters, setFilters] = useState<AltoValorFilters>(DEFAULT_ALTO_VALOR_FILTERS)
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [collectMessage, setCollectMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const {
    filters: regionalFilters,
    updateFilters: setRegionalFilters,
    userId,
  } = useRegionalFilters("execucoesAltoValor")

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      setItems(await fetchExecucoesAltoValor())
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
    const table = filterAltoValor(items, filters)
    return table.filter((item) =>
      matchesRegionalFilter([item.comarca, item.vara], regionalFilters),
    )
  }, [items, filters, regionalFilters])

  const collectNow = useCallback(async () => {
    setCollecting(true)
    setCollectMessage(null)
    setError(null)
    try {
      const result = await runAltoValorCollectInBrowser(userId, {
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

  const changeStatus = useCallback(async (id: string, status: ExecucaoAltoValorStatus) => {
    await updateAltoValorStatus(id, status)
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
