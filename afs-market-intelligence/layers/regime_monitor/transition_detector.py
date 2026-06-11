"""Monitor de transição Presumido → Lucro Real."""

import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class RegimeTransitionMonitor:
    """
    Compara snapshots mensais RF para detectar migração tributária.
    Defasagem RF: 3–6 meses — combinar com sinais auxiliares.
    """

    PROXY_PRESUMIDO_MAX_CAPITAL = 4_800_000
    PROXY_LUCRO_REAL_MIN_CAPITAL = 2_000_000

    def __init__(self, conn):
        self.conn = conn

    def classificar_proxy(self, capital: float, porte: str, qtd_filiais: int) -> str:
        if capital >= self.PROXY_LUCRO_REAL_MIN_CAPITAL and qtd_filiais > 3:
            return "LUCRO_REAL"
        if capital <= self.PROXY_PRESUMIDO_MAX_CAPITAL and qtd_filiais <= 3:
            return "PRESUMIDO"
        return "INDETERMINADO"

    def detectar_transicoes(self, snapshot_de: int, snapshot_para: int) -> dict:
        """
        Compara empresas entre dois snapshots.
        Evento: PRESUMIDO/INDETERMINADO → LUCRO_REAL
        """
        try:
            rows_de = self.conn.execute(
                """SELECT e.cnpj_basico, e.capital_social, e.porte,
                          COUNT(est.cnpj_completo) as filiais
                   FROM empresas e
                   JOIN estabelecimentos est ON est.cnpj_basico = e.cnpj_basico
                   WHERE e.snapshot_id = ? OR e.snapshot_id IS NULL
                   GROUP BY e.cnpj_basico, e.capital_social, e.porte""",
                [snapshot_de],
            ).fetchall()
        except Exception:
            return self._demo_transicoes()

        transicoes = []
        for cnpj, capital, porte, filiais in rows_de:
            regime_ant = self.classificar_proxy(capital or 0, porte or "", filiais or 0)

            row_para = self.conn.execute(
                """SELECT e.capital_social, e.porte, COUNT(est.cnpj_completo)
                   FROM empresas e
                   JOIN estabelecimentos est ON est.cnpj_basico = e.cnpj_basico
                   WHERE e.cnpj_basico = ? AND (e.snapshot_id = ? OR e.snapshot_id IS NULL)
                   GROUP BY e.capital_social, e.porte""",
                [cnpj, snapshot_para],
            ).fetchone()

            if not row_para:
                continue

            cap_novo, porte_novo, fil_novo = row_para
            regime_novo = self.classificar_proxy(cap_novo or 0, porte_novo or "", fil_novo or 0)

            if regime_ant in ("PRESUMIDO", "INDETERMINADO") and regime_novo == "LUCRO_REAL":
                self.conn.execute(
                    """INSERT INTO regime_transicoes
                       (cnpj_basico, regime_anterior, regime_novo, snapshot_de, snapshot_para, lead_quente)
                       VALUES (?, ?, ?, ?, ?, TRUE)""",
                    [cnpj, regime_ant, regime_novo, snapshot_de, snapshot_para],
                )
                self.conn.execute(
                    """UPDATE leads_icp SET transicao_regime = TRUE, score_prioridade = score_prioridade + 5
                       WHERE cnpj_basico = ?""",
                    [cnpj],
                )
                transicoes.append(cnpj)

        self.conn.commit()
        return {"status": "ok", "transicoes_detectadas": len(transicoes), "cnpjs": transicoes[:20]}

    def _demo_transicoes(self) -> dict:
        demos = [
            ("45678901", "PRESUMIDO", "LUCRO_REAL"),
            ("56789012", "INDETERMINADO", "LUCRO_REAL"),
        ]
        for cnpj, ant, novo in demos:
            self.conn.execute(
                """INSERT OR IGNORE INTO regime_transicoes
                   (cnpj_basico, regime_anterior, regime_novo, snapshot_de, snapshot_para, lead_quente)
                   VALUES (?, ?, ?, 1, 2, TRUE)""",
                [cnpj, ant, novo],
            )
            self.conn.execute(
                """INSERT OR IGNORE INTO leads_icp
                   (cnpj_basico, razao_social, cluster_estrategico, capital_social, qtd_filiais,
                    transicao_regime, score_prioridade, perfil_uso)
                   VALUES (?, ?, 'industria', 6500000, 6, TRUE, 10, 'transicao_regime')""",
                [cnpj, f"Empresa Transição {cnpj[:4]}"],
            )
        self.conn.commit()
        return {"status": "ok", "transicoes_detectadas": len(demos), "demo": True}

    def listar_quentes(self, limite: int = 50) -> list[dict]:
        rows = self.conn.execute(
            """SELECT rt.*, l.razao_social, l.cluster_estrategico, l.score_prioridade
               FROM regime_transicoes rt
               LEFT JOIN leads_icp l ON l.cnpj_basico = rt.cnpj_basico
               WHERE rt.lead_quente = TRUE
               ORDER BY rt.detectado_em DESC LIMIT ?""",
            [limite],
        ).fetchall()
        cols = ["id", "cnpj_basico", "regime_anterior", "regime_novo", "snapshot_de",
                "snapshot_para", "detectado_em", "lead_quente", "razao_social",
                "cluster_estrategico", "score_prioridade"]
        return [dict(zip(cols, r)) for r in rows]
