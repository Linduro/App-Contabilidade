#!/usr/bin/env python3
"""Orquestrador — Prospecção LinkedIn + Instagram (tutorial Grok)."""

from __future__ import annotations

import argparse
import csv
import json
import logging
import sys
from pathlib import Path

from config import CONFIG
from instagram_scraper import scrape_instagram_profiles
from linkedin_scraper import scrape_linkedin_profiles
from save_to_sheets import push_to_afs_api, save_csv, save_to_google_sheets

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def load_urls_file(path: Path) -> list[str]:
    lines = path.read_text(encoding="utf-8").strip().splitlines()
    return [ln.strip() for ln in lines if ln.strip() and not ln.startswith("#")]


def load_csv_targets(path: Path) -> tuple[list[str], list[str]]:
    linkedin, instagram = [], []
    with path.open(encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("linkedin_url"):
                linkedin.append(row["linkedin_url"].strip())
            if row.get("instagram_user"):
                instagram.append(row["instagram_user"].strip())
    return linkedin, instagram


def main() -> int:
    parser = argparse.ArgumentParser(description="Prospecção LinkedIn + Instagram")
    parser.add_argument("--linkedin", type=Path, help="Arquivo .txt com URLs LinkedIn")
    parser.add_argument("--instagram", type=Path, help="Arquivo .txt com usernames Instagram")
    parser.add_argument("--csv", type=Path, help="CSV com colunas linkedin_url, instagram_user")
    parser.add_argument("--json", type=Path, help="JSON {linkedin:[], instagram:[]}")
    parser.add_argument("--headless", action="store_true", default=True)
    parser.add_argument("--no-headless", action="store_false", dest="headless")
    parser.add_argument("--sheets", action="store_true", help="Enviar para Google Sheets")
    parser.add_argument("--afs", action="store_true", help="Importar para API AFS")
    args = parser.parse_args()

    linkedin_urls: list[str] = []
    instagram_users: list[str] = []

    if args.csv and args.csv.exists():
        linkedin_urls, instagram_users = load_csv_targets(args.csv)
    elif args.json and args.json.exists():
        data = json.loads(args.json.read_text(encoding="utf-8"))
        linkedin_urls = data.get("linkedin", [])
        instagram_users = data.get("instagram", [])
    else:
        if args.linkedin and args.linkedin.exists():
            linkedin_urls = load_urls_file(args.linkedin)
        if args.instagram and args.instagram.exists():
            instagram_users = load_urls_file(args.instagram)

    if not linkedin_urls and not instagram_users:
        # Demo mínimo
        linkedin_urls = ["https://www.linkedin.com/in/williamhgates/"]
        instagram_users = ["microsoft"]
        logger.info("Nenhum alvo informado — rodando demo (1 LinkedIn + 1 Instagram)")

    logger.info("Iniciando prospecção: %s LinkedIn, %s Instagram", len(linkedin_urls), len(instagram_users))

    all_rows: list[dict] = []

    if linkedin_urls:
        li_data = scrape_linkedin_profiles(linkedin_urls, headless=args.headless)
        all_rows.extend(li_data)

    if instagram_users:
        ig_data = scrape_instagram_profiles(instagram_users)
        all_rows.extend(ig_data)

    if not all_rows:
        logger.error("Nenhum resultado")
        return 1

    path = save_csv(all_rows)
    print(f"Dados salvos: {path}")

    if args.sheets:
        save_to_google_sheets(all_rows)

    if args.afs:
        result = push_to_afs_api(all_rows)
        if result:
            print(f"Importados no AFS: {result}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
