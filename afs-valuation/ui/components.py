# ============================================================
# CAMADA 0 — Servidor & Interface
# ui/components.py — Elementos visuais reutilizáveis
# ============================================================

import logging

logger = logging.getLogger(__name__)


def status_badge(status, message=""):
    """Gera HTML de badge de status."""
    icons = {
        "ok": "✓",
        "error": "✗",
        "pending": "⏳",
        "warning": "⚠",
    }
    icon = icons.get(status, "?")
    return f'<span class="badge badge-{status}">{icon} {message}</span>'


def format_currency(value, currency="BRL"):
    """Formata valor monetário."""
    if value is None:
        return "—"
    try:
        if currency == "BRL":
            return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        return f"$ {value:,.2f}"
    except (ValueError, TypeError):
        return str(value)
