"""Camada 4 — coordenadas municipais via API aberta IBGE."""

from __future__ import annotations

import logging
import time

import requests

logger = logging.getLogger(__name__)

IBGE_MUNICIPIOS = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"


def ensure_municipio_coords(conn, ibge: str, nome: str | None, uf: str | None) -> tuple[float | None, float | None]:
    """Retorna lat/lng do município; cache em geo_municipios."""
    if not ibge:
        return None, None
    row = conn.execute(
        "SELECT lat, lng FROM geo_municipios WHERE ibge_codigo = ?", [str(ibge)]
    ).fetchone()
    if row and row[0] is not None:
        return row[0], row[1]

    lat, lng = _fetch_ibge_centroid(str(ibge))
    if lat is not None:
        conn.execute(
            """INSERT OR REPLACE INTO geo_municipios (ibge_codigo, nome, uf, lat, lng, fonte)
               VALUES (?, ?, ?, ?, ?, 'IBGE')""",
            [str(ibge), nome, uf, lat, lng],
        )
    return lat, lng


def _fetch_ibge_centroid(ibge: str) -> tuple[float | None, float | None]:
    try:
        time.sleep(0.3)
        r = requests.get(f"{IBGE_MUNICIPIOS}/{ibge}", timeout=15)
        if r.status_code != 200:
            return None, None
        data = r.json()
        centroide = (data.get("centroide") or {})
        return centroide.get("latitude"), centroide.get("longitude")
    except Exception as e:
        logger.debug("[geo] IBGE %s: %s", ibge, e)
        return None, None
