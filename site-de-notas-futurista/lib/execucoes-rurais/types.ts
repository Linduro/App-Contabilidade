export type ExecucaoStatus = "novo" | "contatado" | "respondeu" | "cliente"

export interface ContatoField {
  valor: string
  fonte: string
  confianca: number
}

export interface ExecucaoRural {
  id: string
  nome_reu: string
  cpf_cnpj: string | null
  tipo_reu: string
  processo: string
  numero_processo: string
  tribunal: string | null
  vara: string | null
  comarca: string | null
  valor_execucao: number | null
  credor_exequente: string | null
  data_ajuizamento: string | null
  tem_advogado: boolean
  area_hectares: number | null
  municipio_imovel: string | null
  score: number
  score_motivo: string | null
  status: ExecucaoStatus
  contatos: Record<string, ContatoField>
  enriquecimento_parcial: boolean
  created_at: string
}

export interface ExecucaoFilters {
  comarca: string
  valorMin: string
  valorMax: string
  status: ExecucaoStatus | "all"
}

export const EXECUCAO_STATUS_LABELS: Record<ExecucaoStatus, string> = {
  novo: "Novo",
  contatado: "Contatado",
  respondeu: "Respondeu",
  cliente: "Cliente",
}
