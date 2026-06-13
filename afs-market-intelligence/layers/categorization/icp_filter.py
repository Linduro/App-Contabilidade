"""Camada 1 — Filtro ICP e categorização por cluster."""

import logging
import yaml
from pathlib import Path

logger = logging.getLogger(__name__)
CONFIG_DIR = Path(__file__).resolve().parent.parent.parent / "config"


def _load_yaml(name: str) -> dict:
    with open(CONFIG_DIR / name, encoding="utf-8") as f:
        return yaml.safe_load(f)


class ICPFilter:
    """Isola ~230k empresas Lucro Real conforme perfil AFS."""

    def __init__(self, perfil: str = "patrimonial"):
        self.perfil = perfil
        self.icp = _load_yaml("icp.yaml")["icp"]
        self.clusters = _load_yaml("clusters.yaml")["clusters"]

    def build_filter_sql(self) -> str:
        capital_min = self.icp["capital_social_min"]
        situacao = ",".join(f"'{s}'" for s in self.icp["situacao_cadastral"])
        return f"""
            SELECT
                e.cnpj_basico,
                e.razao_social,
                e.capital_social,
                COUNT(DISTINCT est.cnpj_completo) AS qtd_filiais,
                MAX(est.cnae_fiscal) AS cnae_principal,
                MAX(est.uf) AS uf
            FROM empresas e
            JOIN estabelecimentos est ON est.cnpj_basico = e.cnpj_basico
            WHERE e.capital_social >= {capital_min}
              AND est.situacao_cadastral IN ({situacao})
            GROUP BY e.cnpj_basico, e.razao_social, e.capital_social
            HAVING COUNT(DISTINCT est.cnpj_completo) > {self.icp['filiais_min']}
        """

    def classificar_cluster(self, cnae: str) -> str:
        if not cnae:
            return "outro"
        prefixo = cnae[:2]
        for nome, cfg in self.clusters.items():
            if prefixo in cfg.get("cnae_prefixos", []):
                return nome
        return "outro"

    def aplicar_filtro(self, conn) -> dict:
        sql = self.build_filter_sql()
        try:
            rows = conn.execute(sql).fetchall()
        except Exception:
            logger.warning("[categorization] Tabelas RF vazias — nenhum lead retornado")
            return {"status": "ok", "leads_filtrados": 0, "message": "Ingestão RF necessária"}

        inseridos = 0
        for row in rows:
            cnpj, razao, capital, filiais, cnae, uf = row[0], row[1], row[2], row[3], row[4], row[5]
            cluster = self.classificar_cluster(cnae or "")
            if cluster == "outro" and self.perfil == "patrimonial":
                continue
            conn.execute(
                """INSERT OR REPLACE INTO leads_icp
                   (cnpj_basico, razao_social, cluster_estrategico, capital_social, qtd_filiais, perfil_uso, score_prioridade)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                [cnpj, razao, cluster, capital, filiais, self.perfil, capital / 1e6 + filiais * 0.5],
            )
            inseridos += 1
        conn.commit()
        return {"status": "ok", "leads_filtrados": inseridos}

