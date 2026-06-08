import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { DEFAULT_TRABALHISTA_SETTINGS } from "@/lib/trabalhista-leads/seed-data"
import type {
  Lead,
  LeadFilters,
  LeadStatus,
  OutreachLogEntry,
  TrabalhistaSettings,
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
  logs: OutreachLogEntry[]
  stats: TrabalhistaStats
  settings: TrabalhistaSettings
}> {
  const settings = await fetchTrabalhistaSettings()
  const leadsSnap = await getDocs(
    query(collection(db, "leads"), orderBy("score", "desc")),
  )
  const leads = leadsSnap.docs.map((d) =>
    mapLead(d.id, d.data() as Record<string, unknown>),
  )

  const logsSnap = await getDocs(
    query(collection(db, "outreachLog"), orderBy("created_at", "desc")),
  )
  const logs: OutreachLogEntry[] = logsSnap.docs.slice(0, 50).map((d) => {
    const data = d.data()
    return {
      id: d.id,
      lead_id: String(data.lead_id ?? ""),
      dia: data.dia != null ? Number(data.dia) : null,
      tipo: String(data.tipo ?? ""),
      channels: (data.channels as string[]) ?? [],
      results: (data.results as Record<string, boolean>) ?? {},
      empresa: String(data.empresa ?? ""),
      processo: String(data.processo ?? ""),
      created_at: String(data.created_at ?? ""),
    }
  })

  return { leads, logs, stats: computeStats(leads), settings }
}

function mapSettings(data: Record<string, unknown>): TrabalhistaSettings {
  return {
    ...DEFAULT_TRABALHISTA_SETTINGS,
    ...(data as Partial<TrabalhistaSettings>),
    enabled: Boolean(data.enabled),
    collect_enabled: data.collect_enabled !== false,
    outreach_enabled: data.outreach_enabled !== false,
    datajud_days_back: Number(data.datajud_days_back ?? 7),
    datajud_page_size: Number(data.datajud_page_size ?? 50),
    smtp_port: Number(data.smtp_port ?? 587),
    min_score_for_outreach: Number(data.min_score_for_outreach ?? 40),
    updated_at: data.updated_at as string | undefined,
  }
}

export async function fetchTrabalhistaSettings(): Promise<TrabalhistaSettings> {
  const snap = await getDoc(doc(db, "trabalhistaConfig", "settings"))
  if (!snap.exists()) {
    return { ...DEFAULT_TRABALHISTA_SETTINGS }
  }
  return mapSettings(snap.data() as Record<string, unknown>)
}

export async function seedTrabalhistaConfig(): Promise<void> {
  const ref = doc(db, "trabalhistaConfig", "settings")
  const snap = await getDoc(ref)
  if (snap.exists()) return

  await setDoc(ref, {
    ...DEFAULT_TRABALHISTA_SETTINGS,
    updated_at: new Date().toISOString(),
  })
}

export async function saveTrabalhistaSettings(
  settings: TrabalhistaSettings,
): Promise<void> {
  await setDoc(doc(db, "trabalhistaConfig", "settings"), {
    ...settings,
    updated_at: new Date().toISOString(),
  })
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

export async function enqueueManualOutreach(leadId: string): Promise<void> {
  const now = new Date().toISOString()
  await addDoc(collection(db, "outreachQueue"), {
    lead_id: leadId,
    dia: null,
    tipo: "manual",
    channels: ["whatsapp", "email"],
    status: "pending",
    scheduled_at: now,
    created_at: now,
    updated_at: now,
  })
}

export async function fetchOutreachLogsForLead(
  leadId: string,
): Promise<OutreachLogEntry[]> {
  const snap = await getDocs(
    query(
      collection(db, "outreachLog"),
      where("lead_id", "==", leadId),
      orderBy("created_at", "desc"),
    ),
  )
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      lead_id: String(data.lead_id ?? ""),
      dia: data.dia != null ? Number(data.dia) : null,
      tipo: String(data.tipo ?? ""),
      channels: (data.channels as string[]) ?? [],
      results: (data.results as Record<string, boolean>) ?? {},
      empresa: String(data.empresa ?? ""),
      processo: String(data.processo ?? ""),
      created_at: String(data.created_at ?? ""),
    }
  })
}
