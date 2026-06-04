"use client"

import { motion } from "framer-motion"
import { ProfileAvatar } from "./profile-avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { ConnectionItem } from "@/types/api"

export function ConnectionRequestCard({
  connection,
  onAccept,
  onIgnore,
  isLoading,
}: {
  connection: ConnectionItem
  onAccept: () => void
  onIgnore: () => void
  isLoading?: boolean
}) {
  const profile = connection.otherProfile

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card>
        <CardContent className="pt-4 flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <ProfileAvatar profile={profile} size="lg" />
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 truncate">{profile.nome}</p>
              <p className="text-sm text-slate-500 truncate">
                {profile.cargoAtual ?? "—"} · {profile.empresa ?? "—"}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isLoading}
              onClick={onAccept}
            >
              Aceitar
            </Button>
            <Button size="sm" variant="outline" disabled={isLoading} onClick={onIgnore}>
              Ignorar
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
