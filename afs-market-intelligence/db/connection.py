"""Conexão DuckDB/SQLite em disco — evita estouro de RAM."""

import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent.parent
DB_ENGINE = os.environ.get("DB_ENGINE", "duckdb")
DB_PATH = os.environ.get("DB_PATH", str(ROOT / "data" / "afs_market.duckdb"))


def get_connection():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    if DB_ENGINE == "duckdb":
        import duckdb
        conn = duckdb.connect(DB_PATH)
    else:
        import sqlite3
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
    return conn


def init_db():
    schema_path = ROOT / "db" / "schema.sql"
    prospect_path = ROOT / "db" / "schema_prospect.sql"
    conn = get_connection()
    try:
        for path in (schema_path, prospect_path):
            if not path.exists():
                continue
            sql = path.read_text(encoding="utf-8")
            for stmt in sql.split(";"):
                stmt = stmt.strip()
                if stmt:
                    try:
                        conn.execute(stmt)
                    except Exception as e:
                        logger.debug("[db] stmt skipped: %s", e)
        if hasattr(conn, "commit"):
            conn.commit()
        logger.info("[db] Schema inicializado em %s (%s)", DB_PATH, DB_ENGINE)
    finally:
        conn.close()


def execute_query(sql: str, params=None):
    conn = get_connection()
    try:
        if params:
            result = conn.execute(sql, params)
        else:
            result = conn.execute(sql)
        if sql.strip().upper().startswith("SELECT"):
            return result.fetchall()
        conn.commit()
        return result
    finally:
        conn.close()
