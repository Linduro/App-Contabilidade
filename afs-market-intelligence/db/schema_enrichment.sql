-- Enriquecimento de contatos, cache de APIs, opt-out LGPD, geolocalização

CREATE TABLE IF NOT EXISTS contatos (
    id INTEGER PRIMARY KEY,
    cnpj_basico VARCHAR NOT NULL,
    tipo VARCHAR NOT NULL,
    valor VARCHAR NOT NULL,
    fonte VARCHAR NOT NULL,
    confianca VARCHAR DEFAULT 'media',
    entregavel BOOLEAN,
    data_coleta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    origem_url VARCHAR,
    snapshot_rf VARCHAR,
    suprimido BOOLEAN DEFAULT FALSE,
    UNIQUE(cnpj_basico, tipo, valor, fonte)
);

CREATE TABLE IF NOT EXISTS cnpj_opt_out (
    cnpj_basico VARCHAR PRIMARY KEY,
    motivo VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cnpj_api_cache (
    cnpj_completo VARCHAR PRIMARY KEY,
    provider VARCHAR NOT NULL,
    payload TEXT,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS geo_municipios (
    ibge_codigo VARCHAR PRIMARY KEY,
    nome VARCHAR,
    uf VARCHAR,
    lat DOUBLE,
    lng DOUBLE,
    fonte VARCHAR DEFAULT 'IBGE',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contatos_cnpj ON contatos(cnpj_basico);
CREATE INDEX IF NOT EXISTS idx_contatos_tipo ON contatos(cnpj_basico, tipo);

CREATE TABLE IF NOT EXISTS social_leads (
    id VARCHAR PRIMARY KEY,
    fonte VARCHAR NOT NULL,
    plataforma VARCHAR NOT NULL,
    nome VARCHAR,
    cargo VARCHAR,
    empresa VARCHAR,
    username VARCHAR,
    url VARCHAR,
    seguidores INTEGER,
    bio TEXT,
    payload TEXT,
    coletado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_social_fonte ON social_leads(fonte, plataforma);
