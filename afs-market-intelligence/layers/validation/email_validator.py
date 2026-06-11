"""Camada 3 — Validação de e-mail: formato → MX → SMTP ping."""

import logging
import os
import re
import smtplib
import socket

logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
SMTP_TIMEOUT = int(os.environ.get("SMTP_TIMEOUT", 10))
HELO_DOMAIN = os.environ.get("SMTP_HELO_DOMAIN", "afs.local")


class EmailValidator:
    """Anti-bounce: valida sem enviar mensagem."""

    def validar_formato(self, email: str) -> bool:
        return bool(email and EMAIL_RE.match(email.strip()))

    def checar_mx(self, email: str) -> tuple[bool, list[str]]:
        try:
            import dns.resolver
            dominio = email.split("@")[1]
            answers = dns.resolver.resolve(dominio, "MX")
            hosts = [str(r.exchange).rstrip(".") for r in sorted(answers, key=lambda x: x.preference)]
            return True, hosts
        except Exception as e:
            logger.debug("[validation] MX falhou para %s: %s", email, e)
            return False, []

    def smtp_ping(self, email: str, mx_hosts: list[str]) -> dict:
        """
        Testa existência da caixa via RCPT TO sem enviar DATA.
        Detecta catch-all quando servidor aceita endereço aleatório.
        """
        if not mx_hosts:
            return {"status": "invalido", "smtp_status": "sem_mx", "catch_all": False}

        dominio = email.split("@")[1]
        fake_email = f"nonexistent-{os.urandom(4).hex()}@{dominio}"

        for mx in mx_hosts[:3]:
            try:
                with smtplib.SMTP(timeout=SMTP_TIMEOUT) as smtp:
                    smtp.connect(mx)
                    smtp.helo(HELO_DOMAIN)
                    smtp.mail("verify@afs.local")
                    code_real, _ = smtp.rcpt(email)
                    code_fake, _ = smtp.rcpt(fake_email)
                    smtp.quit()

                    catch_all = code_fake in (250, 251)
                    if code_real in (250, 251):
                        status = "validado_media" if catch_all else "validado_alta"
                        return {"status": status, "smtp_status": str(code_real), "catch_all": catch_all}
                    if code_real in (550, 551, 553):
                        return {"status": "invalido", "smtp_status": str(code_real), "catch_all": False}
                    return {"status": "pendente", "smtp_status": str(code_real), "catch_all": False}
            except (socket.timeout, smtplib.SMTPException, OSError) as e:
                logger.debug("[validation] SMTP %s: %s", mx, e)
                continue

        return {"status": "pendente", "smtp_status": "timeout", "catch_all": False}

    def validar_completo(self, email: str) -> dict:
        if not self.validar_formato(email):
            return {"email": email, "status": "invalido", "mx_valido": False, "motivo": "formato_invalido"}

        mx_ok, hosts = self.checar_mx(email)
        if not mx_ok:
            return {"email": email, "status": "invalido", "mx_valido": False, "motivo": "sem_mx"}

        smtp = self.smtp_ping(email, hosts)
        return {
            "email": email,
            "status": smtp["status"],
            "mx_valido": True,
            "smtp_status": smtp["smtp_status"],
            "catch_all": smtp["catch_all"],
        }


class ValidationPipeline:
    def __init__(self, conn):
        self.conn = conn
        self.validator = EmailValidator()

    def processar_decisores(self) -> dict:
        rows = self.conn.execute(
            """SELECT d.id, d.email, d.lead_id FROM decisores d
               WHERE d.email IS NOT NULL
               AND d.id NOT IN (SELECT decisor_id FROM emails_validados WHERE decisor_id IS NOT NULL)"""
        ).fetchall()

        stats = {"validado_alta": 0, "validado_media": 0, "invalido": 0, "pendente": 0}
        for decisor_id, email, lead_id in rows:
            result = self.validator.validar_completo(email)
            self.conn.execute(
                """INSERT INTO emails_validados (decisor_id, email, status, mx_valido, smtp_status, catch_all)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                [
                    decisor_id, email, result["status"],
                    result.get("mx_valido", False),
                    result.get("smtp_status"), result.get("catch_all", False),
                ],
            )
            stats[result["status"]] = stats.get(result["status"], 0) + 1

            if result["status"] in ("invalido", "pendente") or not email:
                from layers.dead_zone.router import DeadZoneRouter
                DeadZoneRouter(self.conn).rotear(lead_id, result.get("motivo", result["status"]))

        self.conn.commit()
        return {"status": "ok", **stats}
