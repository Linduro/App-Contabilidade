import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { ModuleFilterKey, RegionalFilterState } from "@/lib/regional-filters/regioes"

export const EMPTY_REGIONAL_FILTER: RegionalFilterState = {
  regioes: [],
  cidades: [],
}

export async function fetchRegionalFilters(
  userId: string,
  moduleKey: ModuleFilterKey,
): Promise<RegionalFilterState> {
  const snap = await getDoc(
    doc(db, "userSettings", userId, "filters", moduleKey),
  )
  if (!snap.exists()) return { ...EMPTY_REGIONAL_FILTER }
  const data = snap.data()
  return {
    regioes: Array.isArray(data.regioes) ? data.regioes : [],
    cidades: Array.isArray(data.cidades) ? data.cidades : [],
  }
}

export async function saveRegionalFilters(
  userId: string,
  moduleKey: ModuleFilterKey,
  filters: RegionalFilterState,
): Promise<void> {
  await setDoc(doc(db, "userSettings", userId, "filters", moduleKey), {
    regioes: filters.regioes,
    cidades: filters.cidades,
    updated_at: new Date().toISOString(),
  })
}

export function subscribeRegionalFilters(
  userId: string,
  moduleKey: ModuleFilterKey,
  onChange: (filters: RegionalFilterState) => void,
): () => void {
  return onSnapshot(
    doc(db, "userSettings", userId, "filters", moduleKey),
    (snap) => {
      if (!snap.exists()) {
        onChange({ ...EMPTY_REGIONAL_FILTER })
        return
      }
      const data = snap.data()
      onChange({
        regioes: Array.isArray(data.regioes) ? data.regioes : [],
        cidades: Array.isArray(data.cidades) ? data.cidades : [],
      })
    },
  )
}
