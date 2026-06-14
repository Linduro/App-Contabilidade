"""Classificacao CNAE quente / neutro / frio para Cluster AFS."""

from __future__ import annotations

import json
from pathlib import Path

CONFIG_PATH = Path(__file__).resolve().parent.parent.parent / "config" / "cnae_classificacao.json"


def _load_raw() -> dict:
    if not CONFIG_PATH.exists():
        return {"quente": {}, "frio": {}}
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def save_raw(data: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def divisao_from_cnae(cnae: str | None) -> str:
    if not cnae:
        return ""
    digits = "".join(c for c in str(cnae) if c.isdigit())
    return digits[:2] if len(digits) >= 2 else digits


def classificar_divisao(codigo: str, overrides: dict | None = None) -> str:
    """Retorna quente | frio | neutro."""
    overrides = overrides or {}
    if codigo in overrides:
        return overrides[codigo]
    raw = _load_raw()
    if codigo in raw.get("quente", {}):
        return "quente"
    if codigo in raw.get("frio", {}):
        return "frio"
    return "neutro"


def listar_classificacao() -> dict:
    raw = _load_raw()
    quente = raw.get("quente", {})
    frio = raw.get("frio", {})
    return {
        "meta": raw.get("meta", {}),
        "quente": quente,
        "frio": frio,
        "totais": {
            "quente": len(quente),
            "frio": len(frio),
        },
    }


def atualizar_divisao(codigo: str, status: str, nota: str = "") -> dict:
    if status not in ("quente", "frio", "neutro"):
        raise ValueError("status deve ser quente, frio ou neutro")
    raw = _load_raw()
    quente = dict(raw.get("quente", {}))
    frio = dict(raw.get("frio", {}))
    quente.pop(codigo, None)
    frio.pop(codigo, None)
    if status == "quente":
        quente[codigo] = nota or quente.get(codigo, "")
    elif status == "frio":
        frio[codigo] = nota or frio.get(codigo, "")
    raw["quente"] = quente
    raw["frio"] = frio
    save_raw(raw)
    return listar_classificacao()


def sql_cnae_classificacao(filters: dict, prefix: str = "") -> tuple[str, list]:
    """Clausulas SQL para excluir frios ou restringir a quentes."""
    p = f"{prefix}." if prefix else ""
    clauses: list[str] = []
    params: list = []
    raw = _load_raw()
    frio = list(raw.get("frio", {}).keys())
    quente = list(raw.get("quente", {}).keys())

    if filters.get("excluir_frios") and frio:
        placeholders = ",".join("?" * len(frio))
        clauses.append(f"SUBSTRING({p}cnae_principal, 1, 2) NOT IN ({placeholders})")
        params.extend(frio)

    if filters.get("apenas_quentes") and quente:
        placeholders = ",".join("?" * len(quente))
        clauses.append(f"SUBSTRING({p}cnae_principal, 1, 2) IN ({placeholders})")
        params.extend(quente)

    if filters.get("cnae_status") == "quente" and quente:
        placeholders = ",".join("?" * len(quente))
        clauses.append(f"SUBSTRING({p}cnae_principal, 1, 2) IN ({placeholders})")
        params.extend(quente)
    elif filters.get("cnae_status") == "frio" and frio:
        placeholders = ",".join("?" * len(frio))
        clauses.append(f"SUBSTRING({p}cnae_principal, 1, 2) IN ({placeholders})")
        params.extend(frio)
    elif filters.get("cnae_status") == "neutro" and (quente or frio):
        excluded = quente + frio
        placeholders = ",".join("?" * len(excluded))
        clauses.append(f"SUBSTRING({p}cnae_principal, 1, 2) NOT IN ({placeholders})")
        params.extend(excluded)

    if not clauses:
        return "1=1", []
    return " AND ".join(clauses), params
