-- Execute antes das migrations Drizzle (pgvector + extensões)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Após criar a tabela profiles (migration Drizzle), rode:
-- CREATE INDEX IF NOT EXISTS profiles_embedding_hnsw_idx
--   ON profiles USING hnsw (embedding vector_cosine_ops);
