"use client"

import { useState, type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { httpBatchLink, httpLink, splitLink } from "@trpc/client"
import superjson from "superjson"
import { trpc } from "./trpc-client"

const trpcHttpOptions = {
  url: "/api/trpc",
  transformer: superjson,
  fetch(url: RequestInfo | URL, options?: RequestInit) {
    return fetch(url, { ...options, credentials: "include" })
  },
} as const

export function TRPCProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 2,
          },
          mutations: { retry: false },
        },
      }),
  )
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        splitLink({
          condition: (op) => op.type === "mutation",
          true: httpLink(trpcHttpOptions),
          false: httpBatchLink(trpcHttpOptions),
        }),
      ],
    }),
  )
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
