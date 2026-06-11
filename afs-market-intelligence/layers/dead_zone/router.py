"""Dead Zone — roteamento alternativo para leads sem e-mail validado."""

import logging

logger = logging.getLogger(__name__)

ROTAS = ("linkedin", "telefone", "endereco", "parceiro", "revisao")


class DeadZoneRouter:
    """
    Plano B quando e-mail não passa na Camada 3:
    LinkedIn → Telefone matriz → Endereço físico → Parceiro B2B2B → Revisão manual
    """

    def __init__(self, conn):
        self.conn = conn

    def rotear(self, lead_id: int, motivo: str) -> dict:
        lead = self.conn.execute(
            "SELECT cnpj_basico, razao_social FROM leads_icp WHERE id = ?",
            [lead_id],
        ).fetchone()
        if not lead:
            return {"status": "error", "message": "Lead não encontrado"}

        cnpj_basico, razao = lead[0], lead[1]

        decisor = self.conn.execute(
            "SELECT linkedin_url FROM decisores WHERE lead_id = ? AND linkedin_url IS NOT NULL LIMIT 1",
            [lead_id],
        ).fetchone()
        linkedin_url = decisor[0] if decisor else None

        estab = self.conn.execute(
            """SELECT telefone, logradouro, numero, bairro, municipio, uf, cep
               FROM estabelecimentos WHERE cnpj_basico = ? AND matriz_filial = '1' LIMIT 1""",
            [cnpj_basico],
        ).fetchone()

        telefone = estab[0] if estab else None
        endereco = None
        if estab and estab[1]:
            endereco = f"{estab[1]}, {estab[2]} — {estab[3]}, {estab[4]}/{estab[5]} CEP {estab[6]}"

        rota, prioridade = self._decidir_rota(linkedin_url, telefone, endereco)

        self.conn.execute(
            """INSERT OR REPLACE INTO dead_zone
               (lead_id, motivo, rota_recomendada, linkedin_url, telefone_matriz, endereco_completo, prioridade)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            [lead_id, motivo, rota, linkedin_url, telefone, endereco, prioridade],
        )
        self.conn.commit()

        return {
            "status": "ok",
            "lead_id": lead_id,
            "razao_social": razao,
            "rota_recomendada": rota,
            "prioridade": prioridade,
            "motivo": motivo,
        }

    def _decidir_rota(self, linkedin, telefone, endereco) -> tuple[str, int]:
        if linkedin:
            return "linkedin", 1
        if telefone:
            return "telefone", 2
        if endereco:
            return "endereco", 3
        return "revisao", 5

    def reprocessar_com_novo_email(self, lead_id: int, email: str) -> dict:
        """Quando comercial obtém e-mail via LinkedIn/ligação — reentra Camada 3."""
        from layers.validation.email_validator import EmailValidator, ValidationPipeline

        self.conn.execute(
            "UPDATE decisores SET email = ? WHERE lead_id = ?",
            [email, lead_id],
        )
        validator = EmailValidator()
        result = validator.validar_completo(email)
        if result["status"] in ("validado_alta", "validado_media"):
            self.conn.execute("DELETE FROM dead_zone WHERE lead_id = ?", [lead_id])
        self.conn.commit()
        return {"status": "ok", "validacao": result}

    def listar(self, limite: int = 100) -> list[dict]:
        rows = self.conn.execute(
            """SELECT dz.*, l.razao_social, l.cluster_estrategico
               FROM dead_zone dz JOIN leads_icp l ON l.id = dz.lead_id
               ORDER BY dz.prioridade ASC LIMIT ?""",
            [limite],
        ).fetchall()
        cols = ["id", "lead_id", "motivo", "rota_recomendada", "linkedin_url",
                "telefone_matriz", "endereco_completo", "prioridade", "created_at",
                "razao_social", "cluster_estrategico"]
        return [dict(zip(cols, r)) for r in rows]
