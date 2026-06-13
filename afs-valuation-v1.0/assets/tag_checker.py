# ============================================================
# CAMADA 2 — Módulos Funcionais
# assets/tag_checker.py — Confronto número de tag vs. foto
# ============================================================
# TODO: Implementar com Vision API

import logging

logger = logging.getLogger(__name__)


def check_tag(expected_number, image_path, vision_client=None):
    """
    Confronta o número da tag patrimonial esperado com o lido na foto.
    
    Returns:
        dict com:
        - match: True/False
        - read_number: número lido da foto
        - confidence: nível de confiança
    """
    logger.info(
        "[CAMADA 2][assets][tag_checker.check_tag] "
        "Esperado: %s, Imagem: %s", expected_number, image_path
    )
    return {"status": "pending", "message": "Verificação de tag pendente"}
