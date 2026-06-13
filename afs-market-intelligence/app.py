"""AFS Market Intelligence — ponto de entrada Flask."""

import os
import sys
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

try:
    from flask import Flask
except ImportError:
    logger.critical("Flask não instalado. Execute: pip install flask")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    from pathlib import Path
    _ROOT = Path(__file__).resolve().parent
    load_dotenv()
    load_dotenv(_ROOT / "prospect-automation" / ".env", override=True)
except ImportError:
    pass


def create_app():
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "afs-market-dev-key")

    try:
        from flask_cors import CORS
        CORS(app, resources={r"/api/*": {"origins": "*"}})
    except ImportError:
        pass

    os.makedirs("data/exports", exist_ok=True)
    os.makedirs("data/rf/raw", exist_ok=True)

    try:
        from db.connection import init_db
        init_db()
        logger.info("Banco de dados inicializado")
    except Exception as e:
        logger.warning("DB init: %s", e)

    try:
        from ui.layout import main_bp
        app.register_blueprint(main_bp)
    except Exception as e:
        logger.error("Erro ao registrar rotas: %s", e)

    return app


if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", 5001))
    logger.info("AFS Market Intelligence — http://0.0.0.0:%s", port)
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_DEBUG", "").lower() == "true")
