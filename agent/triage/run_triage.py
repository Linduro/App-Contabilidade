#!/usr/bin/env python3
"""
Ponte Node → triagem Python.

Lê JSON { "records": [...] } via stdin; retorna { "records", "stats" }.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Garante import do pacote triagem/
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from triagem.pipeline import executar_triagem  # noqa: E402


def main() -> int:
    if len(sys.argv) < 2:
        print("Uso: run_triage.py <trabalhista|execucoesRurais|execucoesAltoValor>", file=sys.stderr)
        return 2

    modulo = sys.argv[1].strip()
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        print(json.dumps({"error": f"JSON inválido: {exc}", "records": [], "stats": {}}))
        return 1

    records = payload.get("records") or []
    resultado = executar_triagem(modulo, records)
    json.dump(resultado, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
