"""Orquestrador unificado do pipeline AFS Market Intelligence."""

import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class PipelineOrchestrator:
    """
    Pipeline completo:
    Ingestão → Categorização → Enriquecimento → Validação → Dead Zone
    + Monitores transversais (Regime, B2B2B) + Feedback
    """

    ETAPAS = [
        "ingestao_rf",
        "categorizacao_icp",
        "enriquecimento",
        "validacao_email",
        "dead_zone",
        "monitor_regime",
        "parceiros_auditoria",
    ]

    def __init__(self, conn, perfil: str = "patrimonial"):
        self.conn = conn
        self.perfil = perfil

    def _log_run(self, etapa: str, status: str, registros: int = 0, erro: str = None):
        self.conn.execute(
            """INSERT INTO pipeline_runs (perfil_uso, etapa, status, registros_processados, started_at, finished_at, erro)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            [self.perfil, etapa, status, registros, datetime.now().isoformat(), datetime.now().isoformat(), erro],
        )
        self.conn.commit()

    def executar_etapa(self, etapa: str, **kwargs) -> dict:
        try:
            if etapa == "ingestao_rf":
                from layers.ingestion.rf_pipeline import RFIngestOrchestrator
                result = RFIngestOrchestrator(self.conn).executar(
                    versao=kwargs.get("versao"),
                    skip_download=kwargs.get("skip_download", False),
                    modo=kwargs.get("modo", "completo"),
                )
            elif etapa == "categorizacao_icp":
                from layers.categorization.prospect_builder import ProspectBuilder
                result = ProspectBuilder(self.perfil, modo=kwargs.get("modo", "completo")).construir(self.conn)
            elif etapa == "enriquecimento":
                from layers.enrichment.enrichment_engine import EnrichmentEngine
                result = EnrichmentEngine(self.conn).executar_lote(kwargs.get("limite", 50))
            elif etapa == "validacao_email":
                from layers.validation.email_validator import ValidationPipeline
                result = ValidationPipeline(self.conn).processar_decisores()
            elif etapa == "dead_zone":
                from layers.dead_zone.router import DeadZoneRouter
                rows = self.conn.execute(
                    """SELECT DISTINCT d.lead_id FROM decisores d
                       LEFT JOIN emails_validados e ON e.decisor_id = d.id
                       WHERE e.status IS NULL OR e.status IN ('invalido','pendente')"""
                ).fetchall()
                router = DeadZoneRouter(self.conn)
                rotas = [router.rotear(r[0], "sem_email_validado") for r in rows]
                result = {"status": "ok", "rotas": len(rotas)}
            elif etapa == "monitor_regime":
                from layers.regime_monitor.transition_detector import RegimeTransitionMonitor
                result = RegimeTransitionMonitor(self.conn).detectar_transicoes(
                    kwargs.get("snapshot_de", 1), kwargs.get("snapshot_para", 2)
                )
            elif etapa == "parceiros_auditoria":
                from layers.partnerships.audit_channels import AuditPartnershipChannel
                result = AuditPartnershipChannel(self.conn).carregar_base()
            else:
                return {"status": "error", "message": f"Etapa desconhecida: {etapa}"}

            self._log_run(etapa, "ok", result.get("leads_filtrados", result.get("registros", 0)))
            return result
        except Exception as e:
            logger.error("[orchestrator] %s: %s", etapa, e)
            self._log_run(etapa, "error", erro=str(e))
            return {"status": "error", "message": str(e)}

    def executar_pipeline_completo(self, pular_ingestao: bool = False) -> dict:
        resultados = {}
        etapas = self.ETAPAS if not pular_ingestao else self.ETAPAS[1:]

        for etapa in etapas:
            logger.info("[orchestrator] Executando: %s", etapa)
            resultados[etapa] = self.executar_etapa(etapa)

        from layers.feedback.recalibrator import FeedbackRecalibrator
        resultados["metricas"] = FeedbackRecalibrator(self.conn).metricas_funil(self.perfil)

        return {"status": "ok", "perfil": self.perfil, "etapas": resultados}

    def status(self) -> dict:
        from layers.feedback.recalibrator import FeedbackRecalibrator
        runs = self.conn.execute(
            "SELECT etapa, status, registros_processados, finished_at FROM pipeline_runs ORDER BY id DESC LIMIT 10"
        ).fetchall()
        return {
            "perfil_ativo": self.perfil,
            "ultimas_execucoes": [
                {"etapa": r[0], "status": r[1], "registros": r[2], "finished_at": r[3]} for r in runs
            ],
            "funil": FeedbackRecalibrator(self.conn).metricas_funil(self.perfil),
        }
