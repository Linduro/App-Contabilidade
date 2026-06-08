"""Triagem — leads trabalhistas (TRT): réu PJ sem advogado ou capa com classe trabalhista."""

from __future__ import annotations

from typing import Any

from ..config import CAPA_EMPRESA, CLASSES_TRABALHISTA
from ..utils import (
    classe_codigo,
    extract_cnpj_parte,
    has_advogado_passivo,
    is_within_search_window,
    reus_pj,
    tem_partes,
    valor_causa,
)


def _motivo_rejeicao(record: dict[str, Any]) -> str | None:
    if record.get("nivel_sigilo", 0) != 0:
        return "processo_sigiloso"

    cod = classe_codigo(record)
    if cod is not None and cod not in CLASSES_TRABALHISTA:
        return "classe_fora_trabalhista"

    if has_advogado_passivo(record):
        return "advogado_constituido_passivo"

    if not tem_partes(record):
        if cod is None or cod not in CLASSES_TRABALHISTA:
            return "capa_sem_classe_trabalhista"
        return None

    if not reus_pj(record):
        return "sem_reu_pessoa_juridica"

    return None


def _enriquecer(record: dict[str, Any]) -> dict[str, Any]:
    out = dict(record)
    assuntos = str(record.get("assuntos") or "")
    empresa = str(record.get("empresa") or CAPA_EMPRESA)
    cnpj = record.get("cnpj")

    if tem_partes(record):
        reu = reus_pj(record)[0]
        empresa = str(reu.get("nome") or "Empresa não identificada").strip()
        cnpj = extract_cnpj_parte(reu)
        out["capa_datajud"] = False
    else:
        out["capa_datajud"] = True

    out["empresa"] = empresa
    out["cnpj"] = cnpj
    out["valor_causa"] = valor_causa(record)
    out["setor"] = (
        "agro"
        if any(k in f"{empresa} {assuntos}".lower() for k in ("agro", "fazenda", "pecu"))
        else "outros"
    )
    out["sem_movimentacao_posterior"] = record.get("sem_movimentacao_posterior", True)
    out["comarca_interior"] = record.get("comarca_interior", True)
    return out


def triar(records: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    aprovados: list[dict[str, Any]] = []
    motivos: dict[str, int] = {}

    for rec in records:
        if not rec.get("numero_processo"):
            motivos["sem_numero_processo"] = motivos.get("sem_numero_processo", 0) + 1
            continue

        if not is_within_search_window(rec):
            motivos["fora_janela_2_meses"] = motivos.get("fora_janela_2_meses", 0) + 1
            continue

        motivo = _motivo_rejeicao(rec)
        if motivo:
            motivos[motivo] = motivos.get(motivo, 0) + 1
            continue

        item = _enriquecer(rec)
        item["triagem_aprovado"] = True
        item["triagem_modulo"] = "trabalhista"
        aprovados.append(item)

    return aprovados, motivos
