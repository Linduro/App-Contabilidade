"""Worker assíncrono — ingestão RF e raspagem em background thread."""

import logging
import threading

logger = logging.getLogger(__name__)

_running: dict[int, threading.Thread] = {}


class JobWorker:
    @staticmethod
    def start(conn_factory, job_id: int, tipo: str, params: dict):
        if job_id in _running and _running[job_id].is_alive():
            return False

        def _run():
            conn = conn_factory()
            from jobs.store import JobStore
            store = JobStore(conn)
            try:
                store.update(job_id, status="running", progress=0, message="Iniciando…")

                def progress(msg, pct):
                    store.update(job_id, progress=pct, message=msg)

                if tipo == "rf_ingest":
                    from layers.ingestion.rf_pipeline import RFIngestOrchestrator
                    result = RFIngestOrchestrator(conn, on_progress=progress).executar(
                        versao=params.get("versao"),
                        skip_download=params.get("skip_download", False),
                        modo=params.get("modo", "completo"),
                    )
                elif tipo == "icp_filter":
                    from layers.categorization.prospect_builder import ProspectBuilder
                    result = ProspectBuilder(params.get("perfil", "patrimonial"), modo=params.get("modo", "completo")).construir(conn)
                elif tipo == "scraping_batch":
                    from layers.scraping.queue_worker import ScrapingQueueWorker
                    result = ScrapingQueueWorker(conn, on_progress=progress).processar_lote(
                        params.get("limite", 50)
                    )
                elif tipo == "social_scrape":
                    from layers.enrichment.social_scraper import run_social_scrape, persist_social_leads
                    result = run_social_scrape(
                        linkedin_urls=params.get("linkedin_urls"),
                        instagram_users=params.get("instagram_users"),
                        headless=params.get("headless", True),
                    )
                    saved = persist_social_leads(conn, result.get("rows", []))
                    result["salvos_duckdb"] = saved
                elif tipo == "pipeline_completo":
                    from orchestrator.pipeline import PipelineOrchestrator
                    orch = PipelineOrchestrator(conn, params.get("perfil", "patrimonial"))
                    result = orch.executar_pipeline_completo(pular_ingestao=params.get("pular_ingestao", False))
                else:
                    result = {"status": "error", "message": f"Tipo desconhecido: {tipo}"}

                status = "done" if result.get("status") == "ok" else "error"
                store.update(job_id, status=status, progress=100, result=result,
                             error=result.get("message") if status == "error" else None)
            except Exception as e:
                logger.exception("[worker] job %s falhou", job_id)
                store.update(job_id, status="error", error=str(e), message=str(e))
            finally:
                conn.close()
                _running.pop(job_id, None)

        t = threading.Thread(target=_run, daemon=True)
        _running[job_id] = t
        t.start()
        return True
