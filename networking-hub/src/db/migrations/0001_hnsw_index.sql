CREATE INDEX IF NOT EXISTS profiles_embedding_hnsw_idx
  ON profiles USING hnsw (embedding vector_cosine_ops);
