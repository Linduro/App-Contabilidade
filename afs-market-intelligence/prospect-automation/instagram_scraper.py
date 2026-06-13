"""Instagram scraper — Instaloader (tutorial Grok)."""

from __future__ import annotations

import logging
import random
import time
from typing import Any

import instaloader

from config import CONFIG

logger = logging.getLogger(__name__)


def scrape_instagram_profiles(usernames: list[str]) -> list[dict[str, Any]]:
    """Extrai username, nome, seguidores, bio de perfis públicos."""
    if not usernames:
        return []

    L = instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
        quiet=True,
    )

    user = CONFIG.get("INSTAGRAM_USERNAME") or ""
    pwd = CONFIG.get("INSTAGRAM_PASSWORD") or ""
    if user and pwd:
        try:
            L.login(user, pwd)
            L.save_session_to_file(str(CONFIG["SESSION_DIR"] / f"session-{user}"))
        except Exception as e:
            logger.warning("Login Instagram falhou (continuando público): %s", e)

    results: list[dict] = []
    for username in usernames:
        username = username.strip().lstrip("@").split("/")[-1]
        if not username:
            continue
        try:
            profile = instaloader.Profile.from_username(L.context, username)
            data = {
                "username": profile.username,
                "nome": profile.full_name or "",
                "seguidores": profile.followers,
                "seguindo": profile.followees,
                "bio": (profile.biography or "")[:400],
                "url": f"https://instagram.com/{profile.username}",
                "is_business": profile.is_business_account,
                "fonte": "instagram",
            }
            results.append(data)
            logger.info("Instagram OK: @%s (%s seguidores)", username, profile.followers)
        except Exception as e:
            logger.error("Erro Instagram @%s: %s", username, e)
            results.append({"username": username, "erro": str(e), "fonte": "instagram"})
        time.sleep(random.uniform(CONFIG["DELAY_INSTAGRAM_MIN"], CONFIG["DELAY_INSTAGRAM_MAX"]))

    return results
