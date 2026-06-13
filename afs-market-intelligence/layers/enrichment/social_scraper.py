"""Integração AFS — orquestra prospect-automation (LinkedIn + Instagram)."""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_PA_ROOT = Path(__file__).resolve().parent.parent.parent / "prospect-automation"


def _ensure_path() -> None:
    if str(_PA_ROOT) not in sys.path:
        sys.path.insert(0, str(_PA_ROOT))


def init_social_schema(conn) -> None:
    from layers.enrichment.contato_cascade import init_enrichment_schema
    init_enrichment_schema(conn)


def run_social_scrape(
    linkedin_urls: list[str] | None = None,
    instagram_users: list[str] | None = None,
    headless: bool = True,
) -> dict[str, Any]:
    _ensure_path()
    try:
        from dotenv import load_dotenv
        load_dotenv(_PA_ROOT / ".env", override=True)
    except ImportError:
        pass
    linkedin_urls = linkedin_urls or []
    instagram_users = instagram_users or []
    rows: list[dict] = []

    if linkedin_urls:
        from linkedin_scraper import scrape_linkedin_profiles
        rows.extend(scrape_linkedin_profiles(linkedin_urls, headless=headless))
    if instagram_users:
        from instagram_scraper import scrape_instagram_profiles
        rows.extend(scrape_instagram_profiles(instagram_users))

    return {"status": "ok", "total": len(rows), "rows": rows}


def persist_social_leads(conn, rows: list[dict]) -> int:
    import uuid
    init_social_schema(conn)
    n = 0
    for r in rows:
        plataforma = r.get("fonte", "unknown")
        try:
            conn.execute(
                """INSERT INTO social_leads
                   (id, fonte, plataforma, nome, cargo, empresa, username, url, seguidores, bio, payload)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                [
                    str(uuid.uuid4()),
                    plataforma,
                    plataforma,
                    r.get("nome"),
                    r.get("cargo"),
                    r.get("empresa"),
                    r.get("username"),
                    r.get("url"),
                    r.get("seguidores"),
                    r.get("bio") or r.get("sobre"),
                    json.dumps(r, ensure_ascii=False),
                ],
            )
            n += 1
        except Exception as e:
            logger.debug("[social] insert: %s", e)
    if hasattr(conn, "commit"):
        conn.commit()
    return n


def list_social_leads(conn, limit: int = 100) -> list[dict]:
    init_social_schema(conn)
    rows = conn.execute(
        """SELECT id, fonte, plataforma, nome, cargo, empresa, username, url,
                  seguidores, bio, coletado_em
           FROM social_leads ORDER BY coletado_em DESC LIMIT ?""",
        [limit],
    ).fetchall()
    keys = [
        "id", "fonte", "plataforma", "nome", "cargo", "empresa",
        "username", "url", "seguidores", "bio", "coletado_em",
    ]
    return [dict(zip(keys, r)) for r in rows]
