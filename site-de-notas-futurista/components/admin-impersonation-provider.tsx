"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"

const STORAGE_KEY = "advforte-admin-impersonation"

export interface ImpersonatedUser {
  userId: string
  email?: string
  name?: string
}

interface AdminImpersonationContextValue {
  impersonation: ImpersonatedUser | null
  hydrated: boolean
  startImpersonation: (user: ImpersonatedUser) => void
  stopImpersonation: () => void
}

const AdminImpersonationContext = createContext<AdminImpersonationContextValue>({
  impersonation: null,
  hydrated: false,
  startImpersonation: () => {},
  stopImpersonation: () => {},
})

function readStored(): ImpersonatedUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ImpersonatedUser
    return parsed?.userId ? parsed : null
  } catch {
    return null
  }
}

export function AdminImpersonationProvider({ children }: { children: React.ReactNode }) {
  const [impersonation, setImpersonation] = useState<ImpersonatedUser | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setImpersonation(readStored())
    setHydrated(true)
  }, [])

  const startImpersonation = useCallback((user: ImpersonatedUser) => {
    setImpersonation(user)
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  }, [])

  const stopImpersonation = useCallback(() => {
    setImpersonation(null)
    sessionStorage.removeItem(STORAGE_KEY)
  }, [])

  return (
    <AdminImpersonationContext.Provider
      value={{ impersonation, hydrated, startImpersonation, stopImpersonation }}
    >
      {children}
    </AdminImpersonationContext.Provider>
  )
}

export function useAdminImpersonation() {
  return useContext(AdminImpersonationContext)
}
