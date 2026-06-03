"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronUp, GripVertical, Plus, X } from "lucide-react"
import {
  createDiscipline,
  DISCIPLINE_PRESETS,
  type Discipline,
  type DisciplineType,
  type Semester,
} from "@/lib/progression-data"
import { getSemesterStats, semesterMatchesSearch } from "@/lib/progression-utils"
import { DisciplineRow } from "@/components/dashboard/discipline-row"

export function SemesterCard({
  semester,
  semesterIndex,
  totalSemesters,
  searchQuery,
  isDragging,
  isDragOver,
  onChange,
  onDelete,
  onMoveSemester,
  onSemesterDragStart,
  onSemesterDragOver,
  onSemesterDrop,
  onSemesterDragEnd,
}: {
  semester: Semester
  semesterIndex: number
  totalSemesters: number
  searchQuery: string
  isDragging: boolean
  isDragOver: boolean
  onChange: (updated: Semester) => void
  onDelete: () => void
  onMoveSemester: (from: number, to: number) => void
  onSemesterDragStart: (index: number) => void
  onSemesterDragOver: (index: number) => void
  onSemesterDrop: (index: number) => void
  onSemesterDragEnd: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const stats = getSemesterStats(semester)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("click", close)
    return () => document.removeEventListener("click", close)
  }, [menuOpen])

  if (!semesterMatchesSearch(semester, searchQuery)) return null

  const addDiscipline = (type: DisciplineType) => {
    onChange({
      ...semester,
      disciplines: [...semester.disciplines, createDiscipline(type)],
    })
    setMenuOpen(false)
  }

  const updateDiscipline = (index: number, updated: Discipline) => {
    const disciplines = [...semester.disciplines]
    disciplines[index] = updated
    onChange({ ...semester, disciplines })
  }

  const deleteDiscipline = (index: number) => {
    if (!window.confirm("Excluir esta disciplina?")) return
    onChange({
      ...semester,
      disciplines: semester.disciplines.filter((_, i) => i !== index),
    })
  }

  const moveDiscipline = (from: number, to: number) => {
    if (to < 0 || to >= semester.disciplines.length || from === to) return
    const disciplines = [...semester.disciplines]
    const [moved] = disciplines.splice(from, 1)
    disciplines.splice(to, 0, moved)
    onChange({ ...semester, disciplines })
  }

  const reorderDisciplines = (from: number, to: number) => {
    moveDiscipline(from, to)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDrop = (targetIndex: number) => {
    if (draggedIndex !== null) reorderDisciplines(draggedIndex, targetIndex)
    handleDragEnd()
  }

  const visibleDisciplines = semester.disciplines.filter((d) =>
    searchQuery.trim() ? semesterMatchesSearch({ ...semester, disciplines: [d] }, searchQuery) : true
  )

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault()
        onSemesterDragOver(semesterIndex)
      }}
      onDrop={(e) => {
        e.preventDefault()
        onSemesterDrop(semesterIndex)
      }}
      className={`glass-card rounded-2xl neon-border mb-6 relative transition-all ${
        menuOpen ? "z-30" : "z-0"
      } ${isDragging ? "opacity-50" : ""} ${isDragOver ? "ring-2 ring-primary" : ""}`}
    >
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border/50 border-t-4 border-t-primary">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className="flex flex-col gap-0.5 shrink-0 pt-1">
            <button
              type="button"
              disabled={semesterIndex === 0}
              onClick={() => onMoveSemester(semesterIndex, semesterIndex - 1)}
              className="p-1 rounded hover:bg-secondary disabled:opacity-30 sm:hidden"
              aria-label="Mover semestre para cima"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <div
              draggable
              onDragStart={() => onSemesterDragStart(semesterIndex)}
              onDragEnd={onSemesterDragEnd}
              className="hidden sm:block p-1 rounded-md hover:bg-secondary/60 cursor-grab active:cursor-grabbing"
              title="Arrastar semestre"
            >
              <GripVertical className="w-5 h-5 text-muted-foreground" />
            </div>
            <button
              type="button"
              disabled={semesterIndex === totalSemesters - 1}
              onClick={() => onMoveSemester(semesterIndex, semesterIndex + 1)}
              className="p-1 rounded hover:bg-secondary disabled:opacity-30 sm:hidden"
              aria-label="Mover semestre para baixo"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <input
              value={semester.title}
              onChange={(e) => onChange({ ...semester, title: e.target.value })}
              className="w-full bg-transparent border-none outline-none text-lg font-bold text-primary focus:ring-1 focus:ring-primary/40 rounded px-1"
            />
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {stats.completed} de {stats.total} concluídas
                </span>
                <span>{stats.percent}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${stats.percent}%` }}
                />
              </div>
              {stats.average !== null && (
                <p className="text-xs font-semibold text-accent">
                  Média do semestre: {stats.average.toFixed(1)}
                </p>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="p-2 text-muted-foreground hover:text-destructive rounded-md shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <ul className="divide-y divide-border/30">
        {semester.disciplines.map((d, i) => (
          <DisciplineRow
            key={d.id}
            index={i}
            total={semester.disciplines.length}
            discipline={d}
            isDragging={draggedIndex === i}
            isDragOver={dragOverIndex === i && draggedIndex !== i}
            searchQuery={searchQuery}
            onChange={(updated) => updateDiscipline(i, updated)}
            onDelete={() => deleteDiscipline(i)}
            onMove={moveDiscipline}
            onDragStart={setDraggedIndex}
            onDragOver={setDragOverIndex}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        ))}
      </ul>

      {visibleDisciplines.length === 0 && searchQuery.trim() && (
        <p className="px-5 py-4 text-sm text-muted-foreground">Nenhuma disciplina neste semestre.</p>
      )}

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-full py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/30 border-t border-dashed border-border/50 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Adicionar Disciplina
        </button>
        {menuOpen && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 glass-card rounded-xl neon-border py-1 min-w-[200px] z-50 shadow-lg">
            {(Object.keys(DISCIPLINE_PRESETS) as DisciplineType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addDiscipline(type)}
                className="w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-primary/10 hover:text-primary flex items-center gap-2"
              >
                <span>{DISCIPLINE_PRESETS[type].emoji}</span>
                {DISCIPLINE_PRESETS[type].label}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
