"use client"

import { useState } from "react"
import { RequireAuth } from "@/components/require-auth"
import { AdminImpersonationProvider } from "@/components/admin-impersonation-provider"
import { ProgressionDashboard } from "@/components/dashboard/progression-dashboard"
import { WelcomeGreetingTransition } from "@/components/welcome-greeting-transition"

export default function DashboardPage() {
  const [revealed, setRevealed] = useState(false)

  return (
    <RequireAuth>
      <AdminImpersonationProvider>
        <WelcomeGreetingTransition onComplete={() => setRevealed(true)} />
        <div
          className={`transition-opacity duration-700 ease-out ${
            revealed ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <ProgressionDashboard tourEnabled={revealed} />
        </div>
      </AdminImpersonationProvider>
    </RequireAuth>
  )
}
