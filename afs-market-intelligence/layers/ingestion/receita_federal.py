"""Camada 1 — Download e carga dos dados abertos da Receita Federal."""

import logging
import os
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)

RF_DATA_DIR = Path(os.environ.get("RF_DATA_DIR", "data/rf/raw"))
RF_BASE_URL = "https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj/"


class ReceitaFederalIngester:
    """Extrai EMPRESAS, ESTABELECIMENTOS e CNAEs direto em disco via DuckDB."""

    TABELAS = ("Empresas", "Estabelecimentos", "Cnaes", "Simples", "Socios")

    def __init__(self, conn):
        self.conn = conn
        RF_DATA_DIR.mkdir(parents=True, exist_ok=True)

    def listar_versoes_disponiveis(self) -> list[str]:
        """Lista pastas YYYY-MM disponíveis no portal RF."""
        try:
            import requests
            from bs4 import BeautifulSoup
            resp = requests.get(RF_BASE_URL, timeout=30)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")
            links = [a.get("href", "").rstrip("/") for a in soup.find_all("a")]
            versoes = sorted(
                {l for l in links if l and len(l) == 7 and l[4] == "-"},
                reverse=True,
            )
            return versoes
        except Exception as e:
            logger.warning("[ingestion] Falha ao listar versões RF: %s", e)
            return []

    def download_tabela(self, versao: str, tabela: str) -> Path | None:
        """Baixa ZIP de uma tabela para disco local."""
        import requests
        url = f"{RF_BASE_URL}{versao}/{tabela}.zip"
        dest = RF_DATA_DIR / versao / f"{tabela}.zip"
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists():
            logger.info("[ingestion] %s já existe localmente", dest)
            return dest
        try:
            logger.info("[ingestion] Baixando %s", url)
            resp = requests.get(url, stream=True, timeout=120)
            resp.raise_for_status()
            with open(dest, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    f.write(chunk)
            return dest
        except Exception as e:
            logger.error("[ingestion] Erro download %s: %s", tabela, e)
            return None

    def carregar_csv_duckdb(self, zip_path: Path, tabela_destino: str) -> int:
        """Carrega CSV do ZIP direto no DuckDB sem passar pela RAM."""
        import zipfile
        import tempfile

        with zipfile.ZipFile(zip_path) as zf:
            csv_names = [n for n in zf.namelist() if n.lower().endswith(".csv") or "ESTABELE" in n.upper() or "EMPRECSV" in n.upper()]
            if not csv_names:
                return 0
            with tempfile.TemporaryDirectory() as tmp:
                zf.extract(csv_names[0], tmp)
                csv_file = Path(tmp) / csv_names[0]
                self.conn.execute(f"DROP TABLE IF EXISTS {tabela_destino}_staging")
                self.conn.execute(
                    f"CREATE TABLE {tabela_destino}_staging AS SELECT * FROM read_csv_auto('{csv_file.as_posix()}', header=false, all_varchar=true)"
                )
                count = self.conn.execute(f"SELECT COUNT(*) FROM {tabela_destino}_staging").fetchone()[0]
                logger.info("[ingestion] %s: %d registros carregados", tabela_destino, count)
                return count

    def registrar_snapshot(self, versao: str) -> int:
        row = self.conn.execute(
            "INSERT INTO rf_snapshots (versao, data_referencia) VALUES (?, ?) RETURNING id",
            [versao, datetime.now().date().isoformat()],
        ).fetchone()
        return row[0] if row else 0

    def executar_ingestao(self, versao: str | None = None) -> dict:
        versoes = self.listar_versoes_disponiveis()
        versao = versao or (versoes[0] if versoes else None)
        if not versao:
            return {"status": "error", "message": "Nenhuma versão RF disponível"}

        snapshot_id = self.registrar_snapshot(versao)
        total = 0
        for tabela in ("Empresas0", "Estabelecimentos0", "Cnaes"):
            zip_path = self.download_tabela(versao, tabela.rstrip("0") if tabela.endswith("0") else tabela)
            if zip_path:
                total += self.carregar_csv_duckdb(zip_path, tabela.lower())

        self.conn.commit()
        return {
            "status": "ok",
            "versao": versao,
            "snapshot_id": snapshot_id,
            "registros": total,
        }
