import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

export type DisciplineStatus = "none" | "cursando" | "concluido"
export type DisciplineType = "essential" | "important" | "discarded"

export interface Discipline {
  id: string
  emoji: string
  name: string
  type: DisciplineType
  status: DisciplineStatus
  grade: string
}

export interface Semester {
  id: string
  title: string
  disciplines: Discipline[]
}

export interface Reminder {
  id: string
  title: string
  date: string
  done: boolean
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
  discarded: { emoji: "🚫", label: "Dispensada" },
}

export function createId() {
  return crypto.randomUUID()
}

export function createDiscipline(type: DisciplineType, name?: string): Discipline {
  const preset = DISCIPLINE_PRESETS[type]
  return {
    id: createId(),
    emoji: preset.emoji,
    name: name ?? `${preset.label}...`,
    type,
    status: "none",
    grade: "",
  }
}

export function createSemester(title = "Novo Semestre", disciplines: Discipline[] = []): Semester {
  return { id: createId(), title, disciplines }
}

export function createReminder(): Reminder {
  return {
    id: createId(),
    title: "",
    date: new Date().toISOString().slice(0, 10),
    done: false,
  }
}

export function defaultProgression(): ProgressionData {
  return {
    semesters: [createSemester()],
    notes: "Anote aqui suas observações.",
    logoData: null,
    reminders: [],
  }
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
        { name: "Introdução à Contabilidade", type: "essential" },
        { name: "Matemática Financeira", type: "essential" },
        { name: "Comunicação e Expressão", type: "important" },
        { name: "Introdução ao Direito", type: "important" },
      ]),
      buildSemester("2º Semestre", [
        { name: "Contabilidade Intermediária", type: "essential" },
        { name: "Microeconomia", type: "important" },
        { name: "Estatística Aplicada", type: "important" },
        { name: "Direito Civil", type: "important" },
      ]),
      buildSemester("3º Semestre", [
        { name: "Contabilidade Avançada", type: "essential" },
        { name: "Finanças Corporativas", type: "essential" },
        { name: "Direito Tributário", type: "important" },
        { name: "Auditoria", type: "important" },
      ]),
      buildSemester("4º Semestre", [
        { name: "Contabilidade de Custos", type: "essential" },
        { name: "Análise das Demonstrações Financeiras", type: "essential" },
        { name: "Controladoria", type: "important" },
        { name: "Trabalho de Conclusão — TCC", type: "essential" },
      ]),
    ],
    notes: "Anote aqui suas observações.",
    logoData: null,
    reminders: [],
  }
}

function normalizeData(data: Partial<ProgressionData>): ProgressionData {
  return {
    semesters: data.semesters ?? [],
    notes: data.notes ?? "",
    logoData: data.logoData ?? null,
    reminders: data.reminders ?? [],
  }
}

function progressionRef(userId: string) {
  return doc(db, "users", userId, "progression", "main")
}

export async function getProgression(userId: string): Promise<ProgressionData | null> {
  const snap = await getDoc(progressionRef(userId))
  if (!snap.exists()) return null
  return normalizeData(snap.data() as Partial<ProgressionData>)
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
        onData(normalizeData(snap.data() as Partial<ProgressionData>))
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
