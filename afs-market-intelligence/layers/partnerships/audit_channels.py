"""Canal B2B2B — parceria reversa com bancas de auditoria média."""

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)
DATA_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "audit_firms.json"

EXCLUIDAS_TOP10 = {
    "Deloitte", "PwC", "PricewaterhouseCoopers", "EY", "Ernst & Young",
    "KPMG", "BDO", "Grant Thornton", "RSM", "Crowe", "Baker Tilly", "Mazars",
}


class AuditPartnershipChannel:
    """Funil B2B2B: bancas médias indicam clientes com problemas patrimoniais."""

    def __init__(self, conn):
        self.conn = conn

    def carregar_base(self) -> dict:
        with open(DATA_PATH, encoding="utf-8") as f:
            data = json.load(f)
        inseridos = 0
        for firma in data["firmas"]:
            if firma["nome"] in EXCLUIDAS_TOP10:
                continue
            self.conn.execute(
                """INSERT OR IGNORE INTO parceiros_auditoria (nome, rede, uf_sede, website, status_parceria)
                   VALUES (?, ?, ?, ?, 'prospect')""",
                [firma["nome"], firma.get("rede"), firma.get("uf"), firma.get("website")],
            )
            inseridos += 1
        self.conn.commit()
        return {"status": "ok", "firmas_carregadas": inseridos, "excluidas_top10": data["excluidas_top10"]}

    def listar_prospects(self, uf: str | None = None) -> list[dict]:
        sql = "SELECT * FROM parceiros_auditoria WHERE status_parceria = 'prospect'"
        params = []
        if uf:
            sql += " AND uf_sede = ?"
            params.append(uf)
        sql += " ORDER BY nome"
        rows = self.conn.execute(sql, params).fetchall()
        cols = ["id", "nome", "rede", "uf_sede", "website", "contato_parceria", "status_parceria", "created_at"]
        return [dict(zip(cols, r)) for r in rows]

    def atualizar_status(self, parceiro_id: int, status: str, contato: str = "") -> dict:
        self.conn.execute(
            "UPDATE parceiros_auditoria SET status_parceria = ?, contato_parceria = ? WHERE id = ?",
            [status, contato, parceiro_id],
        )
        self.conn.commit()
        return {"status": "ok", "parceiro_id": parceiro_id, "novo_status": status}

    def cruzar_auditor_cliente(self, cnpj_basico: str, auditor_nome: str) -> dict | None:
        """Cruza auditor do cliente (CVM/DFP) com base de parceiros."""
        row = self.conn.execute(
            "SELECT * FROM parceiros_auditoria WHERE nome LIKE ? OR rede LIKE ?",
            [f"%{auditor_nome}%", f"%{auditor_nome}%"],
        ).fetchone()
        if row:
            return {"parceiro_encontrado": True, "nome": row[1], "canal": "b2b2b_warm"}
        return None
