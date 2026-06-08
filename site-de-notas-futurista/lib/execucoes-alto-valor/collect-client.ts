import { addDoc, collection, getDocs, limit, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  ALTO_VALOR_MIN,
  CLASSES_EXECUCAO_ALTO_VALOR,
  TRIBUNAIS_ALTO_VALOR,
  CNAES_RURAL_PREFIXES,
} from "@/lib/datajud/alto-valor-constants"
import { parseAltoValorSource } from "@/lib/datajud/alto-valor-parse"
import { searchDatajudEndpoint } from "@/lib/datajud/fetch"
import {
  EMPTY_REGIONAL_FILTER,
  fetchRegionalFilters,
} from "@/lib/regional-filters/client"
import { matchesRegionalFilter, type RegionalFilterState } from "@/lib/regional-filters/regioes"
import type { AltoValorCollectParams } from "@/lib/execucoes-alto-valor/types"

export interface AltoValorCollectStats {
  analisados: number
  novos: number
  mensagem?: string
}

async function exists(numeroProcesso: string): Promise<boolean> {
  const snap = await getDocs(
    query(
      collection(db, "execucoesAltoValor"),
      where("numeroProcesso", "==", numeroProcesso),
      limit(1),
    ),
  )
  return !snap.empty
}

async function fetchCnpjRural(cnpj: string): Promise<boolean> {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
    if (!res.ok) return false
    const data = await res.json()
    const cnae = String(data.cnae_fiscal || "").replace(/\D/g, "").slice(0, 4)
    return CNAES_RURAL_PREFIXES.some((p) => cnae.startsWith(p))
  } catch {
    return false
  }
}

async function liteEnrich(cnpjCpf: string, executado: string) {
  const contatos: Record<string, { valor: string; fonte: string; confianca: number }> = {}
  if (cnpjCpf.length === 14) {
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjCpf}`)
      if (res.ok) {
        const data = await res.json()
        if (data.ddd_telefone_1) {
          contatos.telefone = {
            valor: String(data.ddd_telefone_1),
            fonte: "cnpj",
            confianca: 0.85,
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
  return { contatos, executado }
}

export async function runAltoValorCollectInBrowser(
  userId: string | null | undefined,
  params: AltoValorCollectParams,
  regionalFilters?: RegionalFilterState,
): Promise<AltoValorCollectStats> {
  const stats: AltoValorCollectStats = { analisados: 0, novos: 0 }

  let regionFilter = regionalFilters ?? { ...EMPTY_REGIONAL_FILTER }
  if (userId && !regionalFilters) {
    regionFilter = await fetchRegionalFilters(userId, "execucoesAltoValor")
  }

  const candidates: NonNullable<ReturnType<typeof parseAltoValorSource>>[] = []

  for (const t of TRIBUNAIS_ALTO_VALOR) {
    const sources = await searchDatajudEndpoint(`api_publica_${t.alias}`, {
      dataDe: params.dataDe || undefined,
      dataAte: params.dataAte || undefined,
      daysBack: params.dataDe ? undefined : params.daysBack ?? 30,
      size: 50,
      classCodes: [...CLASSES_EXECUCAO_ALTO_VALOR],
      minValorCausa: ALTO_VALOR_MIN,
    })

    for (const source of sources) {
      const parsed = parseAltoValorSource(source, t.label)
      if (!parsed) continue
      if (!matchesRegionalFilter([parsed.comarca, parsed.vara], regionFilter)) continue
      candidates.push(parsed)
    }
  }

  stats.analisados = candidates.length

  for (const c of candidates) {
    if (!c.numeroProcesso) continue
    if (await exists(c.numeroProcesso)) continue

    const cnaeRural =
      c.tipoExecutado === "PJ" && c.cnpjCpf ? await fetchCnpjRural(c.cnpjCpf) : false
    const enrichment = await liteEnrich(c.cnpjCpf, c.executado)
    const now = new Date().toISOString()

    await addDoc(collection(db, "execucoesAltoValor"), {
      numeroProcesso: c.numeroProcesso,
      processo: c.processo,
      tribunal: c.tribunal,
      vara: c.vara,
      comarca: c.comarca,
      valorCausa: c.valorCausa,
      exequente: c.exequente,
      executado: c.executado,
      cnpjCpf: c.cnpjCpf,
      tipoExecutado: c.tipoExecutado,
      dataAjuizamento: c.dataAjuizamento,
      ultimoMovimento: c.ultimoMovimento,
      temAdvogado: false,
      cnaeRural,
      comarcaInterior: c.comarcaInterior,
      contatos: enrichment.contatos,
      score: 0,
      scoreMotivo: null,
      status: "novo",
      criadoEm: now,
      atualizadoEm: now,
    })
    stats.novos += 1
  }

  stats.mensagem =
    stats.novos > 0
      ? `${stats.analisados} analisado(s), ${stats.novos} novo(s) acima de R$ 500k.`
      : `${stats.analisados} analisado(s) — nenhum processo novo qualificado.`

  return stats
}
