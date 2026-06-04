"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ProfileAvatar } from "./profile-avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { Profile } from "@/types/api"

export function ConnectionProfileCard({
  profile,
  statusBadge,
}: {
  profile: Profile
  statusBadge?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={`/profile/${profile.id}`}>
        <Card className="hover:border-indigo-200 hover:shadow-md transition-shadow">
          <CardContent className="pt-4 flex items-center gap-3">
            <ProfileAvatar profile={profile} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 truncate">{profile.nome}</p>
              <p className="text-sm text-slate-500 truncate">
                {profile.cargoAtual ?? "—"} · {profile.empresa ?? "—"}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {profile.disponivelMentoria && (
                  <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200">
                    Mentor disponível
                  </Badge>
                )}
                {statusBadge && (
                  <Badge className="bg-slate-50 text-slate-600 border-slate-200">
                    {statusBadge}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}
