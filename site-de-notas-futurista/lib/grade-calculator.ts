import type { Activity, ActivityCategory, Discipline } from "@/lib/progression-data"

export const CATEGORY_WEIGHTS: Record<ActivityCategory, number> = {
  teste: 0.2,
  exercicio: 0.3,
  exame: 0.5,
}

export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  teste: "Testes",
  exercicio: "Exercícios",
  exame: "Exames",
}

export function parseGrade(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = parseFloat(trimmed.replace(",", "."))
  return Number.isNaN(n) ? null : n
}

export function formatGrade(value: number | null, decimals = 3): string {
  if (value === null) return ""
  return value.toFixed(decimals).replace(".", ",")
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export function getCategoryGrades(activities: Activity[], category: ActivityCategory): number[] {
  return activities
    .filter((a) => a.category === category)
    .map((a) => parseGrade(a.grade))
    .filter((n): n is number => n !== null)
}

export function computeMedia(activities: Activity[]): number | null {
  const avgTeste = average(getCategoryGrades(activities, "teste"))
  const avgExercicio = average(getCategoryGrades(activities, "exercicio"))
  const exameGrades = getCategoryGrades(activities, "exame")
  const exame = exameGrades.length === 1 ? exameGrades[0] : average(exameGrades)

  if (avgTeste === null || avgExercicio === null || exame === null) return null

  const media =
    avgTeste * CATEGORY_WEIGHTS.teste +
    avgExercicio * CATEGORY_WEIGHTS.exercicio +
    exame * CATEGORY_WEIGHTS.exame

  return Math.round(media * 100000) / 100000
}

export function computeFinalGrade(media: number | null, recoveryGrade: string): number | null {
  const recovery = parseGrade(recoveryGrade)
  if (media === null) return recovery
  if (recovery === null) return media
  const final = recovery * 0.5 + media * 0.5
  return Math.round(final * 100000) / 100000
}

export interface GradeBreakdown {
  avgTeste: number | null
  avgExercicio: number | null
  exame: number | null
  media: number | null
  final: number | null
  hasRecovery: boolean
  testCount: number
  filledTestCount: number
}

export function getGradeBreakdown(discipline: Discipline): GradeBreakdown {
  const activities = discipline.activities ?? []
  const testGrades = getCategoryGrades(activities, "teste")
  const avgTeste = average(testGrades)
  const avgExercicio = average(getCategoryGrades(activities, "exercicio"))
  const exameGrades = getCategoryGrades(activities, "exame")
  const exame = exameGrades.length === 1 ? exameGrades[0] : average(exameGrades)
  const media = computeMedia(activities)
  const recovery = parseGrade(discipline.recoveryGrade ?? "")
  const final = computeFinalGrade(media, discipline.recoveryGrade ?? "")

  return {
    avgTeste,
    avgExercicio,
    exame,
    media,
    final,
    hasRecovery: recovery !== null,
    testCount: activities.filter((a) => a.category === "teste").length,
    filledTestCount: testGrades.length,
  }
}

export function getDisciplineGrade(discipline: Discipline): number | null {
  if (discipline.gradeMode === "detailed" && discipline.activities?.length) {
    const { final, media } = getGradeBreakdown(discipline)
    return final ?? media
  }
  return parseGrade(discipline.grade)
}

export function getDisciplineGradeDisplay(discipline: Discipline): string {
  const value = getDisciplineGrade(discipline)
  return value === null ? "" : formatGrade(value, 2)
}
