"""Camada 2 — Enriquecimento de decisores via scraping + LinkedIn."""

import logging
import os
import time
import random

logger = logging.getLogger(__name__)

CARGOS_ALVO = [
    ("CFO", ["cfo", "diretor financeiro", "chief financial officer"]),
    ("Controller", ["controller", "controladoria"]),
    ("Gerente Contábil", ["gerente contábil", "gerente contabil", "accounting manager"]),
]

DELAY_MIN = float(os.environ.get("SCRAPING_DELAY_MIN", 2))
DELAY_MAX = float(os.environ.get("SCRAPING_DELAY_MAX", 5))


class LinkedInMatcher:
    """
    LinkedIn em dois modos:
    - confirmar: valida pessoa encontrada em outras fontes
    - preencher: descobre cargo ausente
    """

    def __init__(self):
        self.enabled = os.environ.get("LINKEDIN_SEARCH_ENABLED", "true").lower() == "true"

    def confirmar(self, nome: str, empresa: str, cargo_esperado: str) -> dict | None:
        """Busca perfil para confirmar dados primários."""
        if not self.enabled or not nome:
            return None
        time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))
        query = f'"{nome}" "{empresa}" {cargo_esperado} site:linkedin.com/in'
        resultado = self._buscar_google(query)
        if resultado:
            return {
                "nome": nome,
                "cargo": cargo_esperado,
                "linkedin_url": resultado.get("url"),
                "linkedin_modo": "confirmar",
                "score_confianca": 0.85,
                "fonte": "linkedin_confirmado",
            }
        return None

    def preencher(self, empresa: str, cargo: str) -> dict | None:
        """Preenche cargo crítico ausente."""
        if not self.enabled:
            return None
        time.sleep(random.uniform(DELAY_MIN, DELAY_MAX))
        query = f'"{empresa}" {cargo} site:linkedin.com/in'
        resultado = self._buscar_google(query)
        if resultado:
            return {
                "nome": resultado.get("nome", "A confirmar"),
                "cargo": cargo,
                "linkedin_url": resultado.get("url"),
                "linkedin_modo": "preencher",
                "score_confianca": 0.55,
                "fonte": "linkedin_discovery",
            }
        return None

    def _buscar_google(self, query: str) -> dict | None:
        try:
            import requests
            from bs4 import BeautifulSoup
            headers = {"User-Agent": "AFS-Market-Intelligence/1.0 (B2B research)"}
            resp = requests.get(
                "https://www.google.com/search",
                params={"q": query, "num": 5},
                headers=headers,
                timeout=15,
            )
            if resp.status_code != 200:
                return None
            soup = BeautifulSoup(resp.text, "lxml")
            for a in soup.select("a[href*='linkedin.com/in/']"):
                href = a.get("href", "")
                if "linkedin.com/in/" in href:
                    titulo = a.get_text(strip=True)
                    nome = titulo.split(" - ")[0] if " - " in titulo else titulo
                    return {"url": href.split("&")[0], "nome": nome}
        except Exception as e:
            logger.debug("[enrichment] Google search falhou: %s", e)
        return None


class EnrichmentEngine:
    """Orquestra enriquecimento: site → Google → LinkedIn confirmar/preencher."""

    def __init__(self, conn):
        self.conn = conn
        self.linkedin = LinkedInMatcher()

    def enriquecer_lead(self, lead_id: int, razao_social: str) -> list[dict]:
        decisores = []
        for cargo_label, keywords in CARGOS_ALVO:
            primario = self._buscar_fonte_primaria(razao_social, keywords[0])
            if primario:
                confirmado = self.linkedin.confirmar(primario["nome"], razao_social, cargo_label)
                d = confirmado or {
                    **primario,
                    "cargo": cargo_label,
                    "linkedin_modo": None,
                    "score_confianca": 0.70,
                }
            else:
                d = self.linkedin.preencher(razao_social, cargo_label)
                if not d:
                    continue
            decisores.append(d)
            self._salvar_decisor(lead_id, d)
        return decisores

    def _buscar_fonte_primaria(self, empresa: str, cargo_query: str) -> dict | None:
        try:
            import requests
            from bs4 import BeautifulSoup
            headers = {"User-Agent": "AFS-Market-Intelligence/1.0"}
            resp = requests.get(
                "https://www.google.com/search",
                params={"q": f'"{empresa}" {cargo_query} email OR contato'},
                headers=headers,
                timeout=15,
            )
            if resp.status_code != 200:
                return None
            soup = BeautifulSoup(resp.text, "lxml")
            texto = soup.get_text(" ", strip=True)[:2000]
            import re
            emails = re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", texto)
            nomes = re.findall(r"([A-Z][a-záéíóúãõâêô]+ [A-Z][a-záéíóúãõâêô]+)", texto)
            if nomes or emails:
                return {
                    "nome": nomes[0] if nomes else "Decisor identificado",
                    "email": emails[0] if emails else None,
                    "fonte": "google_primario",
                }
        except Exception as e:
            logger.debug("[enrichment] fonte primária: %s", e)
        return None

    def _salvar_decisor(self, lead_id: int, d: dict):
        self.conn.execute(
            """INSERT INTO decisores (lead_id, nome, cargo, email, linkedin_url, fonte, score_confianca, linkedin_modo)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                lead_id, d.get("nome"), d.get("cargo"), d.get("email"),
                d.get("linkedin_url"), d.get("fonte"), d.get("score_confianca", 0.5),
                d.get("linkedin_modo"),
            ],
        )

    def executar_lote(self, limite: int = 50) -> dict:
        rows = self.conn.execute(
            "SELECT id, razao_social FROM leads_icp ORDER BY score_prioridade DESC LIMIT ?",
            [limite],
        ).fetchall()
        total_decisores = 0
        for lead_id, razao in rows:
            decisores = self.enriquecer_lead(lead_id, razao)
            total_decisores += len(decisores)
        self.conn.commit()
        return {"status": "ok", "leads_processados": len(rows), "decisores": total_decisores}
