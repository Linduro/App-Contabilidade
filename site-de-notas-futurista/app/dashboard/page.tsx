"use client"

import { useEffect, useState } from "react"
import { RequireAuth } from "@/components/require-auth"
import { ProgressionDashboard } from "@/components/dashboard/progression-dashboard"
import { WelcomeGreetingTransition } from "@/components/welcome-greeting-transition"

export default function DashboardPage() {
  const [revealed, setRevealed] = useState(false)

  return (
    <RequireAuth>
      <WelcomeGreetingTransition onComplete={() => setRevealed(true)} />
      <div
        className={`transition-opacity duration-700 ease-out ${
          revealed ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <ProgressionDashboard tourEnabled={revealed} />
      </div>
    </RequireAuth>
  )
}
