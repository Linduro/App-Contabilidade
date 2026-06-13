"""Normalização de telefone e e-mail institucional (Brasil)."""

from __future__ import annotations

import re

EMAIL_RE = re.compile(
    r"^[a-z0-9][a-z0-9._%+-]*@[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$",
    re.I,
)
DDD_VALIDOS = {
    "11", "12", "13", "14", "15", "16", "17", "18", "19",
    "21", "22", "24", "27", "28",
    "31", "32", "33", "34", "35", "37", "38",
    "41", "42", "43", "44", "45", "46", "47", "48", "49",
    "51", "53", "54", "55",
    "61", "62", "63", "64", "65", "66", "67", "68", "69",
    "71", "73", "74", "75", "77", "79",
    "81", "82", "83", "84", "85", "86", "87", "88", "89",
    "91", "92", "93", "94", "95", "96", "97", "98", "99",
}

INSTITUTIONAL_PREFIXES = (
    "contato", "comercial", "vendas", "sac", "atendimento",
    "financeiro", "faturamento", "info", "ouvidoria", "administrativo",
)


def normalize_cnpj_basico(cnpj: str) -> str:
    digits = "".join(ch for ch in str(cnpj or "") if ch.isdigit())
    if len(digits) >= 14:
        return digits[:8]
    return digits.zfill(8)[:8]


def normalize_cnpj_completo(cnpj: str) -> str:
    digits = "".join(ch for ch in str(cnpj or "") if ch.isdigit())
    if len(digits) == 14:
        return digits
    if len(digits) == 8:
        return digits + "000100"
    return digits.zfill(14)[:14]


def normalize_email(raw: str | None) -> str | None:
    if not raw:
        return None
    email = raw.strip().lower()
    if not email or "@" not in email:
        return None
    if not EMAIL_RE.match(email):
        return None
    local, domain = email.rsplit("@", 1)
    if any(x in local for x in ("noreply", "no-reply", "donotreply")):
        return None
    return email


def normalize_phone(raw: str | None, ddd: str | None = None) -> str | None:
    if not raw and not ddd:
        return None
    combined = f"{ddd or ''}{raw or ''}"
    digits = "".join(ch for ch in combined if ch.isdigit())
    if len(digits) == 10:
        ddd_n, num = digits[:2], digits[2:]
    elif len(digits) == 11 and digits[2] == "9":
        ddd_n, num = digits[:2], digits[2:]
    elif len(digits) >= 10:
        ddd_n, num = digits[-10:-8], digits[-8:]
    else:
        return None
    if ddd_n not in DDD_VALIDOS:
        return None
    if len(num) not in (8, 9):
        return None
    return f"({ddd_n}) {num[:4]}-{num[4:]}"


def is_institutional_email(email: str) -> bool:
    local = email.split("@")[0].lower()
    return any(local.startswith(p) for p in INSTITUTIONAL_PREFIXES) or local in INSTITUTIONAL_PREFIXES
