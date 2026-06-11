# ============================================================
# CAMADA 1 — Orquestrador
# orchestrator/manager.py — Decide quem chama quem e em que ordem
# ============================================================

import os
import logging
import shutil
from orchestrator.error_handler import handle_error, safe_execute

logger = logging.getLogger(__name__)

# Diretório de uploads
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Estado da sessão (in-memory para localhost single-user)
_session_state = {
    "api_key": None,
    "spreadsheet_path": None,
    "spreadsheet_data": None,
    "column_mappings": {},
    "initialized": False,
}


def get_session_state():
    """Retorna o estado atual da sessão."""
    if not _session_state.get("column_mappings"):
        load_saved_mappings()
    return _session_state.copy()


def set_api_key(api_key):
    """Configura a chave de API e atualiza os clients."""
    try:
        _session_state["api_key"] = api_key

        # Configurar os clients de API (import condicional para resiliência)
        try:
            from api.gemini_client import gemini_client
            gemini_client.configure(api_key)
        except ImportError:
            logger.warning("[CAMADA 1][manager] gemini_client não disponível")

        try:
            from api.search_client import search_client
            search_client.configure(api_key)
        except ImportError:
            logger.warning("[CAMADA 1][manager] search_client não disponível")

        try:
            from api.vision_client import vision_client
            vision_client.configure(api_key)
        except ImportError:
            logger.warning("[CAMADA 1][manager] vision_client não disponível")

        # Salvar no banco de dados
        try:
            from db.queries import save_config
            save_config("google_api_key", api_key)
        except ImportError:
            logger.warning("[CAMADA 1][manager] db.queries não disponível")

        logger.info("[CAMADA 1][manager][set_api_key] Chave configurada com sucesso")
        return {"status": "ok", "message": "Chave de API configurada"}
    except Exception as e:
        return handle_error(e, "manager", "set_api_key")


def test_api_connections():
    """Testa conectividade de todas as APIs."""
    results = {}

    # Gemini
    try:
        from api.gemini_client import gemini_client
        results["gemini"] = gemini_client.test_connection()
    except ImportError:
        results["gemini"] = {"status": "error", "message": "Módulo não disponível"}
    except Exception as e:
        results["gemini"] = {"status": "error", "message": str(e)}

    # Search
    try:
        from api.search_client import search_client
        results["search"] = search_client.test_connection()
    except ImportError:
        results["search"] = {"status": "error", "message": "Módulo não disponível"}
    except Exception as e:
        results["search"] = {"status": "error", "message": str(e)}

    # Vision
    try:
        from api.vision_client import vision_client
        results["vision"] = vision_client.test_connection()
    except ImportError:
        results["vision"] = {"status": "error", "message": "Módulo não disponível"}
    except Exception as e:
        results["vision"] = {"status": "error", "message": str(e)}

    logger.info("[CAMADA 1][manager][test_api_connections] Resultados: %s",
                {k: v["status"] for k, v in results.items()})
    return results


def process_upload(file_storage):
    """
    Processa o upload de uma planilha Excel.
    
    Args:
        file_storage: objeto FileStorage do Flask
    
    Returns:
        dict com headers e preview dos dados
    """
    try:
        filename = file_storage.filename
        if not filename.endswith(('.xlsx', '.xls')):
            return {"status": "error", "message": "Formato inválido. Envie um arquivo .xlsx"}

        # Salvar arquivo
        filepath = os.path.join(UPLOAD_DIR, filename)
        file_storage.save(filepath)

        # Ler headers e preview
        from excel.reader import get_preview
        result = get_preview(filepath)

        if result["status"] == "ok":
            _session_state["spreadsheet_path"] = filepath
            _session_state["spreadsheet_data"] = result
            _session_state["sheet_index"] = result.get("best_sheet_idx", 0)
            logger.info(
                "[CAMADA 1][manager][process_upload] "
                "Planilha carregada: %s (%d linhas, %d colunas, aba %d)",
                filename, result["total_rows"], len(result["headers"]), result.get("best_sheet_idx", 0)
            )

        return result

    except Exception as e:
        return handle_error(e, "manager", "process_upload")


def save_column_mappings(mappings):
    """
    Salva os mapeamentos de coluna definidos pelo usuário.
    
    Args:
        mappings: dict {field_name: column_letter}
    """
    try:
        # Validar
        from excel.validator import validate_mappings
        validation = validate_mappings(mappings)

        if validation["status"] == "ok" or validation["status"] == "incomplete":
            # Salvar no banco
            try:
                from db.queries import save_column_mapping, clear_column_mappings
                clear_column_mappings()
                for field_name, col_letter in mappings.items():
                    if col_letter:
                        # Encontrar o index da coluna
                        from openpyxl.utils import column_index_from_string
                        col_index = column_index_from_string(col_letter)
                        save_column_mapping(field_name, col_letter, col_index)
            except ImportError:
                logger.warning("[CAMADA 1][manager] db.queries não disponível para salvar mapeamentos")

            _session_state["column_mappings"] = mappings

        return validation

    except Exception as e:
        return handle_error(e, "manager", "save_column_mappings")


def finalize_initialization():
    """Marca a inicialização como concluída se tudo estiver pronto."""
    state = _session_state
    issues = []

    if not state["api_key"]:
        issues.append("Chave de API não configurada")
    if not state["spreadsheet_path"]:
        issues.append("Planilha não carregada")
    if not state["column_mappings"]:
        issues.append("Mapeamento de colunas não definido")

    if issues:
        return {
            "status": "incomplete",
            "issues": issues,
            "message": f"{len(issues)} item(ns) pendente(s)"
        }

    _session_state["initialized"] = True
    logger.info("[CAMADA 1][manager][finalize_initialization] Inicialização concluída")
    return {"status": "ok", "message": "Sistema inicializado com sucesso"}


