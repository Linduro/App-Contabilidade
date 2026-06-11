# ============================================================
# CAMADA 3 — Persistência
# db/models.py — Definição das tabelas SQLite
# ============================================================

import sqlite3
import os
import logging

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'afs_valuation.db')


def get_connection():
    """Retorna uma conexão com o banco SQLite."""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn
    except Exception as e:
        logger.error("[CAMADA 3][db][get_connection] %s", str(e))
        raise


def init_db():
    """Cria todas as tabelas se não existirem."""
    try:
        conn = get_connection()
        cursor = conn.cursor()

        # Configurações da aplicação (chaves de API, preferências)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Histórico de pesquisas realizadas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS searches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_description TEXT NOT NULL,
                search_query TEXT,
                search_results TEXT,
                source TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Avaliações realizadas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS evaluations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_description TEXT NOT NULL,
                methodology TEXT,
                value_new REAL,
                value_used REAL,
                value_fipe REAL,
                apparent_age INTEGER,
                conservation_state INTEGER,
                links TEXT,
                reasoning TEXT,
                photo_url TEXT,
                photo_spec TEXT,
                photo_tag TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Garantir colunas adicionais para resiliência de migração
        for col in ["photo_url", "photo_spec", "photo_tag"]:
            try:
                cursor.execute(f"ALTER TABLE evaluations ADD COLUMN {col} TEXT")
            except sqlite3.OperationalError:
                pass # coluna já existe


        # Feedback do usuário sobre avaliações
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS feedbacks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                evaluation_id INTEGER,
                user_comment TEXT,
                corrected_value REAL,
                accepted INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (evaluation_id) REFERENCES evaluations(id)
            )
        """)

        # Comparativos encontrados nas pesquisas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS comparatives (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_description TEXT NOT NULL,
                comparable_description TEXT,
                comparable_value REAL,
                comparable_link TEXT,
                source TEXT,
                currency TEXT DEFAULT 'BRL',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Mapeamento de colunas da planilha
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS column_mappings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                field_name TEXT NOT NULL,
                column_letter TEXT NOT NULL,
                column_index INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.commit()
        conn.close()
        logger.info("[CAMADA 3][db][init_db] Banco de dados inicializado com sucesso")
        return True
    except Exception as e:
        logger.error("[CAMADA 3][db][init_db] Erro ao inicializar banco: %s", str(e))
        return False
