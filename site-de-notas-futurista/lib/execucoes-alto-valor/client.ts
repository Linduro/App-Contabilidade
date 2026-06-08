import { collection, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { matchesDataRange } from "@/lib/datajud/date-range"
import type {
  AltoValorFilters,
  ContatoField,
  ExecucaoAltoValor,
  ExecucaoAltoValorStatus,
} from "@/lib/execucoes-alto-valor/types"

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
    temAdvogado: Boolean(data.temAdvogado),
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
