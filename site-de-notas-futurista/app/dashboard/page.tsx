"use client"

import { RequireAuth } from "@/components/require-auth"
import { ProgressionDashboard } from "@/components/dashboard/progression-dashboard"
import { WelcomeVideoModal } from "@/components/welcome-video-modal"

export default function DashboardPage() {
  return (
    <RequireAuth>
      <WelcomeVideoModal />
      <ProgressionDashboard />
    </RequireAuth>
  )
}
