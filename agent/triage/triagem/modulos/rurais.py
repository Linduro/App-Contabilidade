"""Triagem — execuções rurais: classe de execução ou indicadores rurais; sem advogado no passivo."""

from __future__ import annotations

import re
from typing import Any

from ..config import CAPA_EMPRESA, CLASSES_EXECUCAO
from ..utils import (
    classe_codigo,
    has_advogado_passivo,
    is_polo_passivo,
    is_rural_producer,
    reu_passivo,
    tem_partes,
    texto_rural,
    valor_causa,
)


def _motivo_rejeicao(record: dict[str, Any]) -> str | None:
    if record.get("nivel_sigilo", 0) != 0:
        return "processo_sigiloso"

    cod = classe_codigo(record)
    exec_class = cod is not None and cod in CLASSES_EXECUCAO
    rural = is_rural_producer(record)

    if not exec_class and not rural:
        return "nao_rural_nem_execucao"

    if has_advogado_passivo(record):
        return "advogado_constituido_passivo"

    if tem_partes(record):
        reu = reu_passivo(record)
        if not reu:
            return "sem_parte_passiva"
        nome = str(reu.get("nome") or "").strip()
        if not rural and not exec_class:
            return "reu_sem_perfil_rural"

    return None


def _enriquecer(record: dict[str, Any]) -> dict[str, Any]:
    out = dict(record)
    texto = texto_rural(record)

    if tem_partes(record):
        reu = reu_passivo(record) or {}
        nome = str(reu.get("nome") or "Réu não identificado").strip()
        out["nome_reu"] = nome
        out["tipo_reu"] = (
            "PJ" if re.search(r"ltda|s\.?a|me\b|eireli|cnpj", nome, re.I) else "PF"
        )
        credor = next((p for p in (record.get("partes") or []) if not is_polo_passivo(p)), None)
        out["credor_exequente"] = str(credor.get("nome") or "") if credor else None
        out["capa_datajud"] = False
    else:
        out["nome_reu"] = CAPA_EMPRESA
        out["tipo_reu"] = "PF"
        out["credor_exequente"] = None
        out["capa_datajud"] = True

    out["valor_execucao"] = valor_causa(record)
    out["tem_advogado"] = False
    out["texto_rural"] = texto
    out["imoveis_rurais"] = record.get("imoveis_rurais") or []
    out["municipio_imovel"] = record.get("municipio_imovel") or record.get("comarca")
    return out


def triar(records: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    aprovados: list[dict[str, Any]] = []
    motivos: dict[str, int] = {}

    for rec in records:
        if not rec.get("numero_processo"):
            motivos["sem_numero_processo"] = motivos.get("sem_numero_processo", 0) + 1
            continue

        motivo = _motivo_rejeicao(rec)
        if motivo:
            motivos[motivo] = motivos.get(motivo, 0) + 1
            continue

        item = _enriquecer(rec)
        item["triagem_aprovado"] = True
        item["triagem_modulo"] = "execucoesRurais"
        aprovados.append(item)

    return aprovados, motivos
