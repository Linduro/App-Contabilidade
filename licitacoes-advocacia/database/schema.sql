-- =============================================================================
-- Schema: licitacoes-advocacia
-- Execute no SQL Editor do Supabase ou via psql
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Especialidades jurídicas que advogados podem prestar
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS especialidades_advogados (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          VARCHAR(150) NOT NULL UNIQUE,
  slug          VARCHAR(150) NOT NULL UNIQUE,
  descricao     TEXT,
  palavras_chave TEXT[] NOT NULL DEFAULT '{}',
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_especialidades_ativo ON especialidades_advogados (ativo);
CREATE INDEX IF NOT EXISTS idx_especialidades_palavras_chave ON especialidades_advogados USING GIN (palavras_chave);

-- ---------------------------------------------------------------------------
-- Licitações públicas coletadas via scraping
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS licitacoes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_processo     VARCHAR(100),
  orgao               VARCHAR(255) NOT NULL,
  modalidade          VARCHAR(100),
  titulo              TEXT NOT NULL,
  descricao           TEXT,
  objeto              TEXT,
  valor_estimado      NUMERIC(15, 2),
  data_publicacao     TIMESTAMPTZ,
  data_abertura       TIMESTAMPTZ,
  data_encerramento   TIMESTAMPTZ,
  url_fonte           TEXT NOT NULL,
  fonte               VARCHAR(100) NOT NULL,
  uf                  CHAR(2),
  municipio           VARCHAR(150),
  status              VARCHAR(50) NOT NULL DEFAULT 'aberta',
  dados_brutos        JSONB,
  hash_conteudo       VARCHAR(64) NOT NULL UNIQUE,
  scraped_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT licitacoes_status_check CHECK (
    status IN ('aberta', 'encerrada', 'cancelada', 'suspensa', 'deserta')
  )
);

CREATE INDEX IF NOT EXISTS idx_licitacoes_fonte ON licitacoes (fonte);
CREATE INDEX IF NOT EXISTS idx_licitacoes_status ON licitacoes (status);
CREATE INDEX IF NOT EXISTS idx_licitacoes_data_publicacao ON licitacoes (data_publicacao DESC);
CREATE INDEX IF NOT EXISTS idx_licitacoes_uf ON licitacoes (uf);
CREATE INDEX IF NOT EXISTS idx_licitacoes_dados_brutos ON licitacoes USING GIN (dados_brutos);

-- ---------------------------------------------------------------------------
-- Advogados cadastrados para receber alertas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS advogados (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS advogados_especialidades (
  advogado_id       UUID NOT NULL REFERENCES advogados (id) ON DELETE CASCADE,
  especialidade_id  UUID NOT NULL REFERENCES especialidades_advogados (id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (advogado_id, especialidade_id)
);

-- ---------------------------------------------------------------------------
-- Matches: licitação ↔ advogado (classificador NLP)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matches (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  licitacao_id      UUID NOT NULL REFERENCES licitacoes (id) ON DELETE CASCADE,
  advogado_id       UUID NOT NULL REFERENCES advogados (id) ON DELETE CASCADE,
  especialidade_id  UUID NOT NULL REFERENCES especialidades_advogados (id) ON DELETE CASCADE,
  relevancia_score  NUMERIC(5, 4) NOT NULL,
  motivo            TEXT,
  notificado        BOOLEAN NOT NULL DEFAULT FALSE,
  notificado_em     TIMESTAMPTZ,
  revisado          BOOLEAN NOT NULL DEFAULT FALSE,
  revisado_em       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT matches_relevancia_score_check CHECK (relevancia_score >= 0 AND relevancia_score <= 1),
  CONSTRAINT matches_licitacao_advogado_unique UNIQUE (licitacao_id, advogado_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_licitacao ON matches (licitacao_id);
CREATE INDEX IF NOT EXISTS idx_matches_especialidade ON matches (especialidade_id);
CREATE INDEX IF NOT EXISTS idx_matches_advogado ON matches (advogado_id);
CREATE INDEX IF NOT EXISTS idx_matches_notificado ON matches (notificado);
CREATE INDEX IF NOT EXISTS idx_matches_revisado ON matches (revisado);

-- ---------------------------------------------------------------------------
-- Trigger: updated_at automático
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_advogados_updated_at
  BEFORE UPDATE ON advogados
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_especialidades_updated_at
  BEFORE UPDATE ON especialidades_advogados
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_licitacoes_updated_at
  BEFORE UPDATE ON licitacoes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed: especialidades iniciais
-- ---------------------------------------------------------------------------
INSERT INTO especialidades_advogados (nome, slug, descricao, palavras_chave) VALUES
  (
    'Consultoria Jurídica',
    'consultoria-juridica',
    'Assessoria e consultoria em direito administrativo, contratos e compliance.',
    ARRAY['consultoria jurídica', 'assessoria jurídica', 'parecer jurídico', 'consultoria legal']
  ),
  (
    'Advocacia Contenciosa',
    'advocacia-contenciosa',
    'Representação judicial e extrajudicial em processos administrativos e cíveis.',
    ARRAY['advocacia', 'contencioso', 'representação judicial', 'defesa jurídica']
  ),
  (
    'Pareceres e Due Diligence',
    'pareceres-due-diligence',
    'Elaboração de pareceres técnicos-jurídicos e due diligence.',
    ARRAY['parecer', 'due diligence', 'análise jurídica', 'parecer técnico']
  ),
  (
    'Mediação e Arbitragem',
    'mediacao-arbitragem',
    'Serviços de mediação, conciliação e arbitragem.',
    ARRAY['mediação', 'arbitragem', 'conciliação', 'câmara arbitral']
  ),
  (
    'Direito Previdenciário',
    'security',
    'INSS, benefícios, perícias e aposentadoria.',
    ARRAY['inss', 'benefício', 'perícia', 'aposentadoria', 'previdenciário']
  ),
  (
    'Responsabilidade Civil',
    'responsabilidade_civil',
    'Indenizações, danos morais/materiais e sinistros.',
    ARRAY['indenização', 'danos', 'sinistro', 'responsabilidade civil']
  ),
  (
    'Direito Bancário',
    'banking_law',
    'Contratos bancários, crédito e hipoteca.',
    ARRAY['banco', 'financeira', 'crédito', 'hipoteca']
  ),
  (
    'Direito Tributário',
    'tributario',
    'Impostos, declarações e consultoria fiscal.',
    ARRAY['imposto', 'icms', 'iss', 'declaração', 'tributário']
  ),
  (
    'Direito Administrativo',
    'administrativo',
    'Contratos públicos, editais e licitações.',
    ARRAY['contrato', 'edital', 'licitação', 'administrativo']
  )
ON CONFLICT (slug) DO NOTHING;
