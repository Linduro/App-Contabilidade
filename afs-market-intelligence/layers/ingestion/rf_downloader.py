"""Download paralelo dos arquivos abertos CNPJ — Receita Federal."""

import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin

import requests
import yaml

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent.parent.parent
RF_DATA_DIR = Path(os.environ.get("RF_DATA_DIR", "data/rf/raw"))
DOWNLOAD_THREADS = int(os.environ.get("RF_DOWNLOAD_THREADS", "4"))
CHUNK_SIZE = 1024 * 1024  # 1 MB


def _load_layout() -> dict:
    with open(ROOT / "config" / "rf_layout.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


class RFDownloader:
    """Baixa ZIPs mensais da RF com retomada e URLs alternativas."""

    def __init__(self, on_progress=None):
        self.layout = _load_layout()
        self.on_progress = on_progress or (lambda msg, pct: None)
        RF_DATA_DIR.mkdir(parents=True, exist_ok=True)

    @property
    def base_urls(self) -> list[str]:
        cfg = self.layout.get("urls", {})
        return [cfg.get("primary"), cfg.get("fallback")]

    def listar_versoes(self) -> list[str]:
        """Descobre pastas YYYY-MM disponíveis."""
        for base in self.base_urls:
            if not base:
                continue
            try:
                url = base.rstrip("/") + "/"
                resp = requests.get(url, timeout=30, headers={"User-Agent": "AFS-Market-Intelligence/1.0"})
                resp.raise_for_status()
                matches = re.findall(r'href="(\d{4}-\d{2})/"', resp.text)
                if not matches:
                    matches = re.findall(r'(\d{4}-\d{2})', resp.text)
                versoes = sorted(set(matches), reverse=True)
                if versoes:
                    logger.info("[rf_downloader] %d versões em %s", len(versoes), base)
                    return versoes
            except Exception as e:
                logger.warning("[rf_downloader] Falha listar %s: %s", base, e)
        return []

    def listar_arquivos_versao(self, versao: str) -> list[str]:
        """Lista ZIPs disponíveis para uma versão."""
        arquivos = []
        for base in self.base_urls:
            if not base:
                continue
            try:
                url = f"{base.rstrip('/')}/{versao}/"
                resp = requests.get(url, timeout=30, headers={"User-Agent": "AFS-Market-Intelligence/1.0"})
                resp.raise_for_status()
                found = re.findall(r'href="([^"]+\.zip)"', resp.text, re.I)
                if found:
                    arquivos = [f.replace(".zip", "") for f in found]
                    break
            except Exception as e:
                logger.warning("[rf_downloader] Falha listar arquivos %s: %s", versao, e)

        if arquivos:
            return arquivos

        # Fallback: arquivos conhecidos multi-parte
        result = []
        for prefix in self.layout.get("multipart", []):
            for i in range(10):
                result.append(f"{prefix}{i}")
        result.extend(self.layout.get("single", []))
        return result

    def arquivos_necessarios_icp(self) -> list[str]:
        """Mínimo para base Lucro Real completa (~230k)."""
        needed = []
        for prefix in ("Empresas", "Estabelecimentos", "Socios"):
            for i in range(10):
                needed.append(f"{prefix}{i}")
        needed.extend(["Simples", "Cnaes", "Municipios", "Qualificacoes"])
        return needed

    def _download_one(self, versao: str, arquivo: str) -> dict:
        dest = RF_DATA_DIR / versao / f"{arquivo}.zip"
        dest.parent.mkdir(parents=True, exist_ok=True)

        if dest.exists() and dest.stat().st_size > 1000:
            return {"arquivo": arquivo, "status": "cached", "path": str(dest)}

        for base in self.base_urls:
            if not base:
                continue
            url = f"{base.rstrip('/')}/{versao}/{arquivo}.zip"
            try:
                resp = requests.get(url, stream=True, timeout=300, headers={"User-Agent": "AFS-Market-Intelligence/1.0"})
                if resp.status_code == 404:
                    continue
                resp.raise_for_status()
                with open(dest, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=CHUNK_SIZE):
                        if chunk:
                            f.write(chunk)
                logger.info("[rf_downloader] OK %s (%.1f MB)", arquivo, dest.stat().st_size / 1e6)
                return {"arquivo": arquivo, "status": "ok", "path": str(dest)}
            except Exception as e:
                logger.debug("[rf_downloader] %s em %s: %s", arquivo, url, e)

        return {"arquivo": arquivo, "status": "missing"}

    def download_versao(self, versao: str, arquivos: list[str] | None = None) -> dict:
        """Download paralelo de todos os arquivos de uma versão."""
        arquivos = arquivos or self.arquivos_necessarios_icp()
        resultados = {"ok": 0, "cached": 0, "missing": 0, "arquivos": []}
        total = len(arquivos)

        with ThreadPoolExecutor(max_workers=DOWNLOAD_THREADS) as pool:
            futures = {pool.submit(self._download_one, versao, arq): arq for arq in arquivos}
            for i, future in enumerate(as_completed(futures), 1):
                r = future.result()
                resultados["arquivos"].append(r)
                resultados[r["status"]] = resultados.get(r["status"], 0) + 1
                self.on_progress(f"Download {r['arquivo']}: {r['status']}", int(i / total * 100))

        resultados["versao"] = versao
        resultados["status"] = "ok" if resultados["ok"] + resultados["cached"] > 0 else "error"
        return resultados
