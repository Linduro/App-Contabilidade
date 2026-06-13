"""Fila de raspagem comercial — enriquecimento online rate-limited."""

import logging
import os
import time
import random

logger = logging.getLogger(__name__)

DELAY_MIN = float(os.environ.get("SCRAPING_DELAY_MIN", "3"))
DELAY_MAX = float(os.environ.get("SCRAPING_DELAY_MAX", "8"))


class ScrapingQueueWorker:
    """Processa fila de CNPJs para enriquecimento web."""

    def __init__(self, conn, on_progress=None):
        self.conn = conn
        self.on_progress = on_progress or (lambda msg, pct: None)
        self._ensure_queue()

    def _ensure_queue(self):
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS scraping_queue (
                id INTEGER PRIMARY KEY,
                lead_id INTEGER,
                cnpj_basico VARCHAR,
                razao_social VARCHAR,
                status VARCHAR DEFAULT 'pending',
                prioridade DOUBLE DEFAULT 0,
                tentativas INTEGER DEFAULT 0,
                ultimo_erro TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed_at TIMESTAMP
            )
        """)
        if hasattr(self.conn, "commit"):
            self.conn.commit()

    def enfileirar_icp(self, limite: int = 1000) -> dict:
        """Enfileira leads ICP ainda não enriquecidos."""
        rows = self.conn.execute("""
            SELECT l.id, l.cnpj_basico, l.razao_social, l.score_prioridade
            FROM leads_icp l
            WHERE l.id NOT IN (SELECT DISTINCT lead_id FROM decisores WHERE lead_id IS NOT NULL)
              AND l.id NOT IN (SELECT lead_id FROM scraping_queue WHERE lead_id IS NOT NULL AND status = 'pending')
            ORDER BY l.score_prioridade DESC
            LIMIT ?
        """, [limite]).fetchall()

        for lead_id, cnpj, razao, score in rows:
            self.conn.execute(
                """INSERT INTO scraping_queue (lead_id, cnpj_basico, razao_social, prioridade)
                   VALUES (?, ?, ?, ?)""",
                [lead_id, cnpj, razao, score or 0],
            )
        if hasattr(self.conn, "commit"):
            self.conn.commit()
        return {"status": "ok", "enfileirados": len(rows)}

    def status_fila(self) -> dict:
        rows = self.conn.execute("""
            SELECT status, COUNT(*) FROM scraping_queue GROUP BY status
        """).fetchall()
        return {"fila": {r[0]: r[1] for r in rows}}

    def processar_lote(self, limite: int = 10) -> dict:
        from layers.enrichment.contato_cascade import enriquecer_contato

        pendentes = self.conn.execute("""
            SELECT id, cnpj_basico, razao_social FROM scraping_queue
            WHERE status = 'pending' ORDER BY prioridade DESC LIMIT ?
        """, [limite]).fetchall()

        ok, err = 0, 0

        for qid, cnpj_basico, razao in pendentes:
            self.conn.execute("UPDATE scraping_queue SET status = 'processing' WHERE id = ?", [qid])
            try:
                time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))
                if not cnpj_basico:
                    raise ValueError("cnpj_basico ausente na fila")
                result = enriquecer_contato(self.conn, cnpj_basico)
                self.conn.execute(
                    "UPDATE scraping_queue SET status = 'done', processed_at = CURRENT_TIMESTAMP WHERE id = ?",
                    [qid],
                )
                ok += 1
                n = result.get("total", 0)
                self.on_progress(f"Enriquecido: {razao[:40]}… ({n} contatos)", int(ok / max(len(pendentes), 1) * 100))
            except Exception as e:
                logger.warning("[queue] erro %s: %s", cnpj_basico, e)
                self.conn.execute(
                    "UPDATE scraping_queue SET status = 'error', tentativas = tentativas + 1, ultimo_erro = ? WHERE id = ?",
                    [str(e), qid],
                )
                err += 1

        if hasattr(self.conn, "commit"):
            self.conn.commit()
        return {"status": "ok", "processados": ok, "erros": err}
