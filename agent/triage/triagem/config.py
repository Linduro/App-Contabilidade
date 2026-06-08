"""
Constantes compartilhadas — espelham critérios do produto (TPU / execução / valor).
"""

from __future__ import annotations

# Trabalhista — classes com dados no Datajud (TRT)
CLASSES_TRABALHISTA: frozenset[int] = frozenset(
    {
        985,   # Ação Trabalhista - Rito Ordinário
        1125,  # Ação Trabalhista
        872,   # Execução Trabalhista
        993,   # Cumprimento de Sentença
        994,
        991,   # ACP Trabalhista
        120,   # Mandado de Segurança Trabalhista
        1225,
        1236,
        2342,
        154,
    }
)

CLASSES_EXECUCAO: frozenset[int] = frozenset({1116, 877, 40})

ALTO_VALOR_MIN: float = 500_000.0

RURAL_KEYWORDS: tuple[str, ...] = (
    "produtor rural",
    "agropecu",
    "fazenda",
    "sitio",
    "sítio",
    "chácara",
    "chacara",
    "nirf",
    "lavoura",
    "pecuária",
    "pecuaria",
    "agrícola",
    "agricola",
    "extrativismo",
    "silvicultura",
)

MODULOS_VALIDOS: frozenset[str] = frozenset(
    {"trabalhista", "execucoesRurais", "execucoesAltoValor"}
)

SEARCH_DAYS = 60

CAPA_EMPRESA = "Réu a identificar (capa Datajud)"
CAPA_EXECUTADO = "Executado a identificar (capa Datajud)"
