"""Credenciais e proxies — nunca commitar .env real."""

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env", override=True)

CONFIG = {
    "LINKEDIN_EMAIL": os.getenv("LINKEDIN_EMAIL", ""),
    "LINKEDIN_PASSWORD": os.getenv("LINKEDIN_PASSWORD", ""),
    "INSTAGRAM_USERNAME": os.getenv("INSTAGRAM_USERNAME", ""),
    "INSTAGRAM_PASSWORD": os.getenv("INSTAGRAM_PASSWORD", ""),
    "GOOGLE_SHEETS_CREDENTIALS": os.getenv("GOOGLE_SHEETS_CREDENTIALS", "credentials.json"),
    "GOOGLE_SHEET_ID": os.getenv("GOOGLE_SHEET_ID", ""),
    "PROXY_URL": os.getenv("PROXY_URL", ""),
    "OUTPUT_DIR": ROOT / "output",
    "SESSION_DIR": ROOT / "sessions",
    "DELAY_LINKEDIN_MIN": float(os.getenv("DELAY_LINKEDIN_MIN", "5")),
    "DELAY_LINKEDIN_MAX": float(os.getenv("DELAY_LINKEDIN_MAX", "12")),
    "DELAY_INSTAGRAM_MIN": float(os.getenv("DELAY_INSTAGRAM_MIN", "3")),
    "DELAY_INSTAGRAM_MAX": float(os.getenv("DELAY_INSTAGRAM_MAX", "8")),
}

CONFIG["OUTPUT_DIR"].mkdir(parents=True, exist_ok=True)
CONFIG["SESSION_DIR"].mkdir(parents=True, exist_ok=True)
