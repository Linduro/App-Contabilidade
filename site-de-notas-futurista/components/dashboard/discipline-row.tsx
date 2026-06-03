"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, GripVertical, Pencil, Trash2 } from "lucide-react"
import { DisciplineActivities } from "@/components/dashboard/discipline-activities"
import type { Discipline, DisciplineStatus } from "@/lib/progression-data"
import { defaultActivities } from "@/lib/progression-data"
import { getDisciplineGradeDisplay } from "@/lib/grade-calculator"
import { disciplineMatchesSearch } from "@/lib/progression-utils"

export function DisciplineRow({
  discipline,
  index,
  total,
  isDragging,
  isDragOver,
  searchQuery,
  onChange,
  onDelete,
  onMove,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  discipline: Discipline
  index: number
  total: number
  isDragging: boolean
  isDragOver: boolean
  searchQuery: string
  onChange: (updated: Discipline) => void
  onDelete: () => void
  onMove: (from: number, to: number) => void
  onDragStart: (index: number) => void
  onDragOver: (index: number) => void
  onDrop: (index: number) => void
  onDragEnd: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isDiscarded = discipline.type === "discarded"
  const isCursando = discipline.status === "cursando"
  const isConcluido = discipline.status === "concluido"
  const isDetailed = discipline.gradeMode === "detailed"
  const visible = disciplineMatchesSearch(discipline, searchQuery)
  const computedGrade = getDisciplineGradeDisplay(discipline)

  if (!visible) return null

  const setStatus = (status: DisciplineStatus) => {
    if (discipline.status === status) {
      onChange({ ...discipline, status: "none" })
      return
    }
    onChange({ ...discipline, status })
  }

  const enableDetailedMode = () => {
    onChange({
      ...discipline,
      gradeMode: "detailed",
      activities: discipline.activities?.length ? discipline.activities : defaultActivities(),
      recoveryGrade: discipline.recoveryGrade ?? "",
    })
    setExpanded(true)
  }

  const disableDetailedMode = () => {
    if (!window.confirm("Voltar para nota única? As atividades serão ocultadas (não apagadas).")) return
    onChange({ ...discipline, gradeMode: "simple" })
    setExpanded(false)
  }

  return (
    <li
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        onDragOver(index)
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop(index)
      }}
      className={`px-5 py-3 border-b border-border/50 last:border-b-0 transition-all ${
        isCursando ? "bg-accent/5" : isConcluido ? "bg-primary/5" : ""
      } ${isDragging ? "opacity-40 scale-[0.98]" : ""} ${
        isDragOver ? "border-t-2 border-t-primary bg-primary/5" : ""
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="flex flex-col sm:hidden gap-0.5 shrink-0">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => onMove(index, index - 1)}
              className="p-1 rounded hover:bg-secondary disabled:opacity-30"
              aria-label="Mover para cima"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={index === total - 1}
              onClick={() => onMove(index, index + 1)}
              className="p-1 rounded hover:bg-secondary disabled:opacity-30"
              aria-label="Mover para baixo"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <div
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move"
              onDragStart(index)
            }}
            onDragEnd={onDragEnd}
            className="hidden sm:block shrink-0 p-1 rounded-md hover:bg-secondary/60 cursor-grab active:cursor-grabbing"
            title="Arrastar para reordenar"
          >
            <GripVertical className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
          </div>
          {isDetailed && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="shrink-0 p-1 rounded-md hover:bg-secondary/60 text-muted-foreground"
              aria-label={expanded ? "Ocultar atividades" : "Ver atividades"}
              title="Testes, exercícios e prova"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
          <input
            value={discipline.emoji}
            onChange={(e) => onChange({ ...discipline, emoji: e.target.value })}
            className="w-12 text-center bg-secondary/40 border border-dashed border-border rounded-lg outline-none text-lg shrink-0 focus:border-primary/50"
            aria-label="Prioridade"
          />
          <div className="relative flex-1 min-w-0 group">
            <input
              value={discipline.name}
              onChange={(e) => onChange({ ...discipline, name: e.target.value })}
              placeholder="Clique para editar o nome"
              className={`w-full min-w-0 bg-secondary/40 border border-dashed border-border font-medium text-sm outline-none rounded-lg px-3 py-2 pr-9 transition-all hover:border-primary/40 focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20 ${
                isDiscarded ? "line-through text-muted-foreground" : ""
              }`}
            />
            <Pencil className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/60 pointer-events-none opacity-70 group-focus-within:opacity-100" />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 pl-10 sm:pl-0 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => setStatus("cursando")}
            className={`text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-md border transition-all ${
              isCursando
                ? "bg-accent/20 border-accent text-accent"
                : "bg-secondary/50 border-border text-muted-foreground hover:border-accent/50"
            }`}
          >
            Cursando
          </button>
          <button
            type="button"
            onClick={() => setStatus("concluido")}
            className={`text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-md border transition-all ${
              isConcluido
                ? "bg-primary/20 border-primary text-primary"
                : "bg-secondary/50 border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            Concluído
          </button>

          {isDetailed ? (
            <div
              className="w-16 h-8 px-1 bg-primary/10 border border-primary/30 rounded-md flex items-center justify-center font-bold text-sm text-primary"
              title="Calculada automaticamente"
            >
              {computedGrade || "—"}
            </div>
          ) : (
            <input
              type="number"
              step="0.1"
              placeholder="0.0"
              value={discipline.grade}
              onChange={(e) => onChange({ ...discipline, grade: e.target.value })}
              className="w-14 h-8 px-1 bg-secondary/50 border border-border rounded-md text-center font-bold text-sm"
            />
          )}

          <button
            type="button"
            onClick={onDelete}
            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="pl-10 sm:pl-[4.5rem] mt-1">
        {!isDetailed ? (
          <button
            type="button"
            onClick={enableDetailedMode}
            className="text-[11px] font-semibold text-primary/80 hover:text-primary hover:underline"
          >
            + Detalhar notas (Testes 20% · Exercício 30% · Prova 50% — qtd. de testes ajustável)
          </button>
        ) : (
          <button
            type="button"
            onClick={disableDetailedMode}
            className="text-[10px] text-muted-foreground hover:text-foreground hover:underline"
          >
            Usar nota única
          </button>
        )}
      </div>

      {isDetailed && expanded && (
        <div className="pl-10 sm:pl-[4.5rem]">
          <DisciplineActivities discipline={discipline} onChange={onChange} />
        </div>
      )}
    </li>
  )
}
