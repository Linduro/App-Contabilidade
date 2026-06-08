export type MatchStatus = "novo" | "visto" | "inscrito" | "arquivado";

export type NivelExperiencia =
  | "iniciante"
  | "intermediario"
  | "avancado"
  | "especialista";

export interface Especialidade {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  palavras_chave: string[];
  ativo: boolean;
}

export interface AdvogadoEspecialidade {
  especialidade_id: string;
  nivel_experiencia: NivelExperiencia;
  especialidade: Especialidade;
}

export interface Advogado {
  id: string;
  nome: string;
  email: string;
  auth_user_id: string | null;
  ativo: boolean;
}

export interface Licitacao {
  id: string;
  numero_processo: string | null;
  orgao: string;
  modalidade: string | null;
  titulo: string;
  descricao: string | null;
  objeto: string | null;
  valor_estimado: number | null;
  data_publicacao: string | null;
  data_abertura: string | null;
  data_encerramento: string | null;
  url_fonte: string;
  fonte: string;
  uf: string | null;
  municipio: string | null;
  status: string;
  dados_brutos: Record<string, unknown> | null;
}

export interface Match {
  id: string;
  licitacao_id: string;
  advogado_id: string;
  especialidade_id: string;
  relevancia_score: number;
  motivo: string | null;
  status: MatchStatus;
  notificado: boolean;
  visto_em: string | null;
  inscrito_em: string | null;
  arquivado_em: string | null;
  created_at: string;
  licitacao: Licitacao;
  especialidade: Especialidade;
}

export interface MatchFilters {
  especialidadeId: string;
  valorMin: string;
  valorMax: string;
  cidade: string;
}

export interface DashboardStats {
  abertasMes: number;
  inscricoesMes: number;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  database: "connected" | "disconnected" | "not_configured";
}
