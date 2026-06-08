import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type {
  AdvogadoEspecialidade,
  DashboardStats,
  Especialidade,
  Match,
  MatchStatus,
} from "@/lib/licitacoes/types"

interface DashboardPayload {
  advogado: { id: string; nome: string; email: string } | null
  matches: Match[]
  especialidades: AdvogadoEspecialidade[]
  stats: DashboardStats
}

function startOfCurrentMonth(): string {
  const date = new Date()
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

function mapEspecialidade(id: string, data: Record<string, unknown>): Especialidade {
  return {
    id,
    nome: String(data.nome ?? id),
    slug: String(data.slug ?? id),
    descricao: (data.descricao as string | null) ?? null,
    palavras_chave: (data.palavras_chave as string[]) ?? [],
    ativo: data.ativo !== false,
  }
}

function mapMatch(id: string, data: Record<string, unknown>): Match {
  return {
    id,
    licitacao_id: String(data.licitacao_id),
    advogado_id: String(data.advogado_id),
    especialidade_id: String(data.especialidade_id),
    relevancia_score: Number(data.relevancia_score),
    motivo: (data.motivo as string | null) ?? null,
    status: data.status as MatchStatus,
    notificado: Boolean(data.notificado),
    visto_em: (data.visto_em as string | null) ?? null,
    inscrito_em: (data.inscrito_em as string | null) ?? null,
    arquivado_em: (data.arquivado_em as string | null) ?? null,
    created_at: String(data.created_at ?? new Date().toISOString()),
    licitacao: data.licitacao as Match["licitacao"],
    especialidade: data.especialidade as Match["especialidade"],
  }
}

export async function fetchLicitacoesDashboard(): Promise<DashboardPayload> {
  const ownerSnap = await getDoc(doc(db, "licitacoesConfig", "owner"))
  if (!ownerSnap.exists()) {
    return {
      advogado: null,
      matches: [],
      especialidades: [],
      stats: { abertasMes: 0, inscricoesMes: 0 },
    }
  }

  const owner = ownerSnap.data()
  const advogado = {
    id: String(owner.id ?? "owner"),
    nome: String(owner.nome),
    email: String(owner.email),
  }

  const catalogSnap = await getDocs(collection(db, "licitacoesEspecialidades"))
  const catalogBySlug = new Map<string, Especialidade>()
  for (const catalogDoc of catalogSnap.docs) {
    const esp = mapEspecialidade(catalogDoc.id, catalogDoc.data())
    catalogBySlug.set(esp.slug, esp)
  }

  const especialidades: AdvogadoEspecialidade[] = (
    (owner.especialidades as Array<{
      slug: string
      nivel_experiencia: AdvogadoEspecialidade["nivel_experiencia"]
    }>) ?? []
  ).map((item) => ({
    especialidade_id: item.slug,
    nivel_experiencia: item.nivel_experiencia,
    especialidade: catalogBySlug.get(item.slug) ?? {
      id: item.slug,
      nome: item.slug,
      slug: item.slug,
      descricao: null,
      palavras_chave: [],
      ativo: true,
    },
  }))

  const matchesSnap = await getDocs(
    query(collection(db, "licitacoesMatches"), orderBy("created_at", "desc")),
  )

  const monthStart = startOfCurrentMonth()
  const matches: Match[] = []

  for (const matchDoc of matchesSnap.docs) {
    const match = mapMatch(matchDoc.id, matchDoc.data())
    if (match.status === "arquivado") continue
    matches.push(match)
  }

  const stats: DashboardStats = {
    abertasMes: matches.filter((m) => m.created_at >= monthStart).length,
    inscricoesMes: matches.filter(
      (m) =>
        m.status === "inscrito" &&
        m.inscrito_em != null &&
        m.inscrito_em >= monthStart,
    ).length,
  }

  return { advogado, matches, especialidades, stats }
}

export async function updateLicitacaoMatchStatus(
  matchId: string,
  status: MatchStatus,
): Promise<void> {
  const now = new Date().toISOString()
  const payload: Record<string, unknown> = { status }

  if (status === "visto") payload.visto_em = now
  if (status === "inscrito") payload.inscrito_em = now
  if (status === "arquivado") payload.arquivado_em = now

  await updateDoc(doc(db, "licitacoesMatches", matchId), payload)
}

export function isLicitacoesConfigured(): boolean {
  return process.env.NEXT_PUBLIC_LICITACOES_ENABLED !== "false"
}
