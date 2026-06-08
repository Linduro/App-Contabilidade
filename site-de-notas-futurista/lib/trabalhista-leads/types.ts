export type LeadStatus = "novo" | "contatado" | "respondeu" | "cliente"

export interface Lead {
  id: string
  empresa: string
  cnpj: string | null
  numero_processo: string
  numero_processo_formatado: string | null
  vara: string | null
  comarca: string | null
  tribunal: string | null
  valor_causa: number | null
  data_ajuizamento: string | null
  responsavel: string | null
  telefone: string | null
  email: string | null
  score: number
  score_motivo: string | null
  status: LeadStatus
  setor: string | null
  municipio: string | null
  uf: string | null
  processos_simultaneos: number
  created_at: string
  updated_at: string
}

export interface OutreachLogEntry {
  id: string
  lead_id: string
  dia: number | null
  tipo: string
  channels: string[]
  results: Record<string, boolean>
  empresa: string
  processo: string
  created_at: string
}

export interface LeadFilters {
  comarca: string
  valorMin: string
  valorMax: string
  status: LeadStatus | "all"
}

export interface TrabalhistaStats {
  total: number
  novos: number
  contatados: number
  respondeu: number
  clientes: number
  scoreMedio: number
}

export interface TrabalhistaSettings {
  enabled: boolean
  collect_enabled: boolean
  outreach_enabled: boolean
  datajud_api_key: string
  datajud_trts: string
  datajud_days_back: number
  datajud_page_size: number
  evolution_api_url: string
  evolution_api_key: string
  evolution_instance: string
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_pass: string
  smtp_from: string
  whatsapp_template: string
  email_subject: string
  email_template: string
  min_score_for_outreach: number
  updated_at?: string
}

export const LEAD_STATUSES: LeadStatus[] = [
  "novo",
  "contatado",
  "respondeu",
  "cliente",
]

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  novo: "Novo",
  contatado: "Contatado",
  respondeu: "Respondeu",
  cliente: "Cliente",
}
