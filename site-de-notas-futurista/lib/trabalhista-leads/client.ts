import {
  collection,
  getDocs,
  orderBy,
  query,
  updateDoc,
  doc,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type {
  Lead,
  LeadFilters,
  LeadStatus,
  TrabalhistaStats,
} from "@/lib/trabalhista-leads/types"

function mapLead(id: string, data: Record<string, unknown>): Lead {
  return {
    id,
    empresa: String(data.empresa ?? ""),
    cnpj: (data.cnpj as string) ?? null,
    numero_processo: String(data.numero_processo ?? ""),
    numero_processo_formatado:
      (data.numero_processo_formatado as string) ?? null,
    vara: (data.vara as string) ?? null,
    comarca: (data.comarca as string) ?? null,
    tribunal: (data.tribunal as string) ?? null,
    valor_causa:
      data.valor_causa != null ? Number(data.valor_causa) : null,
    data_ajuizamento: (data.data_ajuizamento as string) ?? null,
    responsavel: (data.responsavel as string) ?? null,
    telefone: (data.telefone as string) ?? null,
    email: (data.email as string) ?? null,
    score: Number(data.score ?? 0),
    score_motivo: (data.score_motivo as string) ?? null,
    status: (data.status as LeadStatus) ?? "novo",
    setor: (data.setor as string) ?? null,
    municipio: (data.municipio as string) ?? null,
    uf: (data.uf as string) ?? null,
    processos_simultaneos: Number(data.processos_simultaneos ?? 0),
    created_at: String(data.created_at ?? ""),
    updated_at: String(data.updated_at ?? ""),
  }
}

function computeStats(leads: Lead[]): TrabalhistaStats {
  const scores = leads.map((l) => l.score).filter((s) => s > 0)
  return {
    total: leads.length,
    novos: leads.filter((l) => l.status === "novo").length,
    contatados: leads.filter((l) => l.status === "contatado").length,
    respondeu: leads.filter((l) => l.status === "respondeu").length,
    clientes: leads.filter((l) => l.status === "cliente").length,
    scoreMedio:
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0,
  }
}

export function filterLeads(leads: Lead[], filters: LeadFilters): Lead[] {
  return leads.filter((lead) => {
    if (filters.status !== "all" && lead.status !== filters.status) {
      return false
    }
    if (filters.comarca.trim()) {
      const q = filters.comarca.trim().toLowerCase()
      const hay = `${lead.comarca ?? ""} ${lead.vara ?? ""}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    const min = filters.valorMin ? parseFloat(filters.valorMin) : null
    const max = filters.valorMax ? parseFloat(filters.valorMax) : null
    const valor = lead.valor_causa ?? 0
    if (min != null && !Number.isNaN(min) && valor < min) return false
    if (max != null && !Number.isNaN(max) && valor > max) return false
    return true
  })
}

export async function fetchTrabalhistaDashboard(): Promise<{
  leads: Lead[]
  stats: TrabalhistaStats
}> {
  const leadsSnap = await getDocs(
    query(collection(db, "leads"), orderBy("score", "desc")),
  )
  const leads = leadsSnap.docs.map((d) =>
    mapLead(d.id, d.data() as Record<string, unknown>),
  )

  return { leads, stats: computeStats(leads) }
}

export async function updateLeadStatus(
  leadId: string,
  status: LeadStatus,
): Promise<void> {
  await updateDoc(doc(db, "leads", leadId), {
    status,
    updated_at: new Date().toISOString(),
  })
}
