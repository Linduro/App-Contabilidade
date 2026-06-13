"""Filtros SQL reutilizáveis para prospectos_rf (API, mapa, export)."""

from __future__ import annotations

import hashlib
import yaml
from pathlib import Path
from flask import Request

CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "prospect_defaults.yaml"


def load_defaults() -> dict:
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)


def parse_filters(args) -> dict:
    """args: Flask request.args ou dict."""
    get = args.get if hasattr(args, "get") else args.__getitem__
    defaults = load_defaults().get("icp_ativo", {})
    cap_min = get("capital_min")
    cap_max = get("capital_max")
    return {
        "uf": (get("uf") or "").strip() or None,
        "cluster": (get("cluster") or "").strip() or None,
        "cnae": (get("cnae") or "").strip() or None,
        "porte": (get("porte") or "").strip() or None,
        "municipio": (get("municipio") or "").strip() or None,
        "q": (get("q") or "").strip() or None,
        "capital_min": float(cap_min) if cap_min not in (None, "") else defaults.get("capital_min"),
        "capital_max": float(cap_max) if cap_max not in (None, "") else defaults.get("capital_max"),
    }


def sql_where(filters: dict, prefix: str = "") -> tuple[str, list]:
    p = f"{prefix}." if prefix else ""
    clauses = ["1=1"]
    params: list = []
    if filters.get("uf"):
        clauses.append(f"{p}uf = ?")
        params.append(filters["uf"])
    if filters.get("cluster"):
        clauses.append(f"{p}cluster_estrategico = ?")
        params.append(filters["cluster"])
    if filters.get("cnae"):
        clauses.append(f"({p}cnae_principal LIKE ? OR {p}cnae_principal LIKE ?)")
        c = filters["cnae"].replace("-", "").replace("/", "")
        params.extend([f"{c}%", f"{filters['cnae']}%"])
    if filters.get("porte"):
        clauses.append(f"CAST({p}porte AS VARCHAR) = ?")
        params.append(str(filters["porte"]))
    if filters.get("municipio"):
        clauses.append(f"({p}municipio_nome ILIKE ? OR {p}municipio_codigo = ?)")
        params.extend([f"%{filters['municipio']}%", filters["municipio"]])
    if filters.get("q"):
        clauses.append(f"({p}razao_social ILIKE ? OR {p}cnpj_basico LIKE ?)")
        params.extend([f"%{filters['q']}%", f"%{filters['q']}%"])
    if filters.get("capital_min") is not None:
        clauses.append(f"COALESCE({p}capital_social, 0) >= ?")
        params.append(float(filters["capital_min"]))
    if filters.get("capital_max") is not None:
        clauses.append(f"COALESCE({p}capital_social, 0) <= ?")
        params.append(float(filters["capital_max"]))
    return " AND ".join(clauses), params


def municipio_coords(uf: str, codigo: str | None, nome: str | None) -> tuple[float, float]:
    """Coordenadas aproximadas por município (hash estável dentro da UF)."""
    from layers.intelligence.market_intel import UF_COORDS

    base = UF_COORDS.get(uf or "SP", (-15.78, -47.93))
    key = f"{uf}:{codigo or ''}:{nome or ''}"
    h = int(hashlib.md5(key.encode()).hexdigest()[:8], 16)
    lat_off = ((h % 1000) / 500.0 - 1.0) * 2.8
    lng_off = (((h // 1000) % 1000) / 500.0 - 1.0) * 3.2
    return base[0] + lat_off, base[1] + lng_off
