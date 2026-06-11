-- AFS Market Intelligence — Schema DuckDB/SQLite

CREATE TABLE IF NOT EXISTS rf_snapshots (
    id INTEGER PRIMARY KEY,
    versao VARCHAR NOT NULL,
    data_referencia DATE NOT NULL,
    checksum VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS empresas (
    cnpj_basico VARCHAR PRIMARY KEY,
    razao_social VARCHAR,
    capital_social DOUBLE,
    porte VARCHAR,
    natureza_juridica VARCHAR,
    snapshot_id INTEGER REFERENCES rf_snapshots(id)
);

CREATE TABLE IF NOT EXISTS estabelecimentos (
    cnpj_completo VARCHAR PRIMARY KEY,
    cnpj_basico VARCHAR,
    matriz_filial VARCHAR,
    cnae_fiscal VARCHAR,
    uf VARCHAR,
    municipio VARCHAR,
    situacao_cadastral VARCHAR,
    telefone VARCHAR,
    email VARCHAR,
    logradouro VARCHAR,
    numero VARCHAR,
    bairro VARCHAR,
    cep VARCHAR,
    snapshot_id INTEGER
);

CREATE TABLE IF NOT EXISTS leads_icp (
    id INTEGER PRIMARY KEY,
    cnpj_basico VARCHAR UNIQUE,
    razao_social VARCHAR,
    cluster_estrategico VARCHAR,
    capital_social DOUBLE,
    qtd_filiais INTEGER,
    score_prioridade DOUBLE DEFAULT 0,
    perfil_uso VARCHAR DEFAULT 'patrimonial',
    transicao_regime BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS decisores (
    id INTEGER PRIMARY KEY,
    lead_id INTEGER REFERENCES leads_icp(id),
    nome VARCHAR,
    cargo VARCHAR,
    email VARCHAR,
    linkedin_url VARCHAR,
    fonte VARCHAR,
    score_confianca DOUBLE DEFAULT 0,
    linkedin_modo VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS emails_validados (
    id INTEGER PRIMARY KEY,
    decisor_id INTEGER REFERENCES decisores(id),
    email VARCHAR,
    status VARCHAR,
    mx_valido BOOLEAN,
    smtp_status VARCHAR,
    catch_all BOOLEAN DEFAULT FALSE,
    validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dead_zone (
    id INTEGER PRIMARY KEY,
    lead_id INTEGER REFERENCES leads_icp(id),
    motivo VARCHAR,
    rota_recomendada VARCHAR,
    linkedin_url VARCHAR,
    telefone_matriz VARCHAR,
    endereco_completo VARCHAR,
    prioridade INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback_comercial (
    id INTEGER PRIMARY KEY,
    lead_id INTEGER REFERENCES leads_icp(id),
    outcome VARCHAR,
    motivo VARCHAR,
    canal VARCHAR,
    registrado_por VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scoring_weights (
    id INTEGER PRIMARY KEY,
    perfil_uso VARCHAR,
    dimensao VARCHAR,
    valor VARCHAR,
    peso DOUBLE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS regime_transicoes (
    id INTEGER PRIMARY KEY,
    cnpj_basico VARCHAR,
    regime_anterior VARCHAR,
    regime_novo VARCHAR,
    snapshot_de INTEGER,
    snapshot_para INTEGER,
    detectado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    lead_quente BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS parceiros_auditoria (
    id INTEGER PRIMARY KEY,
    nome VARCHAR,
    rede VARCHAR,
    uf_sede VARCHAR,
    website VARCHAR,
    contato_parceria VARCHAR,
    status_parceria VARCHAR DEFAULT 'prospect',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
    id INTEGER PRIMARY KEY,
    perfil_uso VARCHAR,
    etapa VARCHAR,
    status VARCHAR,
    registros_processados INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    erro TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_cluster ON leads_icp(cluster_estrategico);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads_icp(score_prioridade DESC);
CREATE INDEX IF NOT EXISTS idx_decisores_lead ON decisores(lead_id);
CREATE INDEX IF NOT EXISTS idx_transicao_cnpj ON regime_transicoes(cnpj_basico);
