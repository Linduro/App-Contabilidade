"use client"

import { useEffect, useRef } from "react"
import { useAccount } from "wagmi"
import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth-store"

/** Vincula wallet conectada ao perfil autenticado (uma vez por sessão/endereço). */
export function useLinkWallet() {
  const { address, isConnected } = useAccount()
  const token = useAuthStore((s) => s.token)
  const linkedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isConnected || !address || !token) return
    if (linkedRef.current === address.toLowerCase()) return

    linkedRef.current = address.toLowerCase()
    void api.linkWallet(token, address).catch(() => {
      linkedRef.current = null
    })
  }, [address, isConnected, token])
}
