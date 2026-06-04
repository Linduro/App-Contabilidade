"use client"

import { WagmiProvider } from "wagmi"
import { ConnectKitProvider } from "connectkit"
import { wagmiConfig } from "@/lib/wagmi-config"

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <ConnectKitProvider
        theme="auto"
        options={{
          language: "pt-BR",
        }}
      >
        {children}
      </ConnectKitProvider>
    </WagmiProvider>
  )
}
