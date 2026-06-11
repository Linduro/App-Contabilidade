# ============================================================
# CAMADA 2 — Módulos Funcionais
# api/vision_client.py — Google Vision API (leitura de fotos de tag)
# ============================================================

import logging

logger = logging.getLogger(__name__)


class VisionClient:
    """Cliente para leitura de fotos de tags patrimoniais via Google Vision."""

    def __init__(self, api_key=None):
        self.api_key = api_key

    def configure(self, api_key):
        """Configura o cliente com a chave de API."""
        self.api_key = api_key

    def test_connection(self):
        """Testa conectividade com a API Vision."""
        if not self.api_key:
            return {"status": "error", "message": "Chave de API não configurada"}
        # TODO: implementar teste real
        return {"status": "pending", "message": "Vision API — teste pendente de implementação"}

    def read_tag_number(self, image_path):
        """Lê o número da tag patrimonial de uma foto."""
        # TODO: implementar com Google Vision OCR
        logger.info("[CAMADA 2][api][vision.read_tag_number] Imagem: %s", image_path)
        return {"status": "pending", "message": "Leitura de tag ainda não implementada"}


# Instância singleton
vision_client = VisionClient()
