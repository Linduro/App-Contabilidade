-- Migration 002: advogados, notificações e relevancia_score
-- Execute após schema.sql inicial

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

CREATE INDEX IF NOT EXISTS idx_advogados_ativo ON advogados (ativo);
CREATE INDEX IF NOT EXISTS idx_advogados_email ON advogados (email);

CREATE TABLE IF NOT EXISTS advogados_especialidades (
  advogado_id       UUID NOT NULL REFERENCES advogados (id) ON DELETE CASCADE,
  especialidade_id  UUID NOT NULL REFERENCES especialidades_advogados (id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (advogado_id, especialidade_id)
);

CREATE INDEX IF NOT EXISTS idx_advogados_esp_especialidade
  ON advogados_especialidades (especialidade_id);

-- ---------------------------------------------------------------------------
-- Especialidades alinhadas ao classificador NLP
-- ---------------------------------------------------------------------------
INSERT INTO especialidades_advogados (nome, slug, descricao, palavras_chave) VALUES
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
  ),
  (
    'Direito Previdenciário',
    'security',
    'INSS, benefícios, perícias e aposentadoria.',
    ARRAY['inss', 'benefício', 'perícia', 'aposentadoria', 'previdenciário']
  )
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Atualiza matches: advogado + notificação + relevancia_score
-- ---------------------------------------------------------------------------
ALTER TABLE matches ADD COLUMN IF NOT EXISTS advogado_id UUID REFERENCES advogados (id) ON DELETE CASCADE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS notificado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS notificado_em TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'score'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matches' AND column_name = 'relevancia_score'
  ) THEN
    ALTER TABLE matches RENAME COLUMN score TO relevancia_score;
  END IF;
END $$;

ALTER TABLE matches ADD COLUMN IF NOT EXISTS relevancia_score NUMERIC(5, 4);

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_score_check;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_relevancia_score_check;
ALTER TABLE matches ADD CONSTRAINT matches_relevancia_score_check
  CHECK (relevancia_score >= 0 AND relevancia_score <= 1);

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_licitacao_especialidade_unique;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_licitacao_advogado_unique;
ALTER TABLE matches ADD CONSTRAINT matches_licitacao_advogado_unique
  UNIQUE (licitacao_id, advogado_id);

CREATE INDEX IF NOT EXISTS idx_matches_advogado ON matches (advogado_id);
CREATE INDEX IF NOT EXISTS idx_matches_notificado ON matches (notificado);

CREATE TRIGGER trg_advogados_updated_at
  BEFORE UPDATE ON advogados
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed de advogado demo (remova em produção)
INSERT INTO advogados (nome, email) VALUES
  ('Dr. João Silva', 'joao.silva@exemplo.com')
ON CONFLICT (email) DO NOTHING;

INSERT INTO advogados_especialidades (advogado_id, especialidade_id)
SELECT a.id, e.id
FROM advogados a
CROSS JOIN especialidades_advogados e
WHERE a.email = 'joao.silva@exemplo.com'
  AND e.slug IN ('administrativo', 'tributario', 'responsabilidade_civil')
ON CONFLICT DO NOTHING;
