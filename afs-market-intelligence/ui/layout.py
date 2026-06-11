"""Rotas API e interface — CAMADA 0 (sem lógica de negócio)."""

import logging
import os
from flask import Blueprint, render_template, request, jsonify, send_file

logger = logging.getLogger(__name__)
main_bp = Blueprint("main", __name__)


def _conn():
    from db.connection import get_connection
    return get_connection()


@main_bp.route("/")
def index():
    return render_template("index.html")


@main_bp.route("/api/status")
def status():
    try:
        perfil = request.args.get("perfil", "patrimonial")
        from orchestrator.pipeline import PipelineOrchestrator
        conn = _conn()
        result = PipelineOrchestrator(conn, perfil).status()
        conn.close()
        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route("/api/profiles")
def profiles():
    import yaml
    from pathlib import Path
    path = Path(__file__).resolve().parent.parent / "config" / "profiles.yaml"
    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    return jsonify(data)


@main_bp.route("/api/pipeline/run", methods=["POST"])
def run_pipeline():
    try:
        body = request.get_json() or {}
        perfil = body.get("perfil", "patrimonial")
        etapa = body.get("etapa")
        pular_ingestao = body.get("pular_ingestao", True)

        conn = _conn()
        orch = __import__("orchestrator.pipeline", fromlist=["PipelineOrchestrator"]).PipelineOrchestrator(conn, perfil)

        if etapa:
            result = orch.executar_etapa(etapa, **body.get("params", {}))
        else:
            result = orch.executar_pipeline_completo(pular_ingestao=pular_ingestao)

        conn.close()
        return jsonify(result)
    except Exception as e:
        logger.error("[api/pipeline/run] %s", e)
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route("/api/leads")
def list_leads():
    try:
        perfil = request.args.get("perfil", "patrimonial")
        limite = int(request.args.get("limite", 100))
        conn = _conn()
        rows = conn.execute(
            """SELECT id, cnpj_basico, razao_social, cluster_estrategico, capital_social,
                      qtd_filiais, score_prioridade, transicao_regime
               FROM leads_icp WHERE perfil_uso = ? ORDER BY score_prioridade DESC LIMIT ?""",
            [perfil, limite],
        ).fetchall()
        conn.close()
        cols = ["id", "cnpj_basico", "razao_social", "cluster", "capital_social",
                "qtd_filiais", "score", "transicao_regime"]
        return jsonify({"leads": [dict(zip(cols, r)) for r in rows]})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route("/api/dead-zone")
def dead_zone():
    try:
        limite = int(request.args.get("limite", 100))
        conn = _conn()
        from layers.dead_zone.router import DeadZoneRouter
        result = DeadZoneRouter(conn).listar(limite)
        conn.close()
        return jsonify({"dead_zone": result})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route("/api/transicao-regime")
def transicao_regime():
    try:
        conn = _conn()
        from layers.regime_monitor.transition_detector import RegimeTransitionMonitor
        result = RegimeTransitionMonitor(conn).listar_quentes()
        conn.close()
        return jsonify({"transicoes": result})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route("/api/parceiros")
def parceiros():
    try:
        conn = _conn()
        from layers.partnerships.audit_channels import AuditPartnershipChannel
        uf = request.args.get("uf")
        result = AuditPartnershipChannel(conn).listar_prospects(uf)
        conn.close()
        return jsonify({"parceiros": result})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route("/api/feedback", methods=["POST"])
def feedback():
    try:
        body = request.get_json() or {}
        conn = _conn()
        from layers.feedback.recalibrator import FeedbackRecalibrator
        result = FeedbackRecalibrator(conn).registrar(
            body["lead_id"], body["outcome"],
            body.get("motivo", ""), body.get("canal", ""), body.get("registrado_por", ""),
        )
        conn.close()
        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route("/api/export", methods=["POST"])
def export_excel():
    try:
        body = request.get_json() or {}
        perfil = body.get("perfil", "patrimonial")
        conn = _conn()
        from export.excel_exporter import ExcelExporter
        result = ExcelExporter(conn).exportar(perfil)
        conn.close()
        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route("/api/export/download/<filename>")
def download_export(filename):
    from pathlib import Path
    export_dir = Path(os.environ.get("EXPORT_DIR", "data/exports"))
    filepath = export_dir / filename
    if not filepath.exists() or ".." in filename:
        return jsonify({"status": "error", "message": "Arquivo não encontrado"}), 404
    return send_file(filepath, as_attachment=True)
