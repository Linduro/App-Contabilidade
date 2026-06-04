"use client"

import { Minus, Plus, Trash2 } from "lucide-react"
import {
  createActivity,
  getTestCount,
  removeTestActivity,
  syncTestCount,
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

function isLockedActivityName(category: ActivityCategory) {
  return category === "teste" || category === "exercicio" || category === "exame"
}

function WeightBadge({
  category,
  hint,
}: {
  category: ActivityCategory
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase text-muted-foreground max-md:text-xs">
        {CATEGORY_LABELS[category]} · {Math.round(CATEGORY_WEIGHTS[category] * 100)}% da média
      </span>
      {hint && <span className="text-[10px] text-muted-foreground/80 max-md:text-xs">{hint}</span>}
    </div>
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
  const testCount = getTestCount(activities)

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
            ? "Prova Final"
            : `Exame ${count}`

    onChange({
      ...discipline,
      activities: [...activities, createActivity(category, defaultName)],
    })
  }

  const removeTest = (id: string) => {
    if (testCount <= 1) return
    onChange({
      ...discipline,
      activities: removeTestActivity(activities, id),
    })
  }

  const setTestCount = (count: number) => {
    onChange({
      ...discipline,
      activities: syncTestCount(activities, count),
    })
  }

  return (
    <div className="mt-3 pt-3 border-t border-border/40 space-y-4">
      {CATEGORY_ORDER.map((category) => {
        const items = activities.filter((a) => a.category === category)
        if (items.length === 0) return null

        const isTestCategory = category === "teste"

        return (
          <div key={category} className="space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap max-md:flex-col max-md:items-stretch">
              <WeightBadge
                category={category}
                hint={
                  isTestCategory
                    ? `${testCount} teste${testCount !== 1 ? "s" : ""} → média vale ${Math.round(CATEGORY_WEIGHTS.teste * 100)}% (não importa a quantidade)`
                    : undefined
                }
              />
              <div className="flex items-center gap-2">
                {isTestCategory && (
                  <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-secondary/30 px-1 py-0.5">
                    <span className="text-[10px] font-semibold text-muted-foreground px-1.5 max-md:text-xs">
                      Qtd:
                    </span>
                    <button
                      type="button"
                      onClick={() => setTestCount(testCount - 1)}
                      disabled={testCount <= 1}
                      className="p-1 rounded hover:bg-secondary disabled:opacity-30 max-md:p-2 max-md:min-h-10 max-md:min-w-10 max-md:flex max-md:items-center max-md:justify-center"
                      aria-label="Menos um teste"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={testCount}
                      onChange={(e) => setTestCount(parseInt(e.target.value, 10) || 1)}
                      className="w-10 h-7 text-center text-xs font-bold bg-background border border-border rounded-md max-md:w-12 max-md:h-9"
                    />
                    <button
                      type="button"
                      onClick={() => setTestCount(testCount + 1)}
                      disabled={testCount >= 20}
                      className="p-1 rounded hover:bg-secondary disabled:opacity-30 max-md:p-2 max-md:min-h-10 max-md:min-w-10 max-md:flex max-md:items-center max-md:justify-center"
                      aria-label="Mais um teste"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {!isTestCategory && (
                  <button
                    type="button"
                    onClick={() => addActivity(category)}
                    className="text-[10px] font-semibold text-primary hover:underline flex items-center gap-1 max-md:text-xs max-md:min-h-10 max-md:px-2"
                  >
                    <Plus className="w-3 h-3" />
                    Adicionar
                  </button>
                )}
              </div>
            </div>
            <ul className="space-y-1.5">
              {items.map((activity) => (
                <li key={activity.id} className="flex items-center gap-2 max-md:flex-wrap">
                  {isLockedActivityName(category) ? (
                    <span className="flex-1 min-w-0 text-xs bg-secondary/20 border border-border/40 rounded-md px-2 py-1.5 text-foreground/90">
                      {activity.name}
                    </span>
                  ) : (
                    <input
                      value={activity.name}
                      onChange={(e) => updateActivity(activity.id, { name: e.target.value })}
                      className="flex-1 min-w-0 text-xs bg-secondary/30 border border-border/50 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  )}
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    placeholder="—"
                    value={activity.grade}
                    onChange={(e) => updateActivity(activity.id, { grade: e.target.value })}
                    className="w-14 h-8 px-1 bg-secondary/50 border border-border rounded-md text-center font-bold text-xs max-md:w-16 max-md:h-10"
                  />
                  {isTestCategory && testCount > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTest(activity.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive rounded-md max-md:min-h-10 max-md:min-w-10 max-md:flex max-md:items-center max-md:justify-center"
                      aria-label="Remover teste"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {!isTestCategory && items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeActivity(activity.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive rounded-md max-md:min-h-10 max-md:min-w-10 max-md:flex max-md:items-center max-md:justify-center"
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
                    (média de {breakdown.filledTestCount}/{breakdown.testCount} testes:{" "}
                    {formatGrade(breakdown.avgTeste)} × 20%) + ({formatGrade(breakdown.avgExercicio)}{" "}
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
            Preencha notas em cada categoria para calcular: ao menos 1 teste (média de todos vale 20%),
            exercício (30%) e prova (50%).
          </p>
        )}
      </div>
    </div>
  )
}