def get_spreadsheet_data():
    """Retorna os dados da planilha carregada."""
    if not _session_state["spreadsheet_path"]:
        return {"status": "error", "message": "Nenhuma planilha carregada"}

    try:
        from excel.reader import read_data
        return read_data(
            _session_state["spreadsheet_path"],
            sheet_index=_session_state.get("sheet_index", 0),
            header_row=_session_state["spreadsheet_data"]["header_row"],
            column_mappings=_session_state.get("column_mappings")
        )
    except Exception as e:
        return handle_error(e, "manager", "get_spreadsheet_data")


def load_saved_api_key():
    """Tenta carregar a chave de API salva no banco."""
    try:
        from db.queries import get_config
        saved_key = get_config("google_api_key")
        if saved_key:
            set_api_key(saved_key)
            return saved_key
    except Exception:
        pass
    return None


def load_saved_mappings():
    """Carrega os mapeamentos do banco para a sessão em formato plano."""
    try:
        from db.queries import get_column_mappings
        db_mappings = get_column_mappings()
        if db_mappings:
            flat = {}
            for field, info in db_mappings.items():
                if isinstance(info, dict) and "letter" in info:
                    flat[field] = info["letter"]
                else:
                    flat[field] = info
            _session_state["column_mappings"] = flat
            logger.info("[CAMADA 1][manager] Mapeamentos de colunas carregados do banco: %s", flat)
            return flat
    except Exception as e:
        logger.warning("[CAMADA 1][manager] Não foi possível carregar mapeamentos do banco: %s", str(e))
    return {}


def load_latest_spreadsheet():
    """Tenta carregar a planilha mais recente do diretório de uploads."""
    try:
        if not os.path.exists(UPLOAD_DIR):
            return None
        files = [os.path.join(UPLOAD_DIR, f) for f in os.listdir(UPLOAD_DIR) if f.endswith(('.xlsx', '.xls'))]
        if not files:
            return None
        # Pegar o arquivo modificado mais recentemente
        latest_file = max(files, key=os.path.getmtime)
        
        from excel.reader import get_preview
        result = get_preview(latest_file)
        if result["status"] == "ok":
            _session_state["spreadsheet_path"] = latest_file
            _session_state["spreadsheet_data"] = result
            _session_state["sheet_index"] = result.get("best_sheet_idx", 0)
            logger.info("[CAMADA 1][manager] Planilha mais recente carregada automaticamente: %s", os.path.basename(latest_file))
            return latest_file
    except Exception as e:
        logger.warning("[CAMADA 1][manager] Não foi possível carregar a planilha mais recente: %s", str(e))
    return None


def initialize_session_from_saved_data():
    """Inicializa a sessão com os dados salvos no banco e a planilha mais recente."""
    load_saved_api_key()
    load_saved_mappings()
    load_latest_spreadsheet()
    
    # Se tudo estiver pronto, marcar como inicializado
    state = _session_state
    if state["api_key"] and state["spreadsheet_path"] and state["column_mappings"]:
        state["initialized"] = True
        logger.info("[CAMADA 1][manager] Sessão auto-inicializada com sucesso")


def run_evaluation_loop(model_name, run_tag, run_age, run_conservation, run_market):
    """Executa a avaliação linha a linha e emite eventos SSE."""
    if not _session_state["spreadsheet_path"]:
        yield {"status": "Erro: Planilha não carregada", "row": 0}
        return

    try:
        from excel.reader import read_data
        from db.queries import get_column_mappings
        from orchestrator.pipeline import pipeline
        
        # Obter os dados completos da planilha atual
        header_row = _session_state.get("spreadsheet_data", {}).get("header_row", 1)
        sheet_index = _session_state.get("sheet_index", 0)
        column_mappings = get_column_mappings()
        
        data = read_data(
            _session_state["spreadsheet_path"],
            sheet_index=sheet_index,
            header_row=header_row,
            column_mappings=column_mappings
        )
        
        if data["status"] != "ok":
            yield {"status": f"Erro leitura: {data.get('message')}", "row": 0}
            return
            
        rows = data["rows"]

        # Fila para eventos assíncronos gerados pela pipeline
        import queue
        event_queue = queue.Queue()

        def emit_event(event_data):
            event_queue.put(event_data)

        # Usar uma thread para que possamos emitir eventos não bloqueantes via gerador
        import threading
        
        # Iniciar worker com kwargs nominais
        eval_thread = threading.Thread(
            target=pipeline.process_spreadsheet,
            kwargs={
                "filepath": _session_state["spreadsheet_path"],
                "sheet_index": sheet_index,
                "rows": rows,
                "column_mappings": column_mappings,
                "model_name": model_name,
                "update_callback": emit_event,
                "run_tag": run_tag,
                "run_age": run_age,
                "run_conservation": run_conservation,
                "run_market": run_market
            }
        )
        eval_thread.start()

        # Consumir a fila
        while eval_thread.is_alive() or not event_queue.empty():
            try:
                event = event_queue.get(timeout=0.5)
                yield event
            except queue.Empty:
                continue

    except Exception as e:
        logger.error("[CAMADA 1][manager][run_evaluation_loop] %s", str(e))
        yield {"status": f"Erro Orquestrador: {str(e)}", "row": 0}


def pause_evaluation_loop():
    """Pausa a pipeline."""
    try:
        from orchestrator.pipeline import pipeline
        pipeline.pause()
    except Exception as e:
        logger.error("[CAMADA 1][manager][pause_evaluation_loop] %s", str(e))
