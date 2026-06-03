"use client"

import { useEffect, useState } from "react"
import { RequireAuth } from "@/components/require-auth"
import { ProgressionDashboard } from "@/components/dashboard/progression-dashboard"
import { WelcomeVideoTransition } from "@/components/welcome-video-transition"
import { WELCOME_VIDEO_SESSION_KEY } from "@/lib/welcome-video"

export default function DashboardPage() {
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(WELCOME_VIDEO_SESSION_KEY) !== "1") {
      setRevealed(true)
    }
  }, [])

  return (
    <RequireAuth>
      <WelcomeVideoTransition onComplete={() => setRevealed(true)} />
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
