"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Network, LogOut } from "lucide-react"
import { useAuthStore } from "@/store/auth-store"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"

export function Header() {
  const router = useRouter()
  const { user, token, clearAuth } = useAuthStore()

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
