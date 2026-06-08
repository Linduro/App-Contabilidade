"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  fetchExecucoesRurais,
  filterExecucoes,
  updateExecucaoStatus,
} from "@/lib/execucoes-rurais/client"
import type { ExecucaoFilters, ExecucaoRural, ExecucaoStatus } from "@/lib/execucoes-rurais/types"
import { useRegionalFilters } from "@/hooks/use-regional-filters"
import { matchesRegionalFilter } from "@/lib/regional-filters/regioes"

const DEFAULT: ExecucaoFilters = {
  comarca: "",
  valorMin: "",
  valorMax: "",
  status: "all",
}

export function useExecucoesRuraisDashboard(enabled: boolean) {
  const [items, setItems] = useState<ExecucaoRural[]>([])
  const [filters, setFilters] = useState<ExecucaoFilters>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { filters: regionalFilters, updateFilters: setRegionalFilters } =
    useRegionalFilters("execucoesRurais")

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
    error,
    reload: load,
    changeStatus,
  }
}
