"""Orquestrador de ingestão RF completa — download + DuckDB + ICP."""

import logging
import os
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

RF_DATA_DIR = Path(os.environ.get("RF_DATA_DIR", "data/rf/raw"))


class RFIngestOrchestrator:
    """Pipeline online: RF → DuckDB → ~230k Lucro Real."""

    def __init__(self, conn, on_progress=None):
        self.conn = conn
        self.on_progress = on_progress or (lambda msg, pct: None)

    def executar(self, versao: str | None = None, skip_download: bool = False, modo: str = "completo") -> dict:
        from layers.ingestion.rf_downloader import RFDownloader
        from layers.ingestion.rf_loader import RFLoader

        downloader = RFDownloader(on_progress=self.on_progress)
        versoes = downloader.listar_versoes()
        versao = versao or (versoes[0] if versoes else None)

        if not versao:
            return {"status": "error", "message": "Nenhuma versão RF disponível online"}

        self.on_progress(f"Iniciando ingestão RF {versao}", 0)

        if not skip_download:
            dl = downloader.download_versao(versao)
            if dl.get("status") != "ok":
                return {"status": "error", "message": "Falha no download", "download": dl}
        else:
            dl = {"status": "skipped"}

        versao_dir = RF_DATA_DIR / versao
        if not versao_dir.exists():
            return {"status": "error", "message": f"Pasta {versao_dir} não encontrada"}

        self.on_progress("Carregando dados no DuckDB…", 20)
        loader = RFLoader(self.conn, on_progress=self.on_progress)
        load_stats = loader.load_versao(versao_dir)

        snapshot_id = self._registrar_snapshot(versao)
        self.on_progress("Montando base de prospecção Lucro Real (~230k)…", 80)

        from layers.categorization.prospect_builder import ProspectBuilder
        builder = ProspectBuilder(perfil="patrimonial", modo=modo)
        builder._progress_cb = self.on_progress
        universo = builder.contar(self.conn)
        prospect_result = builder.construir(self.conn, snapshot_id=snapshot_id)

        self.on_progress("Ingestão concluída", 100)

        return {
            "status": "ok",
            "versao": versao,
            "snapshot_id": snapshot_id,
            "download": dl,
            "load": load_stats,
            "universo": universo,
            "prospeccao": prospect_result,
        }

    def _registrar_snapshot(self, versao: str) -> int:
        try:
            row = self.conn.execute(
                "INSERT INTO rf_snapshots (versao, data_referencia) VALUES (?, ?) RETURNING id",
                [versao, datetime.now().date().isoformat()],
            ).fetchone()
            return row[0] if row else 0
        except Exception:
            return 0
