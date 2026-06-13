"""Camada 2 — BrasilAPI, ReceitaWS, CNPJ.ws com cache DuckDB e backoff."""

from __future__ import annotations

import json
import logging
import os
import random
import time
from datetime import datetime, timedelta
from typing import Any

import requests

from layers.enrichment.normalize_contacts import normalize_cnpj_completo, normalize_email, normalize_phone

logger = logging.getLogger(__name__)

USER_AGENT = os.environ.get(
    "AFS_USER_AGENT",
    "AFS-Market-Intelligence/1.0 (+https://github.com; B2B public data research)",
)
CACHE_TTL_HOURS = int(os.environ.get("CNPJ_API_CACHE_HOURS", "168"))
MINHA_RECEITA_URL = os.environ.get("MINHA_RECEITA_URL", "").rstrip("/")

PROVIDERS = [
    {"name": "brasilapi", "url": "https://brasilapi.com.br/api/cnpj/v1/{cnpj}", "delay": 1.0},
    {"name": "receitaws", "url": "https://receitaws.com.br/v1/cnpj/{cnpj}", "delay": 2.5},
    {"name": "cnpjws", "url": "https://publica.cnpj.ws/cnpj/{cnpj}", "delay": 2.0},
]


class CnpjApiClient:
    def __init__(self, conn):
        self.conn = conn
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})

    def fetch_all(self, cnpj: str) -> list[dict]:
        """Consulta provedores em cascata; retorna contatos normalizados."""
        cnpj14 = normalize_cnpj_completo(cnpj)
        if MINHA_RECEITA_URL:
            payload = self._fetch_provider("minha_receita", f"{MINHA_RECEITA_URL}/cnpj/{cnpj14}", cnpj14, delay=0.2)
            if payload:
                return self._extract_contacts("minha_receita", payload)

        results: list[dict] = []
        for prov in PROVIDERS:
            cached = self._cache_get(cnpj14, prov["name"])
            if cached:
                results.extend(self._extract_contacts(prov["name"], cached))
                continue
            payload = self._fetch_provider(prov["name"], prov["url"].format(cnpj=cnpj14), cnpj14, prov["delay"])
            if payload:
                self._cache_set(cnpj14, prov["name"], payload)
                results.extend(self._extract_contacts(prov["name"], payload))
        return self._apply_consensus(results)

    def _fetch_provider(self, name: str, url: str, cnpj14: str, delay: float) -> dict | None:
        for attempt in range(4):
            try:
                time.sleep(delay + random.uniform(0.2, 0.8) * (attempt + 1))
                resp = self.session.get(url, timeout=25)
                if resp.status_code == 429:
                    time.sleep(2 ** attempt * 2)
                    continue
                if resp.status_code != 200:
                    logger.debug("[%s] HTTP %s para %s", name, resp.status_code, cnpj14)
                    return None
                return resp.json()
            except Exception as e:
                logger.debug("[%s] tentativa %s: %s", name, attempt + 1, e)
                time.sleep(2 ** attempt)
        return None

    def _extract_contacts(self, provider: str, data: dict) -> list[dict]:
        out: list[dict] = []
        fonte = f"API:{provider}"

        if provider == "brasilapi":
            email = normalize_email(data.get("email"))
            ddd = str(data.get("ddd_telefone_1") or "")
            tel_raw = str(data.get("telefone_1") or "")
            tel = normalize_phone(tel_raw, ddd)
            if email:
                out.append({"tipo": "email", "valor": email, "fonte": fonte, "confianca": "media"})
            if tel:
                out.append({"tipo": "telefone", "valor": tel, "fonte": fonte, "confianca": "media"})

        elif provider == "receitaws":
            email = normalize_email(data.get("email"))
            tel = normalize_phone(data.get("telefone"))
            if email:
                out.append({"tipo": "email", "valor": email, "fonte": fonte, "confianca": "media"})
            if tel:
                out.append({"tipo": "telefone", "valor": tel, "fonte": fonte, "confianca": "media"})

        elif provider in ("cnpjws", "minha_receita"):
            est = (data.get("estabelecimento") or data) if isinstance(data, dict) else {}
            email = normalize_email(est.get("email") or data.get("email"))
            ddd1 = str(est.get("ddd1") or est.get("ddd") or "")
            tel1 = str(est.get("telefone1") or est.get("telefone") or "")
            tel = normalize_phone(tel1, ddd1)
            if email:
                out.append({"tipo": "email", "valor": email, "fonte": fonte, "confianca": "media"})
            if tel:
                out.append({"tipo": "telefone", "valor": tel, "fonte": fonte, "confianca": "media"})

        return out

    def _apply_consensus(self, items: list[dict]) -> list[dict]:
        """Múltiplas fontes concordando elevam confiança."""
        by_key: dict[tuple, list[dict]] = {}
        for it in items:
            key = (it["tipo"], it["valor"])
            by_key.setdefault(key, []).append(it)
        merged = []
        for (_tipo, _val), group in by_key.items():
            fonts = {g["fonte"] for g in group}
            conf = "alta" if len(fonts) >= 2 else group[0].get("confianca", "media")
            merged.append({**group[0], "confianca": conf, "fontes": list(fonts)})
        return merged

    def _cache_get(self, cnpj14: str, provider: str) -> dict | None:
        try:
            row = self.conn.execute(
                """SELECT payload FROM cnpj_api_cache
                   WHERE cnpj_completo = ? AND provider = ?
                     AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)""",
                [cnpj14, provider],
            ).fetchone()
            if row and row[0]:
                return json.loads(row[0])
        except Exception:
            pass
        return None

    def _cache_set(self, cnpj14: str, provider: str, payload: dict):
        try:
            exp = datetime.utcnow() + timedelta(hours=CACHE_TTL_HOURS)
            self.conn.execute(
                """INSERT OR REPLACE INTO cnpj_api_cache (cnpj_completo, provider, payload, fetched_at, expires_at)
                   VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)""",
                [cnpj14, provider, json.dumps(payload, ensure_ascii=False), exp.isoformat()],
            )
        except Exception as e:
            logger.debug("[cache] falha: %s", e)
