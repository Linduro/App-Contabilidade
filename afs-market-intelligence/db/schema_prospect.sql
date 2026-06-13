-- Extensão do schema — base de prospecção RF (230k+ Lucro Real)

CREATE TABLE IF NOT EXISTS prospectos_rf (
    id INTEGER PRIMARY KEY,
    cnpj_basico VARCHAR UNIQUE NOT NULL,
    cnpj_matriz VARCHAR,
    razao_social VARCHAR,
    nome_fantasia VARCHAR,
    capital_social DOUBLE,
    porte VARCHAR,
    natureza_juridica VARCHAR,
    regime_proxy VARCHAR DEFAULT 'LR',
    cluster_estrategico VARCHAR,
    cnae_principal VARCHAR,
    cnae_principal_descricao VARCHAR,
    cnaes_secundarios TEXT,
    email_matriz VARCHAR,
    telefone_matriz VARCHAR,
    endereco_matriz TEXT,
    uf VARCHAR,
    municipio_codigo VARCHAR,
    municipio_nome VARCHAR,
    cep VARCHAR,
    qtd_estabelecimentos INTEGER DEFAULT 0,
    qtd_socios INTEGER DEFAULT 0,
    socios_chave TEXT,
    emails_encontrados TEXT,
    score_prioridade DOUBLE DEFAULT 0,
    snapshot_id INTEGER,
    perfil_uso VARCHAR DEFAULT 'patrimonial',
    status_funil VARCHAR DEFAULT 'prospectado',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS estabelecimentos_rf (
    id INTEGER PRIMARY KEY,
    cnpj_completo VARCHAR UNIQUE,
    cnpj_basico VARCHAR,
    matriz_filial VARCHAR,
    nome_fantasia VARCHAR,
    situacao_cadastral VARCHAR,
    cnae_fiscal VARCHAR,
    cnae_descricao VARCHAR,
    cnae_secundario TEXT,
    tipo_logradouro VARCHAR,
    logradouro VARCHAR,
    numero VARCHAR,
    complemento VARCHAR,
    bairro VARCHAR,
    cep VARCHAR,
    uf VARCHAR,
    municipio_codigo VARCHAR,
    municipio_nome VARCHAR,
    telefone VARCHAR,
    email VARCHAR,
    endereco_completo TEXT,
    data_inicio VARCHAR
);

CREATE TABLE IF NOT EXISTS socios_rf (
    id INTEGER PRIMARY KEY,
    cnpj_basico VARCHAR,
    nome_socio VARCHAR,
    cpf_cnpj_socio VARCHAR,
    qualificacao_codigo VARCHAR,
    qualificacao_descricao VARCHAR,
    data_entrada VARCHAR,
    is_pessoa_chave BOOLEAN DEFAULT FALSE,
    UNIQUE(cnpj_basico, nome_socio, qualificacao_codigo)
);

CREATE TABLE IF NOT EXISTS async_jobs (
    id INTEGER PRIMARY KEY,
    tipo VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'queued',
    progress INTEGER DEFAULT 0,
    message VARCHAR,
    params TEXT,
    result TEXT,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prospectos_cnpj ON prospectos_rf(cnpj_basico);
CREATE INDEX IF NOT EXISTS idx_prospectos_uf ON prospectos_rf(uf);
CREATE INDEX IF NOT EXISTS idx_prospectos_cluster ON prospectos_rf(cluster_estrategico);
CREATE INDEX IF NOT EXISTS idx_prospectos_score ON prospectos_rf(score_prioridade DESC);
CREATE INDEX IF NOT EXISTS idx_estab_cnpj_basico ON estabelecimentos_rf(cnpj_basico);
CREATE INDEX IF NOT EXISTS idx_socios_cnpj_basico ON socios_rf(cnpj_basico);
