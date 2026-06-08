export type ExecucaoAltoValorStatus = "novo" | "contatado" | "respondeu" | "cliente"

export interface ContatoField {
  valor: string
  fonte: string
  confianca: number
}

export interface ExecucaoAltoValor {
  id: string
  processo: string
  numeroProcesso: string
  tribunal: string | null
  vara: string | null
  comarca: string | null
  valorCausa: number
  exequente: string | null
  executado: string
  cnpjCpf: string
  tipoExecutado: "PF" | "PJ"
  dataAjuizamento: string | null
  ultimoMovimento: string | null
  temAdvogado: boolean
  contatos: Record<string, ContatoField>
  score: number
  scoreMotivo: string | null
  status: ExecucaoAltoValorStatus
  criadoEm: string
}

export interface AltoValorFilters {
  comarca: string
  status: ExecucaoAltoValorStatus | "all"
  dataDe: string
  dataAte: string
}

export interface AltoValorCollectParams {
  dataDe?: string
  dataAte?: string
  daysBack?: number
}

export const ALTO_VALOR_STATUS_LABELS: Record<ExecucaoAltoValorStatus, string> = {
  novo: "Novo",
  contatado: "Contatado",
  respondeu: "Respondeu",
  cliente: "Cliente",
}

export const DEFAULT_ALTO_VALOR_FILTERS: AltoValorFilters = {
  comarca: "",
  status: "all",
  dataDe: "",
  dataAte: "",
}
