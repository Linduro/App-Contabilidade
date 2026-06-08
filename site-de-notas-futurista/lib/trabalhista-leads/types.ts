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
  classe_codigo: number | null
  classe_nome: string | null
  assuntos: string | null
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

export interface LeadFilters {
  comarca: string
  valorMin: string
  valorMax: string
  status: LeadStatus | "all"
  dataDe: string
  dataAte: string
  natureza: string
}

export interface TrabalhistaCollectParams {
  dataDe?: string
  dataAte?: string
  daysBack?: number
  natureza: string
  trts?: number[]
  pageSize?: number
}

export interface TrabalhistaStats {
  total: number
  novos: number
  contatados: number
  respondeu: number
  clientes: number
  scoreMedio: number
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

export const DEFAULT_LEAD_FILTERS: LeadFilters = {
  comarca: "",
  valorMin: "",
  valorMax: "",
  status: "all",
  dataDe: "",
  dataAte: "",
  natureza: "all",
}
