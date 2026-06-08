"""Orquestra triagem por módulo."""

from __future__ import annotations

from typing import Any

from .config import MODULOS_VALIDOS
from .modulos.alto_valor import triar as triar_alto_valor
from .modulos.rurais import triar as triar_rurais
from .modulos.trabalhista import triar as triar_trabalhista

_HANDLERS = {
    "trabalhista": triar_trabalhista,
    "execucoesRurais": triar_rurais,
    "execucoesAltoValor": triar_alto_valor,
}


def executar_triagem(modulo: str, records: list[dict[str, Any]]) -> dict[str, Any]:
    if modulo not in MODULOS_VALIDOS:
        raise ValueError(f"Módulo inválido: {modulo}. Use: {', '.join(sorted(MODULOS_VALIDOS))}")

    handler = _HANDLERS[modulo]
    aprovados, motivos = handler(records)
    rejeitados = len(records) - len(aprovados)

    return {
        "records": aprovados,
        "stats": {
            "modulo": modulo,
            "total": len(records),
            "aprovados": len(aprovados),
            "rejeitados": rejeitados,
            "motivos_rejeicao": motivos,
        },
    }
