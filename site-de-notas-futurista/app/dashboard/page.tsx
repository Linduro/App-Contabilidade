"use client"

import { RequireAuth } from "@/components/require-auth"
import { ProgressionDashboard } from "@/components/dashboard/progression-dashboard"

export default function DashboardPage() {
  return (
    <RequireAuth>
      <ProgressionDashboard />
    </RequireAuth>
  )
}
