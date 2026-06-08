"use client"

import { Download, ExternalLink, PlayCircle } from "lucide-react"
import {
  MATEMATICA_FINANCEIRA_AULAS,
  MATEMATICA_FINANCEIRA_TURMA,
} from "@/lib/matematica-financeira-aulas"

export function MatematicaFinanceiraPanel() {
  return (
    <div className="w-full glass-card neon-border rounded-lg p-2 sm:p-3 space-y-2">
      <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground px-1">
        Matemática Financeira · {MATEMATICA_FINANCEIRA_TURMA}
      </p>

      <div className="max-h-[min(22rem,50vh)] overflow-y-auto rounded-md border border-border/60 divide-y divide-border/50">
        {MATEMATICA_FINANCEIRA_AULAS.map((aula) => (
          <div
            key={aula.numero}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-2.5 py-2 bg-background/40 hover:bg-background/70 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-foreground">
                {aula.titulo}
                {aula.gravada && (
                  <span className="ml-1.5 text-[10px] font-medium text-muted-foreground">(gravada)</span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {aula.zoomUrl && (
                <a
                  href={aula.zoomUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 min-h-8 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/35 text-[10px] sm:text-xs font-semibold text-primary hover:bg-primary/20 hover:border-primary/60 transition-colors"
                >
                  <PlayCircle className="w-3 h-3 shrink-0" />
                  Assistir
                  <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
                </a>
              )}

              <a
                href={aula.pdfPath}
                download={`matematica-financeira-aula-${String(aula.numero).padStart(2, "0")}.pdf`}
                className="inline-flex items-center gap-1 min-h-8 px-2.5 py-1 rounded-md bg-accent/10 border border-accent/35 text-[10px] sm:text-xs font-semibold text-accent-foreground hover:bg-accent/20 hover:border-accent/60 transition-colors"
              >
                <Download className="w-3 h-3 shrink-0" />
                PDF
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
