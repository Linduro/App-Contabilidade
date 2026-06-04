"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { hasExtendedScope } from "@/lib/admin-access"

export function useExtendedScope() {
  const { user } = useAuth()
  const [allowed, setAllowed] = useState(() => hasExtendedScope(user?.email))

  useEffect(() => {
    if (!user) {
      setAllowed(false)
      return
    }

    if (hasExtendedScope(user.email)) {
      setAllowed(true)
      return
    }

    let cancelled = false

    user.getIdTokenResult().then((token) => {
      if (cancelled) return
      const tokenEmail =
        typeof token.claims.email === "string" ? token.claims.email : user.email
      setAllowed(hasExtendedScope(tokenEmail))
    })

    return () => {
      cancelled = true
    }
  }, [user])

  return allowed
}
