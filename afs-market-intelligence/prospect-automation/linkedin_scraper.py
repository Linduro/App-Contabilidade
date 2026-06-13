"""
LinkedIn scraper — Playwright (tutorial Grok, versão 2026).

Usa login real + delays humanos. Persiste sessão em sessions/linkedin/.
"""

from __future__ import annotations

import logging
import random
import re
import time
from pathlib import Path
from typing import Any

from config import CONFIG

logger = logging.getLogger(__name__)


def scrape_linkedin_profiles(urls: list[str], headless: bool = True) -> list[dict[str, Any]]:
    """Extrai nome, cargo, empresa, local, about de perfis /in/."""
    if not urls:
        return []

    email = CONFIG["LINKEDIN_EMAIL"]
    password = CONFIG["LINKEDIN_PASSWORD"]
    if not email or not password:
        logger.warning("LINKEDIN_EMAIL/PASSWORD não configurados — scrape limitado")
        return [_stub_from_url(u) for u in urls]

    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        raise ImportError("Instale: pip install playwright && playwright install chromium") from e

    results: list[dict] = []
    session_dir = CONFIG["SESSION_DIR"] / "linkedin"
    session_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        launch_opts: dict = {"headless": headless}
        if CONFIG["PROXY_URL"]:
            launch_opts["proxy"] = {"server": CONFIG["PROXY_URL"]}

        browser = p.chromium.launch(**launch_opts)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            storage_state=str(session_dir / "state.json") if (session_dir / "state.json").exists() else None,
        )
        page = context.new_page()

        if not (session_dir / "state.json").exists():
            _linkedin_login(page, email, password)
            context.storage_state(path=str(session_dir / "state.json"))

        for url in urls:
            url = _normalize_linkedin_url(url)
            try:
                data = _scrape_one_profile(page, url)
                results.append(data)
                logger.info("LinkedIn OK: %s", data.get("nome", url))
            except Exception as e:
                logger.error("Erro LinkedIn %s: %s", url, e)
                results.append({"url": url, "erro": str(e), "fonte": "linkedin"})
            time.sleep(random.uniform(CONFIG["DELAY_LINKEDIN_MIN"], CONFIG["DELAY_LINKEDIN_MAX"]))

        context.storage_state(path=str(session_dir / "state.json"))
        browser.close()

    return results


def _linkedin_login(page, login: str, password: str) -> None:
    page.goto("https://www.linkedin.com/login?fromSignIn=true", timeout=60000)
    page.wait_for_selector('input[name="session_key"]', timeout=30000)
    page.fill('input[name="session_key"]', login)
    page.fill('input[name="session_password"]', password)
    page.click('button[type="submit"]')
    page.wait_for_load_state("domcontentloaded", timeout=60000)
    time.sleep(random.uniform(2.0, 4.0))
    url = page.url.lower()
    if "checkpoint" in url or "challenge" in url or "verification" in url:
        raise RuntimeError(
            "LinkedIn pediu verificação (2FA/captcha). Rode uma vez com headless=false "
            "ou complete o login manualmente e salve sessions/linkedin/state.json"
        )
    if "login" in url and "feed" not in url:
        raise RuntimeError("Login LinkedIn falhou — verifique usuário/senha")


def _scrape_one_profile(page, url: str) -> dict[str, Any]:
    page.goto(url, timeout=60000)
    page.wait_for_load_state("domcontentloaded", timeout=30000)
    time.sleep(random.uniform(1.5, 3.0))

    def text(sel: str) -> str:
        el = page.query_selector(sel)
        return el.inner_text().strip() if el else ""

    nome = text("h1") or text(".text-heading-xlarge")
    cargo = text(".text-body-medium.break-words") or text('[data-generated-suggestion-target*="headline"]')
    local = text(".text-body-small.inline.t-black--light.break-words")
    about = text("#about ~ div.display-flex.ph5.pv3") or text('section[data-section="summary"]')

    empresa = ""
    exp = page.query_selector("#experience ~ div ul li, section[data-section='experience'] li")
    if exp:
        empresa = exp.inner_text().split("\n")[0].strip()[:120]

    return {
        "nome": nome,
        "cargo": cargo,
        "empresa": empresa,
        "local": local,
        "url": url,
        "sobre": (about or "")[:500],
        "fonte": "linkedin",
    }


def _normalize_linkedin_url(url: str) -> str:
    url = url.strip()
    if not url.startswith("http"):
        url = "https://www.linkedin.com/in/" + url.strip("/")
    return url.split("?")[0]


def _stub_from_url(url: str) -> dict:
    slug = re.sub(r".*/in/", "", url.rstrip("/"))
    return {
        "nome": slug.replace("-", " ").title(),
        "cargo": "",
        "empresa": "",
        "local": "",
        "url": _normalize_linkedin_url(url),
        "sobre": "",
        "fonte": "linkedin",
        "modo": "stub_sem_credenciais",
    }
