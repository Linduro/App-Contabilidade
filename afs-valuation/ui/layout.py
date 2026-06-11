# ============================================================
# CAMADA 0 — Servidor & Interface
# ui/layout.py — Blueprint com rotas da aplicação
# ============================================================
# REGRA: Nenhuma lógica de negócio aqui. Apenas roteamento.

import logging
from flask import Blueprint, render_template, request, jsonify

logger = logging.getLogger(__name__)

main_bp = Blueprint('main', __name__)


@main_bp.route('/')
def index():
    """Renderiza a página principal com abas."""
    return render_template('index.html')


@main_bp.route('/api/set-key', methods=['POST'])
def set_api_key():
    """Configura a chave de API."""
    try:
        data = request.get_json()
        api_key = data.get('api_key', '').strip()

        if not api_key:
            return jsonify({"status": "error", "message": "Chave de API vazia"}), 400

        from orchestrator.manager import set_api_key as mgr_set_key
        result = mgr_set_key(api_key)
        return jsonify(result)

    except Exception as e:
        logger.error("[CAMADA 0][layout][set_api_key] %s", str(e))
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route('/api/test-keys', methods=['POST'])
def test_keys():
    """Testa conectividade de todas as APIs."""
    try:
        from orchestrator.manager import test_api_connections
        results = test_api_connections()
        return jsonify(results)
    except Exception as e:
        logger.error("[CAMADA 0][layout][test_keys] %s", str(e))
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route('/api/upload', methods=['POST'])
def upload_spreadsheet():
    """Recebe upload da planilha Excel."""
    try:
        if 'file' not in request.files:
            return jsonify({"status": "error", "message": "Nenhum arquivo enviado"}), 400

        file = request.files['file']
        if not file.filename:
            return jsonify({"status": "error", "message": "Arquivo sem nome"}), 400

        from orchestrator.manager import process_upload
        result = process_upload(file)

        if result["status"] == "ok":
            return jsonify(result)
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error("[CAMADA 0][layout][upload_spreadsheet] %s", str(e))
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route('/api/column-mappings', methods=['POST'])
def save_mappings():
    """Salva os mapeamentos de colunas definidos pelo usuário."""
    try:
        data = request.get_json()
        mappings = data.get('mappings', {})

        from orchestrator.manager import save_column_mappings
        result = save_column_mappings(mappings)
        return jsonify(result)

    except Exception as e:
        logger.error("[CAMADA 0][layout][save_mappings] %s", str(e))
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route('/api/finalize-init', methods=['POST'])
def finalize_init():
    """Finaliza a inicialização do sistema."""
    try:
        from orchestrator.manager import finalize_initialization
        result = finalize_initialization()
        return jsonify(result)
    except Exception as e:
        logger.error("[CAMADA 0][layout][finalize_init] %s", str(e))
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route('/api/session-state', methods=['GET'])
def session_state():
    """Retorna o estado atual da sessão."""
    try:
        from orchestrator.manager import get_session_state
        state = get_session_state()
        # Não expor a chave de API no frontend
        safe_state = {
            "has_api_key": bool(state.get("api_key")),
            "has_spreadsheet": bool(state.get("spreadsheet_path")),
            "has_mappings": bool(state.get("column_mappings")),
            "initialized": state.get("initialized", False),
            "column_mappings": state.get("column_mappings", {})
        }
        return jsonify(safe_state)
    except Exception as e:
        logger.error("[CAMADA 0][layout][session_state] %s", str(e))
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route('/api/spreadsheet-data', methods=['GET'])
def get_spreadsheet_data_route():
    """Retorna os dados da planilha carregada."""
    try:
        from orchestrator.manager import get_spreadsheet_data
        result = get_spreadsheet_data()
        return jsonify(result)
    except Exception as e:
        logger.error("[CAMADA 0][layout][get_spreadsheet_data_route] %s", str(e))
        return jsonify({"status": "error", "message": str(e)}), 500

@main_bp.route('/api/fields', methods=['GET'])
def get_fields():
    """Retorna os campos disponíveis para mapeamento."""
    try:
        from excel.validator import get_required_fields, get_optional_fields
        return jsonify({
            "required": get_required_fields(),
            "optional": get_optional_fields()
        })
    except Exception as e:
        logger.error("[CAMADA 0][layout][get_fields] %s", str(e))
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route('/api/start-evaluation', methods=['GET'])
def start_evaluation():
    """Inicia a avaliação e transmite progresso via SSE."""
    from flask import Response, stream_with_context
    import json
    
    model = request.args.get('model', 'gemini-1.5-flash-latest')
    run_tag = request.args.get('run_tag', 'true') == 'true'
    run_age = request.args.get('run_age', 'true') == 'true'
    run_conservation = request.args.get('run_conservation', 'true') == 'true'
    run_market = request.args.get('run_market', 'true') == 'true'

    def generate():
        from orchestrator.manager import run_evaluation_loop
        for event in run_evaluation_loop(model, run_tag, run_age, run_conservation, run_market):
            yield f"data: {json.dumps(event)}\n\n"
        
        yield f"data: {json.dumps({'status': 'finished'})}\n\n"

    return Response(stream_with_context(generate()), mimetype='text/event-stream')


@main_bp.route('/api/pause-evaluation', methods=['POST'])
def pause_evaluation():
    """Pausa a execução do pipeline de avaliação."""
    from orchestrator.manager import pause_evaluation_loop
    pause_evaluation_loop()
    return jsonify({"status": "ok"})


