import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

export type DisciplineStatus = "none" | "cursando" | "concluido"
export type DisciplineType = "essential" | "important" | "neutral" | "discarded"
export type GradeMode = "simple" | "detailed"
export type ActivityCategory = "teste" | "exercicio" | "exame"

export interface Activity {
  id: string
  name: string
  category: ActivityCategory
  grade: string
}

export interface Discipline {
  id: string
  emoji: string
  name: string
  type: DisciplineType
  status: DisciplineStatus
  grade: string
  gradeMode?: GradeMode
  activities?: Activity[]
  recoveryGrade?: string
}

export interface Semester {
  id: string
  title: string
  disciplines: Discipline[]
  collapsed?: boolean
}

export interface Reminder {
  id: string
  title: string
  date: string
  done: boolean
  notifyEmail?: boolean
  notifySms?: boolean
  notifiedOn?: string | null
}

export interface ProgressionData {
  semesters: Semester[]
  notes: string
  logoData: string | null
  reminders: Reminder[]
}

export const DISCIPLINE_PRESETS: Record<DisciplineType, { emoji: string; label: string }> = {
  essential: { emoji: "🔥🔥", label: "Essencial" },
  important: { emoji: "🔥", label: "Importante" },
  neutral: { emoji: "⚪", label: "Neutra" },
  discarded: { emoji: "🚫", label: "Dispensada" },
}

export const DISCIPLINE_TYPE_ORDER: DisciplineType[] = [
  "essential",
  "important",
  "neutral",
  "discarded",
]

function resolveDisciplineType(type: unknown): DisciplineType {
  if (type === "essential" || type === "important" || type === "neutral" || type === "discarded") {
    return type
  }
  return "important"
}

export function createId() {
  return crypto.randomUUID()
}

export function createActivity(category: ActivityCategory, name: string): Activity {
  return { id: createId(), name, category, grade: "" }
}

export function defaultActivities(testCount = 6): Activity[] {
  const tests = Array.from({ length: Math.max(1, testCount) }, (_, i) =>
    createActivity("teste", `Teste ${String(i + 1).padStart(2, "0")}`)
  )
  return [
    ...tests,
    createActivity("exercicio", "Avaliação Intermediária"),
    createActivity("exame", "Prova Final"),
  ]
}

/** Ajusta a quantidade de testes preservando notas já lançadas (índice a índice). */
export function syncTestCount(activities: Activity[], count: number): Activity[] {
  const clamped = Math.max(1, Math.min(20, count))
  const nonTests = activities.filter((a) => a.category !== "teste")
  const existingTests = activities.filter((a) => a.category === "teste")

  const tests = Array.from({ length: clamped }, (_, i) => {
    const existing = existingTests[i]
    return (
      existing ?? createActivity("teste", `Teste ${String(i + 1).padStart(2, "0")}`)
    )
  })

  return [...tests, ...nonTests]
}

export function getTestCount(activities: Activity[]): number {
  return activities.filter((a) => a.category === "teste").length
}

export function normalizeDiscipline(discipline: Partial<Discipline>): Discipline {
  const gradeMode = discipline.gradeMode ?? "simple"
  const type = resolveDisciplineType(discipline.type)
  return {
    id: discipline.id ?? createId(),
    emoji: DISCIPLINE_PRESETS[type].emoji,
    name: discipline.name ?? "Disciplina",
    type,
    status: discipline.status ?? "none",
    grade: discipline.grade ?? "",
    gradeMode,
    activities:
      gradeMode === "detailed"
        ? discipline.activities?.length
          ? discipline.activities
          : defaultActivities()
        : discipline.activities,
    recoveryGrade: discipline.recoveryGrade ?? "",
  }
}

export function createDiscipline(type: DisciplineType, name?: string): Discipline {
  const preset = DISCIPLINE_PRESETS[type]
  return normalizeDiscipline({
    id: createId(),
    emoji: preset.emoji,
    name: name ?? `${preset.label}...`,
    type,
    status: "none",
    grade: "",
    gradeMode: "detailed",
    activities: defaultActivities(),
    recoveryGrade: "",
  })
}

export function createSemester(title = "Novo Semestre", disciplines: Discipline[] = []): Semester {
  return { id: createId(), title, disciplines, collapsed: true }
}

function normalizeReminder(reminder: Reminder): Reminder {
  return {
    ...reminder,
    notifyEmail: reminder.notifyEmail !== false,
    notifySms: reminder.notifySms === true,
    notifiedOn: reminder.notifiedOn ?? null,
  }
}

export function createReminder(): Reminder {
  return {
    id: createId(),
    title: "",
    date: new Date().toISOString().slice(0, 10),
    done: false,
    notifyEmail: true,
    notifySms: false,
    notifiedOn: null,
  }
}

