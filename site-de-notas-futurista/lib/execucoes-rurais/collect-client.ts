import { addDoc, collection, getDocs, limit, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { TRIBUNAIS_EXECUCAO } from "@/lib/datajud/config"
import { searchDatajudEndpoint } from "@/lib/datajud/fetch"
import { DATAJUD_SEARCH_DAYS, normalizeExecucaoSource } from "@/lib/datajud/normalize"
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
  _userId: string | null | undefined,
  params: ExecucaoCollectParams,
): Promise<ExecucaoCollectStats> {
  const stats: ExecucaoCollectStats = { consultados: 0, analisados: 0, novos: 0 }
  const tribunais = params.tribunais?.length
    ? TRIBUNAIS_EXECUCAO.filter((t) => params.tribunais!.includes(t.label))
    : [...TRIBUNAIS_EXECUCAO]

  const daysBack = params.dataDe ? undefined : (params.daysBack ?? DATAJUD_SEARCH_DAYS)
  const candidates: NonNullable<ReturnType<typeof normalizeExecucaoSource>>[] = []

  for (const t of tribunais) {
    const sources = await searchDatajudEndpoint(`api_publica_${t.alias}`, {
      dataDe: params.dataDe || undefined,
      dataAte: params.dataAte || undefined,
      daysBack,
      size: params.pageSize ?? 100,
    })

    stats.consultados += sources.length

    for (const source of sources) {
      const parsed = normalizeExecucaoSource(source, t.label)
      if (parsed) candidates.push(parsed)
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
      ? `${stats.consultados} no Datajud (2 meses), ${stats.novos} nova(s) salvas. Use os filtros para refinar.`
      : stats.analisados > 0
        ? `${stats.consultados} no Datajud, ${stats.analisados} normalizados — nenhuma nova.`
        : stats.consultados > 0
          ? `${stats.consultados} processo(s) fora da janela de 2 meses ou sem número válido.`
          : "Nenhum processo no Datajud nos últimos 2 meses."

  return stats
}
