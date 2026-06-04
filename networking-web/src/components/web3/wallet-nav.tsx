"use client"

import { useQuery } from "@tanstack/react-query"
import { ConnectKitButton } from "connectkit"
import { useAccount } from "wagmi"
import { ReputationStars } from "./reputation-stars"
import { api } from "@/lib/api"
import { useLinkWallet } from "@/hooks/use-link-wallet"

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function WalletNav() {
  const { address, isConnected } = useAccount()
  useLinkWallet()

  const { data } = useQuery({
    queryKey: ["reputation", address],
    queryFn: () => api.getReputation(address!),
    enabled: Boolean(address),
  })

  if (!isConnected || !address) {
    return (
      <ConnectKitButton.Custom>
        {({ isConnected: connected, show, ensName }) => (
          <button
            type="button"
            onClick={show}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded-lg px-3 py-1.5"
          >
            {connected ? (ensName ?? "Wallet") : "Conectar Wallet"}
          </button>
        )}
      </ConnectKitButton.Custom>
    )
  }

  const stars = data?.reputation.stars ?? 0

  return (
    <div className="flex items-center gap-2">
      <ConnectKitButton.Custom>
        {({ show, ensName }) => (
          <button
            type="button"
            onClick={show}
            className="text-xs font-mono text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg px-2 py-1"
          >
            {ensName ?? truncateAddress(address)}
          </button>
        )}
      </ConnectKitButton.Custom>
      {stars > 0 && <ReputationStars walletAddress={address} />}
    </div>
  )
}
