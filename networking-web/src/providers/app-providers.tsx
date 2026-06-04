"use client"

import { Toaster } from "sonner"
import { QueryProvider } from "./query-provider"
import { Web3Provider } from "./web3-provider"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <Web3Provider>
        {children}
        <Toaster richColors position="top-center" closeButton />
      </Web3Provider>
    </QueryProvider>
  )
}
