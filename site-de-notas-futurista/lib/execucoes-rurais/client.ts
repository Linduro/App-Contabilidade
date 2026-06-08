import { collection, doc, getDocs, orderBy, query, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { ExecucaoFilters, ExecucaoRural, ExecucaoStatus } from "@/lib/execucoes-rurais/types"

function mapDoc(id: string, data: Record<string, unknown>): ExecucaoRural {
  return {
    id,
    nome_reu: String(data.nome_reu ?? ""),
    cpf_cnpj: (data.cpf_cnpj as string) ?? null,
    tipo_reu: String(data.tipo_reu ?? "PF"),
    processo: String(data.processo ?? data.numero_processo ?? ""),
    numero_processo: String(data.numero_processo ?? ""),
    tribunal: (data.tribunal as string) ?? null,
    vara: (data.vara as string) ?? null,
    comarca: (data.comarca as string) ?? null,
    valor_execucao: data.valor_execucao != null ? Number(data.valor_execucao) : null,
    credor_exequente: (data.credor_exequente as string) ?? null,
    data_ajuizamento: (data.data_ajuizamento as string) ?? null,
    tem_advogado: Boolean(data.tem_advogado),
    area_hectares: data.area_hectares != null ? Number(data.area_hectares) : null,
    municipio_imovel: (data.municipio_imovel as string) ?? null,
    score: Number(data.score ?? 0),
    score_motivo: (data.score_motivo as string) ?? null,
    status: (data.status as ExecucaoStatus) ?? "novo",
    contatos: (data.contatos as Record<string, { valor: string; fonte: string; confianca: number }>) ?? {},
    enriquecimento_parcial: Boolean(data.enriquecimento_parcial),
    created_at: String(data.created_at ?? ""),
  }
}

export function filterExecucoes(items: ExecucaoRural[], filters: ExecucaoFilters): ExecucaoRural[] {
  return items.filter((item) => {
    if (filters.status !== "all" && item.status !== filters.status) return false
    if (filters.comarca.trim()) {
      const q = filters.comarca.toLowerCase()
      const hay = `${item.comarca ?? ""} ${item.municipio_imovel ?? ""}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    const min = filters.valorMin ? parseFloat(filters.valorMin) : null
    const max = filters.valorMax ? parseFloat(filters.valorMax) : null
    const valor = item.valor_execucao ?? 0
    if (min != null && !Number.isNaN(min) && valor < min) return false
    if (max != null && !Number.isNaN(max) && valor > max) return false
    return true
  })
}

export async function fetchExecucoesRurais(): Promise<ExecucaoRural[]> {
  const snap = await getDocs(
    query(collection(db, "execucoesRurais"), orderBy("score", "desc")),
  )
  return snap.docs.map((d) => mapDoc(d.id, d.data() as Record<string, unknown>))
}

export async function updateExecucaoStatus(id: string, status: ExecucaoStatus) {
  await updateDoc(doc(db, "execucoesRurais", id), {
    status,
    updated_at: new Date().toISOString(),
  })
}
