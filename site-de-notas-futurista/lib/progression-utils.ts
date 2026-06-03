import type { Discipline, Semester } from "@/lib/progression-data"
import { getDisciplineGrade } from "@/lib/grade-calculator"

export function getSemesterStats(semester: Semester) {
  const active = semester.disciplines.filter((d) => d.type !== "discarded")
  const completed = active.filter((d) => d.status === "concluido")
  const grades = completed
    .map((d) => getDisciplineGrade(d))
    .filter((n): n is number => n !== null)
  const average =
    grades.length > 0
      ? Math.round((grades.reduce((sum, g) => sum + g, 0) / grades.length) * 100) / 100
      : null

  return {
    total: active.length,
    completed: completed.length,
    percent: active.length ? Math.round((completed.length / active.length) * 100) : 0,
    average,
  }
}

export function disciplineMatchesSearch(discipline: Discipline, query: string) {
  if (!query.trim()) return true
  const q = query.toLowerCase()
  const activityMatch = (discipline.activities ?? []).some(
    (a) => a.name.toLowerCase().includes(q) || a.grade.includes(q)
  )
  return (
    discipline.name.toLowerCase().includes(q) ||
    discipline.emoji.includes(q) ||
    discipline.grade.includes(q) ||
    activityMatch
  )
}

export function semesterMatchesSearch(semester: Semester, query: string) {
  if (!query.trim()) return true
  const q = query.toLowerCase()
  if (semester.title.toLowerCase().includes(q)) return true
  return semester.disciplines.some((d) => disciplineMatchesSearch(d, query))
}
