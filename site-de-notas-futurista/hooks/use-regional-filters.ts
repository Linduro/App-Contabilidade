"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import {
  saveRegionalFilters,
  subscribeRegionalFilters,
  EMPTY_REGIONAL_FILTER,
} from "@/lib/regional-filters/client"
import type { ModuleFilterKey, RegionalFilterState } from "@/lib/regional-filters/regioes"

export function useRegionalFilters(moduleKey: ModuleFilterKey) {
  const { user } = useAuth()
  const [filters, setFilters] = useState<RegionalFilterState>(EMPTY_REGIONAL_FILTER)
  const [ready, setReady] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user?.uid) return
    setReady(false)
    const unsub = subscribeRegionalFilters(user.uid, moduleKey, (next) => {
      setFilters(next)
      setReady(true)
    })
    return unsub
  }, [user?.uid, moduleKey])

  const updateFilters = useCallback(
    (next: RegionalFilterState) => {
      setFilters(next)
      if (!user?.uid) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        saveRegionalFilters(user.uid, moduleKey, next).catch(() => undefined)
      }, 400)
    },
    [user?.uid, moduleKey],
  )

  return { filters, updateFilters, ready, userId: user?.uid ?? null }
}
