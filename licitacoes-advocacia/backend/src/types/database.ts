export interface EspecialidadeAdvogado {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  palavras_chave: string[];
  ativo: boolean;
  created_at: string;
  updated_at: string;
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
  status: "aberta" | "encerrada" | "cancelada" | "suspensa" | "deserta";
  dados_brutos: Record<string, unknown> | null;
  hash_conteudo: string;
  scraped_at: string;
  created_at: string;
  updated_at: string;
}

export interface Advogado {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  licitacao_id: string;
  advogado_id: string | null;
  especialidade_id: string;
  relevancia_score: number;
  motivo: string | null;
  notificado: boolean;
  notificado_em: string | null;
  revisado: boolean;
  revisado_em: string | null;
  created_at: string;
}

export type LicitacaoInsert = Omit<
  Licitacao,
  "id" | "created_at" | "updated_at" | "scraped_at"
> & {
  scraped_at?: string;
};

export type MatchInsert = Omit<
  Match,
  "id" | "created_at" | "revisado" | "revisado_em" | "notificado" | "notificado_em"
> & {
  revisado?: boolean;
  notificado?: boolean;
};