@main_bp.route('/api/evaluation/<int:eval_id>', methods=['GET'])
def get_evaluation_data(eval_id):
    """Busca os detalhes de uma avaliação e seus dados."""
    try:
        from db.queries import get_evaluation
        evaluation = get_evaluation(eval_id)
        if evaluation:
            return jsonify({"status": "ok", "evaluation": evaluation})
        else:
            return jsonify({"status": "error", "message": "Avaliação não encontrada"}), 404
    except Exception as e:
        logger.error("[CAMADA 0][layout][get_evaluation_data] %s", str(e))
        return jsonify({"status": "error", "message": str(e)}), 500

@main_bp.route('/api/evaluations', methods=['GET'])
def get_all_evaluations_route():
    """Busca todas as avaliações para o Banco de Ativos."""
    try:
        from db.queries import get_all_evaluations
        evaluations = get_all_evaluations()
        return jsonify({"status": "ok", "evaluations": evaluations})
    except Exception as e:
        logger.error("[CAMADA 0][layout][get_all_evaluations_data] %s", str(e))
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route('/api/download-excel', methods=['GET'])
def download_excel():
    """Baixa a planilha processada."""
    from flask import send_file
    from orchestrator.manager import get_session_state
    
    state = get_session_state()
    filepath = state.get("spreadsheet_path")
    if filepath:
        return send_file(filepath, as_attachment=True)
    return "Arquivo não encontrado", 404


@main_bp.route('/api/feedback', methods=['POST'])
def save_feedback_route():
    """Salva o feedback do usuário (aceitar ou corrigir valor/comentário)."""
    try:
        data = request.get_json()
        evaluation_id = data.get('evaluation_id')
        accepted = data.get('accepted', 0)
        user_comment = data.get('user_comment')
        corrected_value = data.get('corrected_value')
        row_idx = data.get('row')
        
        from db.queries import save_feedback, get_evaluation
        # 1. Salvar feedback no DB
        save_feedback(evaluation_id, user_comment, corrected_value, accepted)
        
        # 2. Se não aceito (correção), atualizar auto_aprendizados.json
        ev = get_evaluation(evaluation_id)
        if ev and not accepted:
            import json
            import os
            auto_aprendizados_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'auto_aprendizados.json')
            aprendizados = []
            if os.path.exists(auto_aprendizados_path):
                try:
                    with open(auto_aprendizados_path, 'r', encoding='utf-8') as f:
                        aprendizados = json.load(f)
                except:
                    aprendizados = []
            
            from datetime import datetime
            aprendizados.append({
                "descricao_bem": ev.get("asset_description"),
                "feedback_usuario": user_comment or "",
                "valor_correto": corrected_value,
                "data": datetime.now().isoformat()
            })
            
            # Salvar arquivo formatado
            with open(auto_aprendizados_path, 'w', encoding='utf-8') as f:
                json.dump(aprendizados, f, indent=2, ensure_ascii=False)
                
            # 3. Atualizar valor_usado no banco para o valor corrigido
            from db.models import get_connection
            conn = get_connection()
            conn.execute(
                "UPDATE evaluations SET value_used = ? WHERE id = ?",
                (corrected_value, evaluation_id)
            )
            conn.commit()
            conn.close()
                
            # 4. Limpar colunas de output no Excel para forçar re-avaliação se o usuário quiser!
            from orchestrator.manager import get_session_state
            state = get_session_state()
            filepath = state.get("spreadsheet_path")
            column_mappings = state.get("column_mappings")
            
            if filepath and column_mappings:
                # Se não veio no payload, tentar buscar linear
                if not row_idx:
                    from excel.reader import read_data
                    data_sheet = read_data(filepath, column_mappings=column_mappings)
                    if data_sheet["status"] == "ok":
                        desc_letter = column_mappings.get("desc_original")
                        for r in data_sheet["rows"]:
                            if r.get(desc_letter) == ev.get("asset_description"):
                                row_idx = r.get("_row_index")
                                break
                
                if row_idx:
                    from excel.writer import write_row_results
                    from db.queries import get_column_mappings as db_get_mappings
                    excel_updates = {
                        "value_used": corrected_value,
                        "link1": "" # Limpa link1 para tirar de "Ignorado" e colocar em "Pendente"!
                    }
                    nested_mappings = db_get_mappings()
                    write_row_results(filepath, state.get("sheet_index", 0), row_idx, excel_updates, nested_mappings)
        
        return jsonify({"status": "ok"})
    except Exception as e:
        logger.error("[api/feedback] %s", str(e))
        return jsonify({"status": "error", "message": str(e)}), 500



@main_bp.route('/api/test-single-model', methods=['GET'])
def test_single_model():
    """Testa um único modelo do Gemini com a chave atual."""
    model_name = request.args.get('model', 'gemini-2.5-flash')
    try:
        import google.generativeai as genai
        from orchestrator.manager import get_session_state
        state = get_session_state()
        api_key = state.get("api_key")
        
        if not api_key:
            return jsonify({"status": "error", "message": "Chave de API não configurada"}), 400
            
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)
        response = model.generate_content("Oi, diga apenas 'ok'.")
        return jsonify({
            "status": "ok",
            "model": model_name,
            "response": response.text
        })
    except Exception as e:
        logger.error("[CAMADA 0][layout][test_single_model] %s: %s", model_name, str(e))
        return jsonify({
            "status": "error",
            "model": model_name,
            "message": str(e)
        }), 500


