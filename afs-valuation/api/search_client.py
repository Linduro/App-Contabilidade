# ============================================================
# CAMADA 2 — Pesquisa via Gemini + Google Search Grounding
# api/search_client.py
# ============================================================

import logging

logger = logging.getLogger(__name__)


class SearchClient:
    """Pesquisa de comparativos via Gemini com grounding (mesma chave de API)."""

    def __init__(self, api_key=None, cx=None):
        self.api_key = api_key
        self.cx = cx

    def configure(self, api_key, cx=None):
        self.api_key = api_key
        if cx:
            self.cx = cx

    def test_connection(self):
        if not self.api_key:
            return {"status": "error", "message": "Chave de API não configurada"}
        try:
            from api.gemini_client import gemini_client
            gemini_client.configure(self.api_key, model_name="gemini-2.5-flash")
            result = gemini_client.test_connection()
            if result.get("status") == "ok":
                return {"status": "ok", "message": "Search via Gemini Grounding (mesma chave)"}
            return result
        except Exception as e:
            logger.error("[search_client.test_connection] %s", e)
            return {"status": "error", "message": str(e)}

    def search(self, query, num_results=5):
        try:
            from api.gemini_client import gemini_client
            return gemini_client.search_comparables(query, num_results=num_results)
        except Exception as e:
            logger.error("[search_client.search] %s", e)
            return {"status": "error", "message": str(e)}


search_client = SearchClient()
