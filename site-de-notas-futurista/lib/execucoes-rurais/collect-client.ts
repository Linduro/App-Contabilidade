import { addDoc, collection, getDocs, limit, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { TRIBUNAIS_EXECUCAO } from "@/lib/datajud/config"
import { searchDatajudEndpoint } from "@/lib/datajud/fetch"
import { DATAJUD_SEARCH_DAYS, triageExecucaoRural } from "@/lib/datajud/triage"
import {
  EMPTY_REGIONAL_FILTER,
  fetchRegionalFilters,
} from "@/lib/regional-filters/client"
import { matchesRegionalFilter, type RegionalFilterState } from "@/lib/regional-filters/regioes"
import type { ExecucaoCollectParams } from "@/lib/execucoes-rurais/types"

export interface ExecucaoCollectStats {
  consultados: number
  analisados: number
  novos: number
  mensagem?: string
}

async function execucaoExists(numeroProcesso: string): Promise<boolean> {
  const snap = await getDocs(
    query(
      collection(db, "execucoesRurais"),
      where("numero_processo", "==", numeroProcesso),
      limit(1),
    ),
  )
  return !snap.empty
}

export async function runExecucoesCollectInBrowser(
  userId: string | null | undefined,
  params: ExecucaoCollectParams,
  regionalFilters?: RegionalFilterState,
): Promise<ExecucaoCollectStats> {
  const stats: ExecucaoCollectStats = { consultados: 0, analisados: 0, novos: 0 }
  const tribunais = params.tribunais?.length
    ? TRIBUNAIS_EXECUCAO.filter((t) => params.tribunais!.includes(t.label))
    : [...TRIBUNAIS_EXECUCAO]

  const daysBack = params.dataDe ? undefined : (params.daysBack ?? DATAJUD_SEARCH_DAYS)

  let regionFilter = regionalFilters ?? { ...EMPTY_REGIONAL_FILTER }
  if (userId && !regionalFilters) {
    regionFilter = await fetchRegionalFilters(userId, "execucoesRurais")
  }

  const candidates: NonNullable<ReturnType<typeof triageExecucaoRural>>[number][] = []

  for (const t of tribunais) {
    const sources = await searchDatajudEndpoint(`api_publica_${t.alias}`, {
      dataDe: params.dataDe || undefined,
      dataAte: params.dataAte || undefined,
      daysBack,
      size: params.pageSize ?? 100,
    })

    stats.consultados += sources.length

    const triaged = triageExecucaoRural(sources, t.label, params.natureza)
    for (const parsed of triaged) {
      if (
        !matchesRegionalFilter(
          [parsed.comarca, parsed.municipio_imovel, parsed.vara],
          regionFilter,
        )
      ) {
        continue
      }
      candidates.push(parsed)
    }
  }

  stats.analisados = candidates.length

  for (const c of candidates) {
    if (!c.numero_processo) continue
    if (await execucaoExists(c.numero_processo)) continue

    const now = new Date().toISOString()
    await addDoc(collection(db, "execucoesRurais"), {
      ...c,
      processo: c.numero_processo_formatado || c.numero_processo,
      score: 0,
      score_motivo: null,
      status: "novo",
      contatos: {},
      enriquecimento_parcial: true,
      created_at: now,
      updated_at: now,
    })
    stats.novos += 1
  }

  stats.mensagem =
    stats.novos > 0
      ? `${stats.consultados} no Datajud (2 meses), ${stats.novos} nova(s) execução(ões) após triagem.`
      : stats.analisados > 0
        ? `${stats.consultados} no Datajud, ${stats.analisados} na triagem — nenhuma nova.`
        : stats.consultados > 0
          ? `${stats.consultados} processo(s) — nenhum passou na triagem ou filtros regionais.`
          : "Nenhum processo no Datajud nos últimos 2 meses."

  return stats
}
