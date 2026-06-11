# ============================================================
# Asset Solutions Valuation — Ponto de Entrada
# app.py — CAMADA 0 (apenas sobe o servidor)
# ============================================================
# REGRA: Nenhuma lógica de negócio aqui.

import os
import sys
import logging

# Configurar logging global ANTES de qualquer import
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('afs_valuation.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

# Flask (import com fallback)
try:
    from flask import Flask
except ImportError:
    logger.critical("[CAMADA 0][app] Flask não instalado. Execute: pip install flask")
    sys.exit(1)

# Dotenv (opcional)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    logger.info("[CAMADA 0][app] python-dotenv não disponível, usando variáveis de ambiente do sistema")


def create_app():
    """Factory de criação da aplicação Flask."""
    app = Flask(
        __name__,
        template_folder='templates',
        static_folder='static'
    )

    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max upload
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'afs-valuation-dev-key')

    try:
        from flask_cors import CORS
        CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=False)
    except ImportError:
        logger.warning("[CAMADA 0][app] flask-cors não instalado; CORS desabilitado")

    # Garantir diretório de uploads
    os.makedirs('uploads', exist_ok=True)

    # Inicializar banco de dados (CAMADA 3)
    try:
        from db.models import init_db
        init_db()
        logger.info("[CAMADA 0][app] Banco de dados inicializado")
    except Exception as e:
        logger.warning("[CAMADA 0][app] Banco de dados não inicializado: %s", str(e))

    # Inicializar sessão a partir de dados salvos
    try:
        from orchestrator.manager import initialize_session_from_saved_data
        initialize_session_from_saved_data()
        logger.info("[CAMADA 0][app] Sessão inicializada com dados salvos no banco de dados e arquivos locais")
    except Exception as e:
        logger.warning("[CAMADA 0][app] Erro na auto-inicialização da sessão: %s", str(e))

    # Registrar blueprint de rotas (CAMADA 0)
    try:
        from ui.layout import main_bp
        app.register_blueprint(main_bp)
        logger.info("[CAMADA 0][app] Blueprint de rotas registrado")
    except Exception as e:
        logger.error("[CAMADA 0][app] Erro ao registrar rotas: %s", str(e))

    return app


if __name__ == '__main__':
    app = create_app()
    port = int(os.environ.get('PORT', 5000))
    logger.info("=" * 60)
    logger.info("Asset Solutions Valuation — Servidor iniciando em http://0.0.0.0:%s", port)
    logger.info("=" * 60)
    app.run(host='0.0.0.0', port=port, debug=os.environ.get('FLASK_DEBUG', '').lower() == 'true')
