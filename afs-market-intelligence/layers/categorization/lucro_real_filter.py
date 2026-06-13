"""Filtro Lucro Real ICP — ~230k empresas via view DuckDB + clusters AFS."""

import logging
import yaml
from pathlib import Path

logger = logging.getLogger(__name__)
CONFIG_DIR = Path(__file__).resolve().parent.parent.parent / "config"


class LucroRealFilter:
    """Aplica ICP AFS sobre vw_lucro_real_candidatas."""

    def __init__(self, perfil: str = "patrimonial"):
        self.perfil = perfil
        with open(CONFIG_DIR / "icp.yaml", encoding="utf-8") as f:
            self.icp = yaml.safe_load(f)["icp"]
        with open(CONFIG_DIR / "clusters.yaml", encoding="utf-8") as f:
            self.clusters = yaml.safe_load(f)["clusters"]

    def _prefixos_cnae_validos(self) -> set[str]:
        prefixes = set()
        for grupo in self.icp.get("cnae_obrigatorio_prefixos", {}).values():
            prefixes.update(grupo)
        return prefixes

    def classificar_cluster(self, cnae: str) -> str:
        if not cnae:
            return "outro"
        prefixo = cnae[:2]
        for nome, cfg in self.clusters.items():
            if prefixo in cfg.get("cnae_prefixos", []):
                return nome
        return "outro"

    def contar_universo(self, conn) -> dict:
        try:
            total_rf = conn.execute("SELECT COUNT(*) FROM rf_empresas").fetchone()[0]
            candidatas = conn.execute("SELECT COUNT(*) FROM vw_lucro_real_candidatas").fetchone()[0]
            return {"total_empresas_rf": total_rf, "candidatas_lucro_real": candidatas}
        except Exception:
            return {"total_empresas_rf": 0, "candidatas_lucro_real": 0}

    def aplicar(self, conn, limite: int | None = None) -> dict:
        prefixos = self._prefixos_cnae_validos()
        filiais_min = self.icp["filiais_min"]

        try:
            rows = conn.execute(f"""
                SELECT cnpj_basico, razao_social, capital_social, qtd_estabelecimentos,
                       cnae_principal, uf, email_matriz, telefone_matriz
                FROM vw_lucro_real_candidatas
                ORDER BY capital_social DESC
                {f'LIMIT {limite}' if limite else ''}
            """).fetchall()
        except Exception as e:
            logger.warning("[lucro_real] View não disponível: %s", e)
            from layers.categorization.icp_filter import ICPFilter
            return ICPFilter(self.perfil).aplicar_filtro(conn)

        inseridos = 0
        por_cluster = {"agro": 0, "industria": 0, "varejo": 0, "outro": 0}

        for row in rows:
            cnpj, razao, capital, filiais, cnae, uf, email, tel = row
            if not cnae or cnae[:2] not in prefixos:
                continue
            cluster = self.classificar_cluster(cnae)
            if cluster == "outro" and self.perfil == "patrimonial":
                continue

            score = (capital or 0) / 1e6 + (filiais or 0) * 0.5
            conn.execute(
                """INSERT OR REPLACE INTO leads_icp
                   (cnpj_basico, razao_social, cluster_estrategico, capital_social, qtd_filiais,
                    perfil_uso, score_prioridade)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                [cnpj, razao, cluster, capital, filiais, self.perfil, score],
            )

            if email or tel:
                try:
                    conn.execute(
                        """INSERT OR IGNORE INTO estabelecimentos
                           (cnpj_completo, cnpj_basico, matriz_filial, email, telefone, uf, cnae_fiscal, situacao_cadastral)
                           VALUES (?, ?, '1', ?, ?, ?, ?, '02')""",
                        [cnpj + "000100", cnpj, email, tel, uf, cnae],
                    )
                except Exception:
                    pass

            por_cluster[cluster] = por_cluster.get(cluster, 0) + 1
            inseridos += 1

        if hasattr(conn, "commit"):
            conn.commit()

        return {
            "status": "ok",
            "leads_filtrados": inseridos,
            "por_cluster": por_cluster,
            "universo_estimado": self.icp.get("universo_estimado", 230000),
        }
