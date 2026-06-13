# ============================================================
# CAMADA 2 — Vision via Gemini (melhor custo-benefício)
# api/vision_client.py
# ============================================================

import logging

logger = logging.getLogger(__name__)


class VisionClient:
    """Vision delegada ao Gemini multimodal (Flash) — mesma chave, sem Vision API separada."""

    def __init__(self, api_key=None):
        self.api_key = api_key

    def configure(self, api_key):
        self.api_key = api_key

    def test_connection(self):
        if not self.api_key:
            return {"status": "error", "message": "Chave de API não configurada"}
        try:
            from api.gemini_client import gemini_client
            gemini_client.configure(self.api_key, model_name="gemini-2.5-flash")
            return gemini_client.test_connection()
        except Exception as e:
            logger.error("[vision_client.test_connection] %s", e)
            return {"status": "error", "message": str(e)}

    def read_tag_number(self, image_path):
        try:
            from api.gemini_client import gemini_client
            return gemini_client.analyze_image_for_tag(image_path)
        except Exception as e:
            return {"status": "error", "message": str(e)}


vision_client = VisionClient()
