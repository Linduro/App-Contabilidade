CREATE EXTENSION IF NOT EXISTS vector;

DO $$ BEGIN
  CREATE TYPE connection_status AS ENUM ('pendente', 'aceita', 'ignorada');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expertises_catalog (
  id uuid PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  categoria text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  turma text,
  cargo_atual text,
  empresa text,
  area_atuacao text[] NOT NULL DEFAULT '{}',
  expertises text[] NOT NULL DEFAULT '{}',
  o_que_ofeco text,
  o_que_busco text,
  linkedin_url text,
  disponivel_mentoria boolean NOT NULL DEFAULT false,
  bio text,
  avatar_url text,
  wallet_address text,
  embedding vector(1536),
  embedding_gerado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON profiles(user_id);

CREATE TABLE IF NOT EXISTS connections (
  id uuid PRIMARY KEY,
  profile_a_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  profile_b_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status connection_status NOT NULL DEFAULT 'pendente',
  similarity_score real NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS connections_pair_unique ON connections(profile_a_id, profile_b_id);

CREATE TABLE IF NOT EXISTS match_results (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  matched_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score real NOT NULL,
  breakdown jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS match_results_pair_unique ON match_results(profile_id, matched_profile_id);
