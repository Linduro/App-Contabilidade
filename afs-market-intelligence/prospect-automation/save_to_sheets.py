"""Persistência — CSV local e Google Sheets (opcional)."""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

from config import CONFIG

logger = logging.getLogger(__name__)


def save_csv(rows: list[dict[str, Any]], prefix: str = "leads") -> Path:
    if not rows:
        raise ValueError("Nenhum dado para salvar")
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = CONFIG["OUTPUT_DIR"] / f"{prefix}_{ts}.csv"
    pd.DataFrame(rows).to_csv(path, index=False, encoding="utf-8-sig")
    logger.info("CSV salvo: %s (%s linhas)", path, len(rows))
    return path


def save_to_google_sheets(rows: list[dict[str, Any]], sheet_id: str | None = None) -> bool:
    """Append rows to Google Sheet (requer credentials.json OAuth/service account)."""
    sheet_id = sheet_id or CONFIG.get("GOOGLE_SHEET_ID")
    creds_path = CONFIG.get("GOOGLE_SHEETS_CREDENTIALS")
    if not sheet_id or not Path(creds_path).exists():
        logger.info("Google Sheets não configurado — pulando")
        return False

    try:
        from google.oauth2.service_account import Credentials
        from googleapiclient.discovery import build

        scopes = ["https://www.googleapis.com/auth/spreadsheets"]
        creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
        service = build("sheets", "v4", credentials=creds)

        df = pd.DataFrame(rows)
        values = [df.columns.tolist()] + df.fillna("").astype(str).values.tolist()
        service.spreadsheets().values().append(
            spreadsheetId=sheet_id,
            range="Leads!A1",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": values[1:] if len(values) > 1 else values},
        ).execute()
        logger.info("Google Sheets: %s linhas adicionadas", len(rows))
        return True
    except Exception as e:
        logger.error("Google Sheets falhou: %s", e)
        return False


def push_to_afs_api(rows: list[dict], api_base: str | None = None) -> dict | None:
    """Envia leads para DuckDB via API AFS."""
    import os
    import requests

    base = (api_base or os.getenv("AFS_API_BASE") or "http://localhost:5001").rstrip("/")
    try:
        r = requests.post(
            f"{base}/api/social/import",
            json={"leads": rows},
            timeout=30,
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        logger.warning("API AFS indisponível: %s", e)
        return None
