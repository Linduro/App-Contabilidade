import { getFunctions, httpsCallable } from "firebase/functions"
import { app } from "@/lib/firebase"
import type {
  AdvogadoEspecialidade,
  DashboardStats,
  Match,
  MatchStatus,
} from "@/lib/licitacoes/types"

const functions = getFunctions(app)

type LicitacoesAction =
  | { action: "getDashboard" }
  | {
      action: "updateMatchStatus"
      matchId: string
      status: MatchStatus
    }

interface DashboardPayload {
  advogado: { id: string; nome: string; email: string } | null
  matches: Match[]
  especialidades: AdvogadoEspecialidade[]
  stats: DashboardStats
}

async function callLicitacoesApi<T>(payload: LicitacoesAction): Promise<T> {
  const callable = httpsCallable<LicitacoesAction, T>(functions, "licitacoesApi")
  const result = await callable(payload)
  return result.data
}

export async function fetchLicitacoesDashboard(): Promise<DashboardPayload> {
  return callLicitacoesApi<DashboardPayload>({ action: "getDashboard" })
}

export async function updateLicitacaoMatchStatus(
  matchId: string,
  status: MatchStatus,
): Promise<void> {
  await callLicitacoesApi<{ ok: true }>({
    action: "updateMatchStatus",
    matchId,
    status,
  })
}

export function isLicitacoesConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_LICITACOES_ENABLED !== "false")
}
