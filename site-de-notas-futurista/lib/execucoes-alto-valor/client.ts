import { collection, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { matchesDataRange } from "@/lib/datajud/date-range"
import { matchesCaptacaoFilter } from "@/lib/datajud/captacao-filter"
import type { AdvogadoStatus } from "@/lib/datajud/advogado-detect"
import type {
  AltoValorFilters,
  ContatoField,
  ExecucaoAltoValor,
  ExecucaoAltoValorStatus,
} from "@/lib/execucoes-alto-valor/types"

function mapAdvogadoStatus(raw: unknown): AdvogadoStatus {
  if (raw === true) return true
  if (raw === false) return false
  return null
}

function mapDoc(id: string, data: Record<string, unknown>): ExecucaoAltoValor {
  return {
    id,
    processo: String(data.processo ?? ""),
    numeroProcesso: String(data.numeroProcesso ?? ""),
    tribunal: (data.tribunal as string) ?? null,
    vara: (data.vara as string) ?? null,
    comarca: (data.comarca as string) ?? null,
    valorCausa: Number(data.valorCausa ?? 0),
    exequente: (data.exequente as string) ?? null,
    executado: String(data.executado ?? ""),
    cnpjCpf: String(data.cnpjCpf ?? ""),
    tipoExecutado: (data.tipoExecutado as "PF" | "PJ") ?? "PF",
    dataAjuizamento: (data.dataAjuizamento as string) ?? null,
    ultimoMovimento: (data.ultimoMovimento as string) ?? null,
    temAdvogado: mapAdvogadoStatus(data.temAdvogado),
    capaDatajud: Boolean(data.capaDatajud),
    classe_execucao: Boolean(data.classe_execucao),
    alto_valor:
      data.alto_valor === true ? true : data.alto_valor === false ? false : null,
    contatos: (data.contatos as Record<string, ContatoField>) ?? {},
    score: Number(data.score ?? 0),
    scoreMotivo: (data.scoreMotivo as string) ?? null,
    status: (data.status as ExecucaoAltoValorStatus) ?? "novo",
    criadoEm: String(data.criadoEm ?? ""),
  }
}

export function filterAltoValor(
  items: ExecucaoAltoValor[],
  filters: AltoValorFilters,
): ExecucaoAltoValor[] {
  return items.filter((item) => {
    if (filters.status !== "all" && item.status !== filters.status) return false
    if (!matchesDataRange(item.dataAjuizamento, filters.dataDe, filters.dataAte)) {
      return false
    }
    if (filters.comarca.trim()) {
      const q = filters.comarca.toLowerCase()
      const hay = `${item.comarca ?? ""} ${item.vara ?? ""}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    const min = filters.valorMin ? parseFloat(filters.valorMin) : null
    if (min != null && !Number.isNaN(min) && item.valorCausa < min) return false
    if (
      !matchesCaptacaoFilter(item.temAdvogado, item.capaDatajud, filters.captacao)
    ) {
      return false
    }
    if (filters.altoValor === "sim" && item.alto_valor !== true) return false
    if (filters.altoValor === "nao" && item.alto_valor !== false) return false
    if (filters.altoValor === "desconhecido" && item.alto_valor != null) return false
    if (filters.classeExecucao === "sim" && !item.classe_execucao) return false
    if (filters.classeExecucao === "nao" && item.classe_execucao) return false
    return true
  })
}

export async function fetchExecucoesAltoValor(): Promise<ExecucaoAltoValor[]> {
  const snap = await getDocs(
    query(collection(db, "execucoesAltoValor"), orderBy("valorCausa", "desc")),
  )
  return snap.docs.map((d) => mapDoc(d.id, d.data() as Record<string, unknown>))
}

export async function updateAltoValorStatus(
  id: string,
  status: ExecucaoAltoValorStatus,
): Promise<void> {
  await updateDoc(doc(db, "execucoesAltoValor", id), {
    status,
    atualizadoEm: new Date().toISOString(),
  })
}
