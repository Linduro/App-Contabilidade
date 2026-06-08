"""Utilitários para inspecionar registros normalizados vindos do worker Node."""

from __future__ import annotations

import re
from typing import Any

from datetime import datetime, timedelta

from .config import RURAL_KEYWORDS, SEARCH_DAYS


def ajuizamento_ymd(record: dict[str, Any]) -> str | None:
    raw = (
        record.get("data_ajuizamento")
        or record.get("dataAjuizamento")
        or _datajud(record).get("dataAjuizamento")
    )
    if not raw:
        return None
    digits = re.sub(r"\D", "", str(raw))
    return digits[:8] if len(digits) >= 8 else None


def is_within_search_window(record: dict[str, Any], days: int = SEARCH_DAYS) -> bool:
    ymd = ajuizamento_ymd(record)
    if not ymd:
        return True
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y%m%d")
    return ymd >= cutoff


def _datajud(record: dict[str, Any]) -> dict[str, Any]:
    brutos = record.get("dados_brutos") or {}
    dj = brutos.get("datajud")
    return dj if isinstance(dj, dict) else {}


def partes(record: dict[str, Any]) -> list[dict[str, Any]]:
    raw = record.get("partes")
    if isinstance(raw, list) and raw:
        return [p for p in raw if isinstance(p, dict)]
    raw = _datajud(record).get("partes") or []
    return [p for p in raw if isinstance(p, dict)] if isinstance(raw, list) else []


def tem_partes(record: dict[str, Any]) -> bool:
    return len(partes(record)) > 0


def is_polo_passivo(parte: dict[str, Any]) -> bool:
    polo = str(parte.get("polo") or parte.get("tipoParticipacao") or "").upper()
    return "PASSIV" in polo or "REU" in polo or "RÉU" in polo


def extract_cnpj_parte(parte: dict[str, Any]) -> str | None:
    doc = extract_doc_parte(parte)
    return doc if doc and len(doc) == 14 else None


def extract_doc_parte(parte: dict[str, Any]) -> str | None:
    docs = parte.get("documentosPrincipais") or parte.get("documentos") or []
    if isinstance(docs, list):
        for doc in docs:
            if not isinstance(doc, dict):
                continue
            digits = re.sub(r"\D", "", str(doc.get("numero") or ""))
            if len(digits) in (11, 14):
                return digits
    match = re.search(r"\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}", str(parte.get("nome") or ""))
    return re.sub(r"\D", "", match.group(0)) if match else None


def is_pessoa_juridica(parte: dict[str, Any]) -> bool:
    tipo = str(parte.get("tipoPessoa") or parte.get("tipo") or "").upper()
    if "JUR" in tipo or tipo == "PJ":
        return True
    return extract_cnpj_parte(parte) is not None


def parte_tem_advogado(parte: dict[str, Any]) -> bool:
    reps = parte.get("advogados") or parte.get("representantes") or []
    return isinstance(reps, list) and len(reps) > 0


def has_advogado_passivo(record: dict[str, Any]) -> bool:
    dj = _datajud(record)
    if isinstance(dj.get("advogados"), list) and dj["advogados"]:
        return True
    for p in partes(record):
        if is_polo_passivo(p) and parte_tem_advogado(p):
            return True
    return False


def classe_codigo(record: dict[str, Any]) -> int | None:
    cod = record.get("classe_codigo")
    if cod is not None:
        try:
            return int(cod)
        except (TypeError, ValueError):
            pass
    dj = _datajud(record)
    for key in ("classe", "classeProcessual"):
        c = dj.get(key)
        if isinstance(c, dict) and c.get("codigo") is not None:
            return int(c["codigo"])
    return None


def valor_causa(record: dict[str, Any]) -> float:
    for key in ("valor_causa", "valorCausa", "valor_execucao"):
        raw = record.get(key)
        if raw is not None and raw != "":
            try:
                v = float(raw)
                if v >= 0:
                    return v
            except (TypeError, ValueError):
                pass
    dj = _datajud(record)
    for key in ("valorCausa", "valor"):
        raw = dj.get(key)
        if raw is not None and raw != "":
            try:
                return float(raw)
            except (TypeError, ValueError):
                pass
    return 0.0


def texto_rural(record: dict[str, Any]) -> str:
    chunks = [
        str(record.get("assuntos") or ""),
        str(record.get("vara") or ""),
        str(record.get("comarca") or ""),
        str(record.get("nome_reu") or record.get("empresa") or record.get("executado") or ""),
    ]
    dj = _datajud(record)
    chunks.append(str(dj.get("objeto") or dj.get("assunto") or ""))
    return " ".join(chunks).lower()


def is_rural_producer(record: dict[str, Any]) -> bool:
    t = texto_rural(record)
    return any(kw in t for kw in RURAL_KEYWORDS)


def reus_pj(record: dict[str, Any]) -> list[dict[str, Any]]:
    return [p for p in partes(record) if is_polo_passivo(p) and is_pessoa_juridica(p)]


def reu_passivo(record: dict[str, Any]) -> dict[str, Any] | None:
    for p in partes(record):
        if is_polo_passivo(p):
            return p
    ps = partes(record)
    return ps[0] if ps else None
