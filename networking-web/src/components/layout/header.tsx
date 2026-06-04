"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Bell, Network, LogOut } from "lucide-react"
import { useAuthStore } from "@/store/auth-store"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import dynamic from "next/dynamic"

const WalletNav = dynamic(
  () => import("@/components/web3/wallet-nav").then((m) => m.WalletNav),
  { ssr: false }
)

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, token, clearAuth } = useAuthStore()
  const onConnectionsPage = pathname === "/connections"

  const pendingQuery = useQuery({
    queryKey: ["pending-connections"],
    queryFn: () => api.getPendingConnections(token!),
    enabled: Boolean(token) && !onConnectionsPage,
    refetchInterval: onConnectionsPage ? false : 30_000,
  })

  const pendingCount = onConnectionsPage ? 0 : (pendingQuery.data?.count ?? 0)

  const handleLogout = async () => {
    if (token) {
      try {
        await api.logout(token)
      } catch {
        // ignore
      }
    }
    clearAuth()
    router.push("/login")
  }

  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/network" className="flex items-center gap-2 font-semibold text-indigo-700">
          <Network className="w-5 h-5" />
          FIPECAFI Network
        </Link>

        <nav className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-slate-600 hover:text-indigo-600">
            Dashboard
          </Link>
          <Link href="/network" className="text-sm text-slate-600 hover:text-indigo-600">
            Teia
          </Link>
          <Link
            href="/connections"
            className="relative text-slate-600 hover:text-indigo-600"
            aria-label={`${pendingCount} solicitações pendentes`}
          >
            <Bell className="w-5 h-5" />
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                {pendingCount > 9 ? "9+" : pendingCount}
              </span>
            )}
          </Link>
          <WalletNav />
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
              {user?.nome?.charAt(0) ?? "?"}
            </div>
            <span className="text-sm font-medium hidden sm:inline">{user?.nome}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} aria-label="Sair">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </nav>
      </div>
    </header>
  )
}
