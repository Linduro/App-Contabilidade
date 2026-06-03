"use client"

import { Plus, Trash2 } from "lucide-react"
import {
  createActivity,
  type Activity,
  type ActivityCategory,
  type Discipline,
} from "@/lib/progression-data"
import {
  CATEGORY_LABELS,
  CATEGORY_WEIGHTS,
  formatGrade,
  getGradeBreakdown,
} from "@/lib/grade-calculator"

const CATEGORY_ORDER: ActivityCategory[] = ["teste", "exercicio", "exame"]

function WeightBadge({ category }: { category: ActivityCategory }) {
  return (
    <span className="text-[10px] font-bold uppercase text-muted-foreground">
      {CATEGORY_LABELS[category]} · {Math.round(CATEGORY_WEIGHTS[category] * 100)}%
    </span>
  )
}

export function DisciplineActivities({
  discipline,
  onChange,
}: {
  discipline: Discipline
  onChange: (updated: Discipline) => void
}) {
  const activities = discipline.activities ?? []
  const breakdown = getGradeBreakdown(discipline)

  const updateActivity = (id: string, patch: Partial<Activity>) => {
    onChange({
      ...discipline,
      activities: activities.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })
  }

  const removeActivity = (id: string) => {
    onChange({
      ...discipline,
      activities: activities.filter((a) => a.id !== id),
    })
  }

  const addActivity = (category: ActivityCategory) => {
    const count = activities.filter((a) => a.category === category).length + 1
    const defaultName =
      category === "teste"
        ? `Teste ${String(count).padStart(2, "0")}`
        : category === "exercicio"
          ? count === 1
            ? "Avaliação Intermediária"
            : `Exercício ${count}`
          : count === 1
            ? "Prova"
            : `Exame ${count}`

    onChange({
      ...discipline,
      activities: [...activities, createActivity(category, defaultName)],
    })
  }

  return (
    <div className="mt-3 pt-3 border-t border-border/40 space-y-4">
      {CATEGORY_ORDER.map((category) => {
        const items = activities.filter((a) => a.category === category)
        if (items.length === 0) return null

        return (
          <div key={category} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <WeightBadge category={category} />
              <button
                type="button"
                onClick={() => addActivity(category)}
                className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Adicionar
              </button>
            </div>
            <ul className="space-y-1.5">
              {items.map((activity) => (
                <li key={activity.id} className="flex items-center gap-2">
                  <input
                    value={activity.name}
                    onChange={(e) => updateActivity(activity.id, { name: e.target.value })}
                    className="flex-1 min-w-0 text-xs bg-secondary/30 border border-border/50 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary/30"
                  />
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    placeholder="—"
                    value={activity.grade}
                    onChange={(e) => updateActivity(activity.id, { grade: e.target.value })}
                    className="w-14 h-8 px-1 bg-secondary/50 border border-border rounded-md text-center font-bold text-xs"
                  />
                  {(category !== "teste" || items.length > 1) && (
                    <button
                      type="button"
                      onClick={() => removeActivity(activity.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive rounded-md"
                      aria-label="Remover atividade"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      <div className="rounded-lg bg-secondary/30 border border-border/50 px-3 py-2.5 space-y-2 text-xs">
        {breakdown.media !== null ? (
          <>
            <p className="text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Média: </span>
              {formatGrade(breakdown.media)}
              {breakdown.avgTeste !== null &&
                breakdown.avgExercicio !== null &&
                breakdown.exame !== null && (
                  <span className="block mt-1 text-[11px]">
                    ({formatGrade(breakdown.avgTeste)} × 20%) + ({formatGrade(breakdown.avgExercicio)}{" "}
                    × 30%) + ({formatGrade(breakdown.exame)} × 50%)
                  </span>
                )}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="font-semibold text-foreground shrink-0">Recuperação:</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                placeholder="Opcional"
                value={discipline.recoveryGrade ?? ""}
                onChange={(e) => onChange({ ...discipline, recoveryGrade: e.target.value })}
                className="w-16 h-7 px-1 bg-background border border-border rounded-md text-center font-bold"
              />
              {breakdown.hasRecovery && breakdown.final !== null && (
                <span className="text-muted-foreground">
                  → Média final:{" "}
                  <strong className="text-accent">{formatGrade(breakdown.final)}</strong> (50% rec. + 50%
                  média)
                </span>
              )}
            </div>
            {!breakdown.hasRecovery && breakdown.final !== null && (
              <p className="text-muted-foreground">
                Média final: <strong className="text-accent">{formatGrade(breakdown.final)}</strong>
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">
            Preencha ao menos uma nota em cada categoria (Testes, Exercício e Prova) para calcular a
            média.
          </p>
        )}
      </div>
    </div>
  )
}
