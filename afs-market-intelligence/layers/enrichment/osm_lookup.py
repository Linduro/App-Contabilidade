"""Fonte E — OpenStreetMap Nominatim (telefone público de POI, rate limit)."""

from __future__ import annotations

import logging
import os
import time

import requests

from layers.enrichment.normalize_contacts import normalize_phone

logger = logging.getLogger(__name__)

USER_AGENT = os.environ.get(
    "AFS_USER_AGENT",
    "AFS-Market-Intelligence/1.0 (contact@assetflow.com.br)",
)
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
MIN_INTERVAL = float(os.environ.get("NOMINATIM_INTERVAL_SEC", "1.1"))
_last_call = 0.0


class OsmLookup:
    def lookup_phone(self, razao: str, endereco: str, municipio: str, uf: str) -> list[dict]:
        global _last_call
        query = f"{razao}, {endereco}, {municipio}, {uf}, Brasil"
        now = time.time()
        if now - _last_call < MIN_INTERVAL:
            time.sleep(MIN_INTERVAL - (now - _last_call))
        _last_call = time.time()

        try:
            resp = requests.get(
                NOMINATIM_URL,
                params={"q": query, "format": "json", "limit": 3, "addressdetails": 1},
                headers={"User-Agent": USER_AGENT},
                timeout=20,
            )
            if resp.status_code != 200:
                return []
            results = resp.json()
        except Exception as e:
            logger.debug("[osm] %s", e)
            return []

        out: list[dict] = []
        for item in results:
            extra = item.get("extratags") or {}
            phone_raw = extra.get("phone") or extra.get("contact:phone")
            if not phone_raw:
                continue
            tel = normalize_phone(str(phone_raw))
            if tel:
                out.append({
                    "tipo": "telefone",
                    "valor": tel,
                    "fonte": "OSM:Nominatim",
                    "confianca": "media",
                    "origem_url": f"https://www.openstreetmap.org/?lat={item.get('lat')}&lon={item.get('lon')}",
                })
        return out
