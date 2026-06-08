import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { classifyTextBrowser } from "@/lib/licitacoes/classifier-browser"
import { ESPECIALIDADES_CATALOG } from "@/lib/licitacoes/seed-data"
import {
  mapScrapedToLicitacao,
  scrapeLicititaBrowser,
  type LicititaItem,
} from "@/lib/licitacoes/scraper-browser"
import type { Especialidade } from "@/lib/licitacoes/types"

export interface CollectStats {
  licitacoesColetadas: number
  licitacoesNovas: number
  matchesCriados: number
  erros: number
  mensagem?: string
}

function catalogBySlug(): Map<string, Especialidade> {
  return new Map(
    ESPECIALIDADES_CATALOG.map((esp) => [
      esp.slug,
      {
        id: esp.slug,
        nome: esp.nome,
        slug: esp.slug,
        descricao: esp.descricao,
        palavras_chave: [...esp.palavras_chave],
        ativo: true,
      },
    ]),
  )
}

async function urlExists(url: string): Promise<boolean> {
  const snap = await getDocs(
    query(
      collection(db, "licitacoes"),
      where("url_fonte", "==", url),
      limit(1),
    ),
  )
  return !snap.empty
}

async function matchExists(
  licitacaoId: string,
  advogadoId: string,
): Promise<boolean> {
  const snap = await getDocs(
    query(
      collection(db, "licitacoesMatches"),
      where("licitacao_id", "==", licitacaoId),
      where("advogado_id", "==", advogadoId),
      limit(1),
    ),
  )
  return !snap.empty
}

async function getOwnerSlugs(): Promise<Set<string>> {
  const ownerSnap = await getDoc(doc(db, "licitacoesConfig", "owner"))
  if (!ownerSnap.exists()) return new Set()

  const slugs = (
    (ownerSnap.data().especialidades as Array<{ slug: string }>) ?? []
  ).map((e) => e.slug)

  return new Set(slugs)
}

async function createMatch(
  licitacaoId: string,
  advogadoId: string,
  especialidadeId: string,
  relevanciaScore: number,
  motivo: string,
  licitacao: Record<string, unknown>,
  especialidade: Especialidade,
) {
  const now = new Date().toISOString()
  await addDoc(collection(db, "licitacoesMatches"), {
    licitacao_id: licitacaoId,
    advogado_id: advogadoId,
    especialidade_id: especialidadeId,
    relevancia_score: relevanciaScore,
    motivo,
    status: "novo",
    notificado: false,
    visto_em: null,
    inscrito_em: null,
    arquivado_em: null,
    created_at: now,
    licitacao: { id: licitacaoId, ...licitacao },
    especialidade,
  })
}

async function processItem(
  item: LicititaItem,
  ownerSlugs: Set<string>,
  catalog: Map<string, Especialidade>,
): Promise<{ nova: boolean; matches: number }> {
  const exists = await urlExists(item.url)
  if (exists) return { nova: false, matches: 0 }

  const licitacaoData = mapScrapedToLicitacao(item)
  const now = new Date().toISOString()
  const licRef = await addDoc(collection(db, "licitacoes"), {
    ...licitacaoData,
    created_at: now,
    updated_at: now,
  })

  const texto = [item.titulo, item.descricao].filter(Boolean).join(" ")
  const classificacoes = classifyTextBrowser(texto)
  let matches = 0

  const best = classificacoes.find((c) => ownerSlugs.has(c.especialidade))
  if (best) {
    const dup = await matchExists(licRef.id, "owner")
    if (!dup) {
      const esp = catalog.get(best.especialidade)
      if (esp) {
        await createMatch(
          licRef.id,
          "owner",
          best.especialidade,
          best.score,
          `NLP: ${best.especialidade} (${best.score.toFixed(2)})`,
          licitacaoData,
          esp,
        )
        matches = 1
      }
    }
  }

  return { nova: true, matches }
}

/** Coleta licitações do Licitita e grava no Firestore (browser, owner logado). */
export async function runCollectInBrowser(): Promise<CollectStats> {
  const stats: CollectStats = {
    licitacoesColetadas: 0,
    licitacoesNovas: 0,
    matchesCriados: 0,
    erros: 0,
  }

  const ownerSlugs = await getOwnerSlugs()
  if (ownerSlugs.size === 0) {
    throw new Error("Perfil owner não configurado. Recarregue a página.")
  }

  const catalog = catalogBySlug()
  let scraped: LicititaItem[] = []

  try {
    scraped = await scrapeLicititaBrowser()
    stats.licitacoesColetadas = scraped.length
  } catch (error) {
    stats.erros += 1
    throw error
  }

  for (const item of scraped) {
    try {
      const result = await processItem(item, ownerSlugs, catalog)
      if (result.nova) stats.licitacoesNovas += 1
      stats.matchesCriados += result.matches
    } catch {
      stats.erros += 1
    }
  }

  stats.mensagem =
    stats.licitacoesNovas > 0
      ? `${stats.licitacoesNovas} nova(s), ${stats.matchesCriados} match(es).`
      : "Nenhuma licitação nova — tudo já estava no banco."

  return stats
}
