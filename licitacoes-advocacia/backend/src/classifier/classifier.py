"""
Classificador de especialidades jurídicas com spaCy (pt_core_news_sm).
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from functools import lru_cache
from typing import TypedDict

import spacy

MIN_CONFIDENCE_DEFAULT = 0.3

ESPECIALIDADES: dict[str, dict[str, list[str]]] = {
    "responsabilidade_civil": {
        "keywords": [
            "indenização",
            "indenizacao",
            "danos",
            "dano moral",
            "dano material",
            "sinistro",
            "responsabilidade civil",
            "reparação",
            "reparacao",
        ],
    },
    "banking_law": {
        "keywords": [
            "banco",
            "bancário",
            "bancario",
            "financeira",
            "crédito",
            "credito",
            "hipoteca",
            "financiamento",
            "instituição financeira",
            "instituicao financeira",
        ],
    },
    "tributario": {
        "keywords": [
            "imposto",
            "tributo",
            "tributário",
            "tributario",
            "icms",
            "iss",
            "declaração",
            "declaracao",
            "fiscal",
            "tributação",
            "tributacao",
        ],
    },
    "administrativo": {
        "keywords": [
            "contrato",
            "edital",
            "licitação",
            "licitacao",
            "pregão",
            "pregao",
            "concorrência",
            "concorrencia",
            "administrativo",
            "contratação pública",
            "contratacao publica",
        ],
    },
    "security": {
        "keywords": [
            "inss",
            "benefício",
            "beneficio",
            "perícia",
            "pericia",
            "aposentadoria",
            "previdenciário",
            "previdenciario",
            "auxílio",
            "auxilio",
            "seguro social",
        ],
    },
}


class EspecialidadeResult(TypedDict):
    especialidade: str
    score: float


@lru_cache(maxsize=1)
def _load_nlp():
    return spacy.load("pt_core_news_sm")


def _normalize(text: str) -> str:
    lowered = text.lower()
    decomposed = unicodedata.normalize("NFD", lowered)
    return "".join(
        char for char in decomposed if unicodedata.category(char) != "Mn"
    )


def _score_especialidade(
    doc: spacy.tokens.Doc,
    texto_normalizado: str,
    keywords: list[str],
) -> float:
    token_lemmas = {
        _normalize(token.lemma_)
        for token in doc
        if not token.is_space and not token.is_punct
    }
    token_text = {
        _normalize(token.text)
        for token in doc
        if not token.is_space and not token.is_punct
    }

    matched_keywords: set[str] = set()
    phrase_hits = 0

    for keyword in keywords:
        keyword_norm = _normalize(keyword)

        if not keyword_norm:
            continue

        if " " in keyword_norm:
            if keyword_norm in texto_normalizado:
                matched_keywords.add(keyword_norm)
                phrase_hits += 1
            continue

        if keyword_norm in token_lemmas or keyword_norm in token_text:
            matched_keywords.add(keyword_norm)
            continue

        if re.search(rf"\b{re.escape(keyword_norm)}\b", texto_normalizado):
            matched_keywords.add(keyword_norm)

    if not matched_keywords:
        return 0.0

    coverage = len(matched_keywords) / len(keywords)
    density = min(1.0, len(matched_keywords) / 3)
    phrase_bonus = min(0.2, phrase_hits * 0.1)

    score = (coverage * 0.55) + (density * 0.3) + phrase_bonus
    return min(1.0, score)


def classificar(
    texto: str,
    min_confidence: float = MIN_CONFIDENCE_DEFAULT,
) -> list[EspecialidadeResult]:
    """
    Identifica especialidades jurídicas presentes no texto.

    Retorna lista ordenada por score decrescente, ignorando scores < min_confidence.
    """
    if not texto or not texto.strip():
        return []

    nlp = _load_nlp()
    doc = nlp(texto)
    texto_normalizado = _normalize(texto)

    resultados: list[EspecialidadeResult] = []

    for especialidade, config in ESPECIALIDADES.items():
        score = _score_especialidade(
            doc,
            texto_normalizado,
            config["keywords"],
        )

        if score >= min_confidence:
            resultados.append(
                {
                    "especialidade": especialidade,
                    "score": round(score, 4),
                }
            )

    resultados.sort(key=lambda item: item["score"], reverse=True)
    return resultados


def _run_cli() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        print(
            json.dumps({"error": "JSON inválido na entrada."}, ensure_ascii=False),
            file=sys.stderr,
        )
        return 1

    texto = payload.get("texto", "")
    min_confidence = float(payload.get("min_confidence", MIN_CONFIDENCE_DEFAULT))

    try:
        especialidades = classificar(texto, min_confidence=min_confidence)
    except OSError as error:
        print(
            json.dumps(
                {
                    "error": (
                        "Modelo spaCy não encontrado. Execute: "
                        "python -m spacy download pt_core_news_sm"
                    ),
                    "detail": str(error),
                },
                ensure_ascii=False,
            ),
            file=sys.stderr,
        )
        return 2
    except Exception as error:  # noqa: BLE001 — expor erro ao processo pai
        print(
            json.dumps({"error": str(error)}, ensure_ascii=False),
            file=sys.stderr,
        )
        return 3

    print(json.dumps({"especialidades": especialidades}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(_run_cli())
