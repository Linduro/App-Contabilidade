"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import type { MatchSuggestion } from "@/types/api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExpertiseTag } from "./expertise-tag"

export function MatchCard({
  match,
  onConnect,
}: {
  match: MatchSuggestion
  onConnect?: () => void
}) {
  const scorePercent = Math.round(match.score * 100)

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900">{match.profile.nome}</p>
              <p className="text-xs text-slate-500">
                {match.profile.cargoAtual ?? "—"} · {match.profile.empresa ?? "—"}
              </p>
            </div>
            <span className="text-sm font-bold text-indigo-600">{scorePercent}%</span>
          </div>

          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${scorePercent}%` }}
            />
          </div>

          <p className="text-xs text-slate-500">
            {match.breakdown.tagsShared} expertise(s) em comum · complementaridade{" "}
            {Math.round(match.breakdown.complementarity * 100)}%
          </p>

          <div className="flex flex-wrap gap-1">
            {match.profile.expertises.slice(0, 4).map((tag) => (
              <ExpertiseTag key={tag} label={tag} />
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={onConnect}>
              Conectar
            </Button>
            <Link href={`/profile/${match.profile.id}`}>
              <Button size="sm" variant="outline">
                Ver perfil
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