export function defaultProgression(): ProgressionData {
  return fipecafiDefaultTemplate()
}

function buildSemester(
  title: string,
  items: { name: string; type: DisciplineType }[]
): Semester {
  return createSemester(
    title,
    items.map((item) => createDiscipline(item.type, item.name))
  )
}

/** Grade padrão editável — estrutura inicial para novos alunos. */
export function fipecafiDefaultTemplate(): ProgressionData {
  return {
    semesters: [
      buildSemester("1º Semestre", [
        { name: "Matemática Aplicada", type: "important" },
        { name: "Comunicação e Informação Organizacional", type: "important" },
        { name: "Contabilidade Geral", type: "essential" },
        { name: "Economia: princípios e conceitos", type: "important" },
        { name: "Teoria Geral da Administração", type: "important" },
      ]),
      buildSemester("2º Semestre", [
        { name: "Contabilidade Intermediária", type: "essential" },
        { name: "Matemática Financeira", type: "important" },
        { name: "Sistemas de Informação Gerencial", type: "important" },
        { name: "Legislação Social", type: "important" },
        { name: "Estatística Aplicada a Negócios", type: "important" },
      ]),
      buildSemester("3º Semestre", [
        { name: "Antropologia e Sociologia das Organizações", type: "important" },
        { name: "Contabilidade Avançada", type: "essential" },
        { name: "Mercado Financeiro e Investimentos", type: "important" },
        { name: "Métodos Quantitativos", type: "important" },
        { name: "Optativa I", type: "neutral" },
      ]),
      buildSemester("4º Semestre", [
        { name: "Linguagens de Programação", type: "important" },
        { name: "Direito Empresarial", type: "important" },
        { name: "Contabilidade Societária", type: "essential" },
        { name: "Análise das Demonstrações Contábeis", type: "essential" },
        { name: "Optativa II", type: "neutral" },
      ]),
      buildSemester("5º Semestre", [
        { name: "Legislação e Contabilidade Tributária", type: "essential" },
        { name: "Contabilidade e Análise de Custos", type: "essential" },
        { name: "Laboratório de Contabilidade e Gestão", type: "important" },
        { name: "Ética, Cidadania e Responsabilidade Social", type: "important" },
        { name: "Optativa III", type: "neutral" },
      ]),
      buildSemester("6º Semestre", [
        { name: "Contabilidade Gerencial", type: "essential" },
        { name: "Business Intelligence, Big Data e Analytics", type: "important" },
        { name: "Finanças Corporativas", type: "essential" },
        { name: "Atuária", type: "important" },
        { name: "Optativa IV", type: "neutral" },
      ]),
      buildSemester("7º Semestre", [
        { name: "Auditoria e Perícia Contábil", type: "essential" },
        { name: "Contabilidade Governamental", type: "important" },
        { name: "Planejamento Tributário", type: "important" },
        { name: "Teoria da Contabilidade", type: "essential" },
        { name: "Optativa V", type: "neutral" },
      ]),
      buildSemester("8º Semestre", [
        { name: "Controladoria", type: "essential" },
        { name: "Valuation", type: "important" },
        { name: "Tópicos Emergentes em Contabilidade", type: "important" },
        { name: "Planejamento Estratégico e Orçamento Empresarial", type: "important" },
        { name: "Optativa VI", type: "neutral" },
      ]),
    ],
    notes: "Anote aqui suas observações.",
    logoData: null,
    reminders: [],
  }
}

export function normalizeProgressionData(data: Partial<ProgressionData>): ProgressionData {
  return {
    semesters: (data.semesters ?? []).map((semester) => ({
      ...semester,
      collapsed: semester.collapsed ?? true,
      disciplines: (semester.disciplines ?? []).map((d) => normalizeDiscipline(d)),
    })),
    notes: data.notes ?? "",
    logoData: data.logoData ?? null,
    reminders: (data.reminders ?? []).map((item) => normalizeReminder(item as Reminder)),
  }
}

function progressionRef(userId: string) {
  return doc(db, "users", userId, "progression", "main")
}

export async function getProgression(userId: string): Promise<ProgressionData | null> {
  const snap = await getDoc(progressionRef(userId))
  if (!snap.exists()) return null
  return normalizeProgressionData(snap.data() as Partial<ProgressionData>)
}

export function subscribeProgression(
  userId: string,
  onData: (data: ProgressionData) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    progressionRef(userId),
    (snap) => {
      if (snap.exists()) {
        onData(normalizeProgressionData(snap.data() as Partial<ProgressionData>))
      } else {
        onData(defaultProgression())
      }
    },
    (err) => onError?.(err)
  )
}

export async function saveProgression(userId: string, data: ProgressionData) {
  await setDoc(progressionRef(userId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}
