# ============================================================
# CAMADA 2 — Módulos Funcionais
# excel/validator.py — Validação dinâmica de colunas
# ============================================================

import logging

logger = logging.getLogger(__name__)

# Campos que o sistema precisa para funcionar.
# O usuário mapeia as colunas da planilha para esses campos na interface.
REQUIRED_FIELDS = {
    "tag_original": {
        "label": "Número da Tag (ORIGEM)",
        "description": "Coluna com a tag original colhida na vistoria"
    },
    "tag_output": {
        "label": "Número da Tag (DESTINO / IA)",
        "description": "Coluna para gravar o 'ok' ou novo número da foto"
    },
    "link1": {
        "label": "Link 1 (Destino)",
        "description": "Coluna para gravar o primeiro link de referência"
    },
    "link2": {
        "label": "Link 2 (Destino)",
        "description": "Coluna para gravar o segundo link de referência"
    },
    "desc_original": {
        "label": "Descrição (ORIGEM)",
        "description": "Coluna com a descrição original da vistoria"
    },
    "desc_output": {
        "label": "Descrição e Reasoning (DESTINO / IA)",
        "description": "Ex: Coluna BC - Descrição + Raciocínio"
    },
    "methodology": {
        "label": "Metodologia de Avaliação",
        "description": "Coluna para gravar a metodologia utilizada"
    },
    "value_new": {
        "label": "Valor de Novo",
        "description": "Coluna para gravar o valor do bem novo"
    },
    "value_used": {
        "label": "Valor de Usado / Comparativo Direto",
        "description": "Coluna para gravar o valor de mercado usado"
    },
    "value_fipe": {
        "label": "Valor FIPE",
        "description": "Coluna para gravar o valor da tabela FIPE (veículos)"
    },
    "age_original": {
        "label": "Idade Aparente (ORIGEM)",
        "description": "Coluna com a idade coletada na vistoria"
    },
    "age_output": {
        "label": "Idade Aparente (DESTINO / IA)",
        "description": "Coluna para gravar a validação da idade pela foto"
    },
    "conservation_original": {
        "label": "Estado de Conservação (ORIGEM)",
        "description": "Coluna com a conservação coletada na vistoria"
    },
    "conservation_output": {
        "label": "Estado de Conservação (DESTINO / IA)",
        "description": "Coluna para gravar a validação da conservação pela foto"
    },
}

OPTIONAL_FIELDS = {
    "control": {
        "label": "ID de Controle (Principal)",
        "description": "Coluna de identificação única do item na planilha"
    },
    "asset_output": {
        "label": "Ativo (DESTINO / IA)",
        "description": "Coluna para gravar o nome simplificado e normalizado do bem (ex: cadeira, mesa)"
    },
    "category_output": {
        "label": "Categoria (DESTINO / IA)",
        "description": "Coluna para gravar a categoria ampla do bem (ex: mobiliário, TI, veículos)"
    },
    "link1": {
        "label": "Link da Pesquisa 1",
        "description": "Coluna para gravar o link do primeiro comparativo"
    },
    "link2": {
        "label": "Link da Pesquisa 2",
        "description": "Coluna para gravar o link do segundo comparativo"
    },
    "photo_original": {
        "label": "Foto do Ativo",
        "description": "Coluna com o link da imagem original da vistoria"
    },
    "photo_spec": {
        "label": "Foto Especificações",
        "description": "Coluna com o link da foto de especificações do bem"
    },
    "photo_tag": {
        "label": "Foto da TAG",
        "description": "Coluna com o link da foto da plaqueta/tag do bem"
    }
}


def get_required_fields():
    """Retorna a lista de campos obrigatórios para mapeamento."""
    return REQUIRED_FIELDS.copy()


def get_optional_fields():
    """Retorna a lista de campos opcionais para mapeamento."""
    return OPTIONAL_FIELDS.copy()


def get_all_fields():
    """Retorna todos os campos (obrigatórios + opcionais)."""
    all_fields = {}
    all_fields.update(REQUIRED_FIELDS)
    all_fields.update(OPTIONAL_FIELDS)
    return all_fields


def validate_mappings(mappings):
    """
    Valida se todos os campos obrigatórios foram mapeados.
    
    Args:
        mappings: dict {field_name: column_letter}
    
    Returns:
        dict com status e lista de campos faltantes
    """
    try:
        missing = []
        for field_name in REQUIRED_FIELDS:
            if field_name not in mappings or not mappings[field_name]:
                missing.append({
                    "field": field_name,
                    "label": REQUIRED_FIELDS[field_name]["label"]
                })

        if missing:
            return {
                "status": "incomplete",
                "missing": missing,
                "message": f"{len(missing)} campo(s) obrigatório(s) não mapeado(s)"
            }

        return {"status": "ok", "message": "Todos os campos obrigatórios mapeados"}

    except Exception as e:
        logger.error("[CAMADA 2][excel][validator.validate_mappings] %s", str(e))
        return {"status": "error", "message": str(e)}
