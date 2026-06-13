# ============================================================
# CAMADA 1 — Orquestrador
# orchestrator/error_handler.py — Captura e roteia erros
# ============================================================

import logging
import traceback

logger = logging.getLogger(__name__)

# Mapa de camadas para contexto de erro
LAYER_MAP = {
    "ui": "CAMADA 0",
    "layout": "CAMADA 0",
    "components": "CAMADA 0",
    "orchestrator": "CAMADA 1",
    "manager": "CAMADA 1",
    "pipeline": "CAMADA 1",
    "api": "CAMADA 2",
    "excel": "CAMADA 2",
    "assets": "CAMADA 2",
    "text": "CAMADA 2",
    "db": "CAMADA 3",
}


def identify_layer(module_name):
    """Identifica a camada de origem a partir do nome do módulo."""
    if not module_name:
        return "DESCONHECIDA"
    for key, layer in LAYER_MAP.items():
        if key in module_name:
            return layer
    return "DESCONHECIDA"


def handle_error(error, module_name="", function_name="", context=None):
    """
    Captura, loga e retorna um erro padronizado.
    
    Args:
        error: exceção capturada
        module_name: nome do módulo de origem
        function_name: nome da função de origem
        context: dados adicionais de contexto
    
    Returns:
        dict com informações do erro para a UI
    """
    layer = identify_layer(module_name)
    error_msg = str(error)
    tb = traceback.format_exc()

    logger.error(
        "[%s][%s][%s] %s\n%s",
        layer, module_name, function_name, error_msg, tb
    )

    return {
        "status": "error",
        "layer": layer,
        "module": module_name,
        "function": function_name,
        "message": error_msg,
        "context": context
    }


def safe_execute(func, *args, module_name="", function_name="", **kwargs):
    """
    Executa uma função com tratamento de erro padronizado.
    
    Returns:
        Resultado da função ou dict de erro
    """
    try:
        return func(*args, **kwargs)
    except Exception as e:
        return handle_error(e, module_name, function_name)
