"""Triagem — execuções alto valor: classes 1116/877/40, valor >= 500k (ou capa pendente), sem advogado."""

from __future__ import annotations

import re
from typing import Any

from ..config import ALTO_VALOR_MIN, CAPA_EXECUTADO, CLASSES_EXECUCAO
from ..utils import (
    classe_codigo,
    extract_doc_parte,
    has_advogado_passivo,
    is_polo_passivo,
    is_within_search_window,
    partes,
    reu_passivo,
    tem_partes,
    valor_causa,
)


def _motivo_rejeicao(record: dict[str, Any]) -> str | None:
    if record.get("nivel_sigilo", 0) != 0:
        return "processo_sigiloso"

    cod = classe_codigo(record)
    if cod is None or cod not in CLASSES_EXECUCAO:
        return "classe_fora_execucao"

    val = valor_causa(record)
    if val > 0 and val < ALTO_VALOR_MIN:
        return "valor_abaixo_minimo"

    if has_advogado_passivo(record):
        return "advogado_constituido_passivo"

    if tem_partes(record):
        reu = reu_passivo(record)
        if not reu:
            return "sem_executado_passivo"
        for p in partes(record):
            if is_polo_passivo(p):
                reps = p.get("advogados") or p.get("representantes") or []
                if isinstance(reps, list) and reps:
                    return "advogado_constituido_passivo"

    return None


def _enriquecer(record: dict[str, Any]) -> dict[str, Any]:
    out = dict(record)
    val = valor_causa(record)

    if tem_partes(record):
        reu = reu_passivo(record) or {}
        executado = str(reu.get("nome") or "Executado não identificado").strip()
        cnpj = extract_doc_parte(reu) or ""
        credor = next((p for p in partes(record) if not is_polo_passivo(p)), None)
        out["executado"] = executado
        out["cnpjCpf"] = cnpj
        out["exequente"] = str(credor.get("nome") or "") if credor else None
        out["tipoExecutado"] = (
            "PJ" if len(cnpj) == 14 or re.search(r"ltda|s\.?a|me\b|eireli", executado, re.I) else "PF"
        )
        out["capaDatajud"] = False
    else:
        out["executado"] = CAPA_EXECUTADO
        out["cnpjCpf"] = ""
        out["exequente"] = None
        out["tipoExecutado"] = "PF"
        out["capaDatajud"] = True
        out["triagem_valor_pendente"] = val <= 0

    out["valorCausa"] = val
    out["temAdvogado"] = False
    out["comarcaInterior"] = record.get("comarcaInterior", True)
    out["cnaeRural"] = record.get("cnaeRural", False)
    out["classeCodigo"] = record.get("classe_codigo") or classe_codigo(record)
    out["classeNome"] = record.get("classe_nome")
    out["ultimoMovimento"] = record.get("ultima_movimentacao") or record.get("ultimoMovimento")
    out["numeroProcesso"] = record.get("numero_processo") or record.get("numeroProcesso")
    out["processo"] = record.get("numero_processo_formatado") or record.get("processo")
    return out


def triar(records: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, int]]:
    aprovados: list[dict[str, Any]] = []
    motivos: dict[str, int] = {}

    for rec in records:
        num = rec.get("numero_processo") or rec.get("numeroProcesso")
        if not num:
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
        item["triagem_modulo"] = "execucoesAltoValor"
        aprovados.append(item)

    return aprovados, motivos
