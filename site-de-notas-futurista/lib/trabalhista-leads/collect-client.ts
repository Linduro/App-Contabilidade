import { addDoc, collection, getDocs, limit, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { DEFAULT_TRTS } from "@/lib/datajud/config"
import { searchDatajudEndpoint } from "@/lib/datajud/fetch"
import { DATAJUD_SEARCH_DAYS, normalizeTrabalhistaSource } from "@/lib/datajud/normalize"
import type { TrabalhistaCollectParams } from "@/lib/trabalhista-leads/types"

export interface TrabalhistaCollectStats {
  consultados: number
  analisados: number
  novos: number
  mensagem?: string
}

async function leadExists(numeroProcesso: string): Promise<boolean> {
  const snap = await getDocs(
    query(collection(db, "leads"), where("numero_processo", "==", numeroProcesso), limit(1)),
  )
  return !snap.empty
}

async function fetchCnpj(cnpj: string) {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
    if (!res.ok) return null
    const data = await res.json()
    const tel = data.ddd_telefone_1
      ? `(${String(data.ddd_telefone_1).slice(0, 2)}) ${String(data.ddd_telefone_1).slice(2)}`
      : null
    const qsa = Array.isArray(data.qsa) ? data.qsa[0] : null
    return {
      razao_social: data.razao_social || data.nome_fantasia,
      responsavel: qsa?.nome_socio || null,
      telefone: tel,
      email: null as string | null,
      municipio: data.municipio,
      uf: data.uf,
    }
  } catch {
    return null
  }
}

export async function runTrabalhistaCollectInBrowser(
  _userId: string | null | undefined,
  params: TrabalhistaCollectParams,
): Promise<TrabalhistaCollectStats> {
  const stats: TrabalhistaCollectStats = { consultados: 0, analisados: 0, novos: 0 }
  const trts = params.trts?.length ? params.trts : [...DEFAULT_TRTS]
  const daysBack = params.dataDe ? undefined : (params.daysBack ?? DATAJUD_SEARCH_DAYS)

  const candidates: NonNullable<ReturnType<typeof normalizeTrabalhistaSource>>[] = []

  for (const trt of trts) {
    const sources = await searchDatajudEndpoint(`api_publica_trt${trt}`, {
      dataDe: params.dataDe || undefined,
      dataAte: params.dataAte || undefined,
      daysBack,
      size: params.pageSize ?? 100,
    })

    stats.consultados += sources.length

    for (const source of sources) {
      const parsed = normalizeTrabalhistaSource(source, trt)
      if (parsed) candidates.push(parsed)
    }
  }

  stats.analisados = candidates.length

  for (const c of candidates) {
    if (!c?.numero_processo) continue
    if (await leadExists(c.numero_processo)) continue

    let lead = { ...c }

    if (c.cnpj) {
      const cnpjData = await fetchCnpj(c.cnpj)
      if (cnpjData) {
        lead = {
          ...lead,
          empresa: cnpjData.razao_social || lead.empresa,
          responsavel: cnpjData.responsavel,
          telefone: cnpjData.telefone,
          email: cnpjData.email,
          municipio: cnpjData.municipio || lead.comarca,
          uf: cnpjData.uf,
        }
      }
    }

    const now = new Date().toISOString()
    await addDoc(collection(db, "leads"), {
      ...lead,
      processos_simultaneos: 0,
      status: "novo",
      score: 0,
      score_motivo: null,
      created_at: now,
      updated_at: now,
    })
    stats.novos += 1
  }

  stats.mensagem =
    stats.novos > 0
      ? `${stats.consultados} no Datajud (2 meses), ${stats.novos} novo(s) salvos. Refine com os filtros acima.`
      : stats.analisados > 0
        ? `${stats.consultados} no Datajud, ${stats.analisados} normalizados — nenhum novo (já existiam).`
        : stats.consultados > 0
          ? `${stats.consultados} processo(s) fora da janela de 2 meses ou sem número válido.`
          : "Nenhum processo no Datajud nos últimos 2 meses."

  return stats
}
