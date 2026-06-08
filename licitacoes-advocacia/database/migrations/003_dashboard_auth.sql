-- Migration 003: Auth, status de matches e níveis de experiência
-- Execute após 002_collect_and_match.sql

ALTER TABLE advogados
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE;

ALTER TABLE advogados_especialidades
  ADD COLUMN IF NOT EXISTS nivel_experiencia VARCHAR(20) NOT NULL DEFAULT 'intermediario';

ALTER TABLE advogados_especialidades
  DROP CONSTRAINT IF EXISTS advogados_especialidades_nivel_check;

ALTER TABLE advogados_especialidades
  ADD CONSTRAINT advogados_especialidades_nivel_check
  CHECK (nivel_experiencia IN ('iniciante', 'intermediario', 'avancado', 'especialista'));

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'novo';

ALTER TABLE matches
  DROP CONSTRAINT IF EXISTS matches_status_check;

ALTER TABLE matches
  ADD CONSTRAINT matches_status_check
  CHECK (status IN ('novo', 'visto', 'inscrito', 'arquivado'));

ALTER TABLE matches ADD COLUMN IF NOT EXISTS visto_em TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS inscrito_em TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_matches_status ON matches (status);
CREATE INDEX IF NOT EXISTS idx_matches_advogado_status ON matches (advogado_id, status);

DROP TRIGGER IF EXISTS trg_matches_updated_at ON matches;
CREATE TRIGGER trg_matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security (frontend com anon key + Supabase Auth)
-- ---------------------------------------------------------------------------
ALTER TABLE advogados ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE advogados_especialidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE licitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE especialidades_advogados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS advogados_select_own ON advogados;
CREATE POLICY advogados_select_own ON advogados
  FOR SELECT USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS advogados_insert_own ON advogados;
CREATE POLICY advogados_insert_own ON advogados
  FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS advogados_update_own ON advogados;
CREATE POLICY advogados_update_own ON advogados
  FOR UPDATE USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS matches_select_own ON matches;
CREATE POLICY matches_select_own ON matches
  FOR SELECT USING (
    advogado_id IN (SELECT id FROM advogados WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS matches_update_own ON matches;
CREATE POLICY matches_update_own ON matches
  FOR UPDATE USING (
    advogado_id IN (SELECT id FROM advogados WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS adv_esp_select_own ON advogados_especialidades;
CREATE POLICY adv_esp_select_own ON advogados_especialidades
  FOR SELECT USING (
    advogado_id IN (SELECT id FROM advogados WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS licitacoes_select_matched ON licitacoes;
CREATE POLICY licitacoes_select_matched ON licitacoes
  FOR SELECT USING (
    id IN (
      SELECT m.licitacao_id
      FROM matches m
      INNER JOIN advogados a ON a.id = m.advogado_id
      WHERE a.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS especialidades_public_read ON especialidades_advogados;
CREATE POLICY especialidades_public_read ON especialidades_advogados
  FOR SELECT USING (true);

-- Vincula advogado demo ao auth (ajuste o e-mail após criar conta)
-- UPDATE advogados SET auth_user_id = 'uuid-do-auth-user' WHERE email = 'joao.silva@exemplo.com';
