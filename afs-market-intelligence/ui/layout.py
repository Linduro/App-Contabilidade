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


@main_bp.route("/api/rf/versoes")
def rf_versoes():
    try:
        from layers.ingestion.rf_downloader import RFDownloader
        return jsonify({
            "versoes": RFDownloader().listar_versoes(),
            "fonte": "https://dadosabertos.rfb.gov.br/CNPJ/dados_abertos_cnpj",
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route("/api/rf/status")
def rf_status():
    try:
        conn = _conn()
        from layers.categorization.prospect_builder import ProspectBuilder
        stats = ProspectBuilder().contar(conn)
        snap = conn.execute(
            "SELECT versao, data_referencia FROM rf_snapshots ORDER BY id DESC LIMIT 1"
        ).fetchone()
        prospectos = 0
        try:
            prospectos = conn.execute("SELECT COUNT(*) FROM prospectos_rf").fetchone()[0]
        except Exception:
            pass
        conn.close()
        return jsonify({
            "snapshot": {"versao": snap[0], "data": snap[1]} if snap else None,
            "universo": stats,
            "prospectos_carregados": prospectos,
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route("/api/rf/ingest", methods=["POST"])
def rf_ingest():
    try:
        body = request.get_json() or {}
        from db.connection import get_connection
        from jobs.store import JobStore
        from jobs.worker import JobWorker
        conn = _conn()
        store = JobStore(conn)
        job_id = store.create("rf_ingest", body)
        conn.close()
        JobWorker.start(get_connection, job_id, "rf_ingest", body)
        return jsonify({"status": "ok", "job_id": job_id, "message": "Ingestão RF iniciada (~230k Lucro Real)"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route("/api/prospectos")
def list_prospectos():
    try:
        uf = request.args.get("uf")
        cluster = request.args.get("cluster")
        q = request.args.get("q", "").strip()
        limite = min(int(request.args.get("limite", 100)), 500)
        offset = int(request.args.get("offset", 0))
        conn = _conn()
        sql = """SELECT id, cnpj_basico, cnpj_matriz, razao_social, cluster_estrategico,
                        capital_social, cnae_principal, cnae_principal_descricao, uf, municipio_nome,
                        email_matriz, telefone_matriz, endereco_matriz, socios_chave, emails_encontrados,
                        qtd_estabelecimentos, score_prioridade, status_funil
                 FROM prospectos_rf WHERE 1=1"""
        params = []
        if uf:
            sql += " AND uf = ?"; params.append(uf)
        if cluster:
            sql += " AND cluster_estrategico = ?"; params.append(cluster)
        if q:
            sql += " AND (razao_social ILIKE ? OR cnpj_basico LIKE ?)"
            params.extend([f"%{q}%", f"%{q}%"])
        sql += " ORDER BY score_prioridade DESC LIMIT ? OFFSET ?"
        params.extend([limite, offset])
        rows = conn.execute(sql, params).fetchall()
        total = conn.execute("SELECT COUNT(*) FROM prospectos_rf").fetchone()[0]
        cols = ["id", "cnpj_basico", "cnpj_matriz", "razao_social", "cluster", "capital_social",
                "cnae", "cnae_descricao", "uf", "municipio", "email_matriz", "telefone_matriz",
                "endereco_matriz", "socios_chave", "emails_encontrados", "qtd_filiais", "score", "status"]
        conn.close()
        return jsonify({"total": total, "prospectos": [dict(zip(cols, r)) for r in rows]})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route("/api/prospectos/mapa")
def prospectos_mapa():
    try:
        limite = min(int(request.args.get("limite", 8000)), 15000)
        uf = request.args.get("uf") or None
        conn = _conn()
        from layers.intelligence.market_intel import GeoIntel
        result = GeoIntel(conn).mapa_payload(limite, uf)
        conn.close()
        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route("/api/cnae/setores")
def cnae_setores():
    try:
        q = request.args.get("q", "").strip()
        secao = request.args.get("secao", "").strip()
        from layers.intelligence.market_intel import CnaeSetores
        return jsonify(CnaeSetores.listar(q, secao))
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route("/api/intel/auditorias")
def intel_auditorias():
    try:
        uf = request.args.get("uf") or None
        tier = request.args.get("tier") or None
        from layers.intelligence.market_intel import AuditIntel
        return jsonify(AuditIntel.listar(uf, tier))
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route("/api/intel/patrimonial")
def intel_patrimonial():
    try:
        uf = request.args.get("uf") or None
        from layers.intelligence.market_intel import PatrimonialIntel
        payload = PatrimonialIntel.listar(uf)
        payload["pontos_mapa"] = PatrimonialIntel().pontos_mapa(uf)
        return jsonify(payload)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route("/api/intel/carencia")
def intel_carencia():
    try:
        conn = _conn()
        from layers.intelligence.market_intel import CarenciaIntel
        result = CarenciaIntel(conn).analisar()
        conn.close()
        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route("/api/prospectos/<cnpj_basico>")
def get_prospecto(cnpj_basico):
    try:
        conn = _conn()
        row = conn.execute("""
            SELECT cnpj_basico, cnpj_matriz, razao_social, nome_fantasia, capital_social, porte,
                   cluster_estrategico, cnae_principal, cnae_principal_descricao, cnaes_secundarios,
                   email_matriz, telefone_matriz, endereco_matriz, uf, municipio_nome, cep,
                   qtd_estabelecimentos, socios_chave, emails_encontrados, score_prioridade
            FROM prospectos_rf WHERE cnpj_basico = ?
        """, [cnpj_basico]).fetchone()
        if not row:
            conn.close()
            return jsonify({"status": "error", "message": "Não encontrado"}), 404
        cols = ["cnpj_basico", "cnpj_matriz", "razao_social", "nome_fantasia", "capital_social", "porte",
                "cluster", "cnae", "cnae_descricao", "cnaes_secundarios", "email_matriz", "telefone_matriz",
                "endereco_matriz", "uf", "municipio", "cep", "qtd_filiais", "socios_chave",
                "emails_encontrados", "score"]
        estab = conn.execute("""
            SELECT cnpj_completo, matriz_filial, nome_fantasia, cnae_fiscal, cnae_descricao,
                   endereco_completo, uf, municipio_nome, telefone, email
            FROM estabelecimentos_rf WHERE cnpj_basico = ? ORDER BY matriz_filial
        """, [cnpj_basico]).fetchall()
        estab_cols = ["cnpj_completo", "matriz_filial", "nome_fantasia", "cnae", "cnae_descricao",
                      "endereco", "uf", "municipio", "telefone", "email"]
        socios = conn.execute("""
            SELECT nome_socio, qualificacao_descricao, qualificacao_codigo, is_pessoa_chave, data_entrada
            FROM socios_rf WHERE cnpj_basico = ? ORDER BY is_pessoa_chave DESC
        """, [cnpj_basico]).fetchall()
        socio_cols = ["nome", "qualificacao", "qualificacao_codigo", "pessoa_chave", "data_entrada"]
        conn.close()
        return jsonify({
            "prospecto": dict(zip(cols, row)),
            "estabelecimentos": [dict(zip(estab_cols, e)) for e in estab],
            "socios": [dict(zip(socio_cols, s)) for s in socios],
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route("/api/jobs")
def list_jobs():
    try:
        conn = _conn()
        from jobs.store import JobStore
        jobs = JobStore(conn).list_recent(int(request.args.get("limite", 20)))
        conn.close()
        return jsonify({"jobs": jobs})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@main_bp.route("/api/jobs/<int:job_id>")
def get_job(job_id):
    try:
        conn = _conn()
        from jobs.store import JobStore
        job = JobStore(conn).get(job_id)
        conn.close()
        if not job:
            return jsonify({"status": "error", "message": "Job não encontrado"}), 404
        return jsonify(job)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


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


@main_bp.route("/api/export/prospectos", methods=["POST"])
def export_prospectos():
    try:
        body = request.get_json() or {}
        conn = _conn()
        from export.excel_exporter import ExcelExporter
        result = ExcelExporter(conn).exportar_prospectos_rf(
            uf=body.get("uf") or None,
            cluster=body.get("cluster") or None,
            q=(body.get("q") or "").strip() or None,
            limite=body.get("limite", 100_000),
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
