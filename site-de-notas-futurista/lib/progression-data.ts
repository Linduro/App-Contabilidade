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

export interface ProgressionData {
  semesters: Semester[]
  notes: string
  logoData: string | null
}

export const PORTAL_LINKS = [
  { label: "Portal de Aulas", href: "https://fipecafi.blackboard.com/?new_loc=%2Fultra" },
  { label: "Portal de solicitações e financeiro", href: "https://sistemas.fipecafi.org/PortalWebAluno" },
  { label: "Minha Biblioteca", href: "https://sso.minhabiblioteca.com.br/Login.aspx?key=FIPECAFI" },
  { label: "Guia de Provas", href: "https://fipecafi.blackboard.com/" },
  { label: "Calendário 2026", href: "https://fipecafi.blackboard.com/" },
  { label: "Guia do Aluno", href: "https://fipecafi.blackboard.com/" },
]

export const DISCIPLINE_PRESETS: Record<DisciplineType, { emoji: string; label: string }> = {
  essential: { emoji: "🔥🔥", label: "Essencial" },
  important: { emoji: "🔥", label: "Importante" },
  discarded: { emoji: "🚫", label: "Dispensada" },
}

export function createId() {
  return crypto.randomUUID()
}

export function createDiscipline(type: DisciplineType): Discipline {
  const preset = DISCIPLINE_PRESETS[type]
  return {
    id: createId(),
    emoji: preset.emoji,
    name: `${preset.label}...`,
    type,
    status: "none",
    grade: "",
  }
}

export function createSemester(): Semester {
  return {
    id: createId(),
    title: "Novo Semestre",
    disciplines: [],
  }
}

export function defaultProgression(): ProgressionData {
  return {
    semesters: [createSemester()],
    notes: "Anote aqui suas observações.",
    logoData: null,
  }
}

function progressionRef(userId: string) {
  return doc(db, "users", userId, "progression", "main")
}

export async function getProgression(userId: string): Promise<ProgressionData | null> {
  const snap = await getDoc(progressionRef(userId))
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    semesters: data.semesters ?? [],
    notes: data.notes ?? "",
    logoData: data.logoData ?? null,
  }
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
        const data = snap.data()
        onData({
          semesters: data.semesters ?? [],
          notes: data.notes ?? "",
          logoData: data.logoData ?? null,
        })
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
