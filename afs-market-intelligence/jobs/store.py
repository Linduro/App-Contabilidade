"""Persistência de jobs assíncronos."""

import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class JobStore:
    def __init__(self, conn):
        self.conn = conn
        self._ensure_table()

    def _ensure_table(self):
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS async_jobs (
                id INTEGER PRIMARY KEY,
                tipo VARCHAR NOT NULL,
                status VARCHAR DEFAULT 'queued',
                progress INTEGER DEFAULT 0,
                message VARCHAR,
                params JSON,
                result JSON,
                error TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        if hasattr(self.conn, "commit"):
            self.conn.commit()

    def create(self, tipo: str, params: dict | None = None) -> int:
        row = self.conn.execute(
            """INSERT INTO async_jobs (tipo, status, params) VALUES (?, 'queued', ?) RETURNING id""",
            [tipo, json.dumps(params or {})],
        ).fetchone()
        if hasattr(self.conn, "commit"):
            self.conn.commit()
        return row[0]

    def update(self, job_id: int, status: str = None, progress: int = None, message: str = None,
               result: dict = None, error: str = None):
        parts, vals = [], []
        if status:
            parts.append("status = ?"); vals.append(status)
        if progress is not None:
            parts.append("progress = ?"); vals.append(progress)
        if message:
            parts.append("message = ?"); vals.append(message)
        if result is not None:
            parts.append("result = ?"); vals.append(json.dumps(result))
        if error:
            parts.append("error = ?"); vals.append(error)
        parts.append("updated_at = ?"); vals.append(datetime.now().isoformat())
        vals.append(job_id)
        self.conn.execute(f"UPDATE async_jobs SET {', '.join(parts)} WHERE id = ?", vals)
        if hasattr(self.conn, "commit"):
            self.conn.commit()

    def get(self, job_id: int) -> dict | None:
        row = self.conn.execute("SELECT * FROM async_jobs WHERE id = ?", [job_id]).fetchone()
        if not row:
            return None
        cols = ["id", "tipo", "status", "progress", "message", "params", "result", "error", "created_at", "updated_at"]
        d = dict(zip(cols, row))
        for k in ("params", "result"):
            if d.get(k) and isinstance(d[k], str):
                try:
                    d[k] = json.loads(d[k])
                except json.JSONDecodeError:
                    pass
        return d

    def list_recent(self, limite: int = 20) -> list[dict]:
        rows = self.conn.execute(
            "SELECT id, tipo, status, progress, message, created_at, updated_at FROM async_jobs ORDER BY id DESC LIMIT ?",
            [limite],
        ).fetchall()
        cols = ["id", "tipo", "status", "progress", "message", "created_at", "updated_at"]
        return [dict(zip(cols, r)) for r in rows]
