"""Fonte C — descoberta de site corporativo + extração institucional (robots.txt)."""

from __future__ import annotations

import logging
import os
import random
import re
import time
from typing import Iterable
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup

from layers.enrichment.normalize_contacts import (
    INSTITUTIONAL_PREFIXES,
    is_institutional_email,
    normalize_email,
    normalize_phone,
)

logger = logging.getLogger(__name__)

USER_AGENT = os.environ.get(
    "AFS_USER_AGENT",
    "AFS-Market-Intelligence/1.0 (+https://github.com; B2B public data research)",
)
DOMAIN_DELAY = float(os.environ.get("SITE_SCRAPE_DELAY_SEC", "3.0"))
CONTACT_PATHS = (
    "/contato", "/contatos", "/fale-conosco", "/faleconosco",
    "/contact", "/contact-us", "/sobre", "/about",
)

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4}")


class SiteContactScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT})
        self._last_fetch: dict[str, float] = {}

    def discover_domain(self, razao_social: str, nome_fantasia: str | None) -> str | None:
        """Heurística: slug do nome fantasia → .com.br / .com.br verificação DNS."""
        import socket

        base = (nome_fantasia or razao_social or "").lower()
        base = re.sub(r"\b(ltda|s\.?a\.?|me|epp|eireli|holding|grupo)\b", "", base, flags=re.I)
        slug = re.sub(r"[^a-z0-9]+", "", base)[:30]
        if len(slug) < 4:
            return None
        for tld in (".com.br", ".com", ".net.br"):
            host = slug + tld
            try:
                socket.gethostbyname(host)
                return f"https://{host}"
            except socket.gaierror:
                continue
        return None

    def extract_contacts(self, base_url: str) -> list[dict]:
        if not base_url:
            return []
        parsed = urlparse(base_url if "://" in base_url else f"https://{base_url}")
        origin = f"{parsed.scheme}://{parsed.netloc}"
        if not self._robots_allows(origin, "/"):
            logger.info("[site] robots.txt bloqueia %s", origin)
            return []

        urls = [origin + "/"]
        for path in CONTACT_PATHS:
            if self._robots_allows(origin, path):
                urls.append(urljoin(origin, path))

        found: list[dict] = []
        for url in urls[:6]:
            html = self._fetch_rate_limited(url, parsed.netloc)
            if not html:
                continue
            found.extend(self._parse_page(html, url))
        return self._dedupe(found)

    def _robots_allows(self, origin: str, path: str) -> bool:
        try:
            rp = RobotFileParser()
            rp.set_url(urljoin(origin, "/robots.txt"))
            rp.read()
            return rp.can_fetch(USER_AGENT, urljoin(origin, path))
        except Exception:
            return True

    def _fetch_rate_limited(self, url: str, domain: str) -> str | None:
        now = time.time()
        last = self._last_fetch.get(domain, 0)
        wait = DOMAIN_DELAY - (now - last)
        if wait > 0:
            time.sleep(wait + random.uniform(0.1, 0.5))
        try:
            resp = self.session.get(url, timeout=15, allow_redirects=True)
            self._last_fetch[domain] = time.time()
            if resp.status_code != 200 or "text/html" not in resp.headers.get("Content-Type", ""):
                return None
            return resp.text
        except Exception as e:
            logger.debug("[site] fetch %s: %s", url, e)
            return None

    def _parse_page(self, html: str, url: str) -> list[dict]:
        soup = BeautifulSoup(html, "lxml")
        text = soup.get_text(" ", strip=True)
        out: list[dict] = []

        for raw_email in EMAIL_RE.findall(text):
            email = normalize_email(raw_email)
            if not email:
                continue
            if not is_institutional_email(email):
                continue
            out.append({
                "tipo": "email", "valor": email, "fonte": "site_institucional",
                "confianca": "media", "origem_url": url,
            })

        for raw_tel in PHONE_RE.findall(text):
            tel = normalize_phone(raw_tel)
            if tel:
                out.append({
                    "tipo": "telefone", "valor": tel, "fonte": "site_institucional",
                    "confianca": "media", "origem_url": url,
                })

        for a in soup.select('a[href^="mailto:"]'):
            email = normalize_email(a.get("href", "").replace("mailto:", "").split("?")[0])
            if email and is_institutional_email(email):
                out.append({
                    "tipo": "email", "valor": email, "fonte": "site_institucional",
                    "confianca": "alta", "origem_url": url,
                })
        return out

    @staticmethod
    def _dedupe(items: Iterable[dict]) -> list[dict]:
        seen: set[tuple] = set()
        out = []
        for it in items:
            key = (it["tipo"], it["valor"])
            if key in seen:
                continue
            seen.add(key)
            out.append(it)
        return out
