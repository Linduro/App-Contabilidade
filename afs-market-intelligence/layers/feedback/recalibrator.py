"""Camada 5 — Feedback loop e recalibração de scoring."""

import logging
from datetime import datetime

logger = logging.getLogger(__name__)

OUTCOME_WEIGHTS = {
    "positivo": 2.0,
    "reuniao": 3.0,
    "negativo": -1.5,
    "sem_resposta": -0.3,
    "indicacao_b2b2b": 2.5,
}


class FeedbackRecalibrator:
    """Retroalimentação comercial → ajuste de cluster e scoring."""

    def __init__(self, conn):
        self.conn = conn

    def registrar(self, lead_id: int, outcome: str, motivo: str = "", canal: str = "", registrado_por: str = "") -> dict:
        self.conn.execute(
            """INSERT INTO feedback_comercial (lead_id, outcome, motivo, canal, registrado_por)
               VALUES (?, ?, ?, ?, ?)""",
            [lead_id, outcome, motivo, canal, registrado_por],
        )
        self.conn.commit()
        self.recalibrar_lead(lead_id, outcome)
        return {"status": "ok", "lead_id": lead_id, "outcome": outcome}

    def recalibrar_lead(self, lead_id: int, outcome: str):
        delta = OUTCOME_WEIGHTS.get(outcome, 0)
        self.conn.execute(
            "UPDATE leads_icp SET score_prioridade = score_prioridade + ?, updated_at = ? WHERE id = ?",
            [delta, datetime.now().isoformat(), lead_id],
        )
        self.conn.commit()

    def recalibrar_global(self, perfil: str = "patrimonial") -> dict:
        """Recalibração semanal por cluster × CNAE × fonte."""
        rows = self.conn.execute(
            """SELECT l.cluster_estrategico, f.outcome, COUNT(*) as cnt
               FROM feedback_comercial f
               JOIN leads_icp l ON l.id = f.lead_id
               WHERE l.perfil_uso = ?
               GROUP BY l.cluster_estrategico, f.outcome""",
            [perfil],
        ).fetchall()

        ajustes = []
        for cluster, outcome, cnt in rows:
            peso = OUTCOME_WEIGHTS.get(outcome, 0) * (cnt / 10)
            self.conn.execute(
                """INSERT INTO scoring_weights (perfil_uso, dimensao, valor, peso, updated_at)
                   VALUES (?, 'cluster', ?, ?, ?)""",
                [perfil, cluster, peso, datetime.now().isoformat()],
            )
            ajustes.append({"cluster": cluster, "outcome": outcome, "peso": peso})

            self.conn.execute(
                """UPDATE leads_icp SET score_prioridade = score_prioridade + ?
                   WHERE cluster_estrategico = ? AND perfil_uso = ?""",
                [peso * 0.1, cluster, perfil],
            )

        self.conn.commit()
        return {"status": "ok", "ajustes": len(ajustes), "detalhes": ajustes}

    def metricas_funil(self, perfil: str = "patrimonial") -> dict:
        total = self.conn.execute(
            "SELECT COUNT(*) FROM leads_icp WHERE perfil_uso = ?", [perfil]
        ).fetchone()[0]
        enriquecidos = self.conn.execute(
            """SELECT COUNT(DISTINCT lead_id) FROM decisores d
               JOIN leads_icp l ON l.id = d.lead_id WHERE l.perfil_uso = ?""",
            [perfil],
        ).fetchone()[0]
        validados = self.conn.execute(
            """SELECT COUNT(*) FROM emails_validados e
               JOIN decisores d ON d.id = e.decisor_id
               JOIN leads_icp l ON l.id = d.lead_id
               WHERE e.status IN ('validado_alta','validado_media') AND l.perfil_uso = ?""",
            [perfil],
        ).fetchone()[0]
        dead_zone = self.conn.execute(
            """SELECT COUNT(*) FROM dead_zone dz JOIN leads_icp l ON l.id = dz.lead_id WHERE l.perfil_uso = ?""",
            [perfil],
        ).fetchone()[0]
        feedback = self.conn.execute(
            """SELECT outcome, COUNT(*) FROM feedback_comercial f
               JOIN leads_icp l ON l.id = f.lead_id WHERE l.perfil_uso = ?
               GROUP BY outcome""",
            [perfil],
        ).fetchall()

        return {
            "universo_icp": total,
            "enriquecidos": enriquecidos,
            "emails_validados": validados,
            "dead_zone": dead_zone,
            "feedback": {o: c for o, c in feedback},
        }
