"use client"

import { ProtectedRoute } from "@/components/auth/protected-route"
import { Header } from "@/components/layout/header"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </div>
    </ProtectedRoute>
  )
}
