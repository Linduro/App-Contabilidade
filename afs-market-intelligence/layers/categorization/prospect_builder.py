"""Monta base de prospecção em massa — ~230k Lucro Real com dados completos RF."""

import logging
import yaml
from pathlib import Path

logger = logging.getLogger(__name__)
CONFIG_DIR = Path(__file__).resolve().parent.parent.parent / "config"


class ProspectBuilder:
    """
    Extrai do DuckDB todas as empresas Lucro Real com:
    CNPJ, endereços, sócios-chave, e-mails, CNAEs.
    Usa SQL em bulk (sem loop Python) para performance.
    """

    def __init__(self, perfil: str = "patrimonial", modo: str = "completo"):
        self.perfil = perfil
        self.modo = modo  # completo = todas LR | icp_afs = só clusters AFS
        with open(CONFIG_DIR / "clusters.yaml", encoding="utf-8") as f:
            self.clusters = yaml.safe_load(f)["clusters"]
        with open(CONFIG_DIR / "rf_layout.yaml", encoding="utf-8") as f:
            self.rf = yaml.safe_load(f)

    def _init_schema(self, conn):
        schema_path = CONFIG_DIR.parent / "db" / "schema_prospect.sql"
        if schema_path.exists():
            for stmt in schema_path.read_text(encoding="utf-8").split(";"):
                stmt = stmt.strip()
                if stmt:
                    try:
                        conn.execute(stmt)
                    except Exception as e:
                        logger.debug("[prospect] schema stmt: %s", e)

    def classificar_cluster_sql(self) -> str:
        cases = []
        for nome, cfg in self.clusters.items():
            if nome == "outro" or not cfg.get("cnae_prefixos"):
                continue
            for p in cfg["cnae_prefixos"]:
                cases.append(f"WHEN SUBSTR(c.cnae_principal, 1, 2) = '{p}' THEN '{nome}'")
        if not cases:
            return "'outro'"
        return "CASE " + " ".join(cases) + " ELSE 'outro' END"

    def contar(self, conn) -> dict:
        try:
            total = conn.execute("SELECT COUNT(*) FROM vw_lucro_real_candidatas").fetchone()[0]
            com_email = conn.execute("""
                SELECT COUNT(*) FROM vw_lucro_real_candidatas WHERE email_matriz IS NOT NULL AND TRIM(email_matriz) != ''
            """).fetchone()[0]
            return {"candidatas_lucro_real": total, "com_email_matriz": com_email}
        except Exception:
            return {"candidatas_lucro_real": 0, "com_email_matriz": 0}

    def construir(self, conn, snapshot_id: int = 0) -> dict:
        self._init_schema(conn)
        cluster_sql = self.classificar_cluster_sql()
        qual_chave = self.rf.get("qualificacoes_chave", [])

        self.on_progress = getattr(self, "_progress_cb", lambda m, p: None)
        self.on_progress("Limpando base anterior…", 5)
        conn.execute("DELETE FROM prospectos_rf WHERE perfil_uso = ?", [self.perfil])

        where_cluster = ""
        if self.modo == "icp_afs":
            prefixos = set()
            with open(CONFIG_DIR / "icp.yaml", encoding="utf-8") as f:
                icp = yaml.safe_load(f)["icp"]
            for grupo in icp.get("cnae_obrigatorio_prefixos", {}).values():
                prefixos.update(grupo)
            in_list = ",".join(f"'{p}'" for p in prefixos)
            where_cluster = f"AND SUBSTR(c.cnae_principal, 1, 2) IN ({in_list})"

        self.on_progress("Inserindo prospectos Lucro Real (bulk)…", 15)
        conn.execute(f"""
            INSERT INTO prospectos_rf (
                cnpj_basico, cnpj_matriz, razao_social, nome_fantasia, capital_social, porte,
                natureza_juridica, regime_proxy, cluster_estrategico, cnae_principal,
                cnae_principal_descricao, email_matriz, telefone_matriz, endereco_matriz,
                uf, municipio_codigo, cep, qtd_estabelecimentos, score_prioridade,
                snapshot_id, perfil_uso, status_funil
            )
            SELECT
                c.cnpj_basico,
                c.cnpj_matriz,
                c.razao_social,
                c.nome_fantasia,
                c.capital_social,
                c.porte,
                c.natureza_juridica,
                'LR',
                {cluster_sql},
                c.cnae_principal,
                cn.descricao,
                NULLIF(TRIM(LOWER(c.email_matriz)), ''),
                c.telefone_matriz,
                c.endereco_matriz,
                c.uf,
                c.municipio_codigo,
                c.cep,
                c.qtd_estabelecimentos,
                COALESCE(c.capital_social, 0) / 1000000.0 + COALESCE(c.qtd_estabelecimentos, 0) * 0.5,
                ?,
                ?,
                'prospectado'
            FROM vw_lucro_real_enriched c
            LEFT JOIN rf_cnaes cn ON cn.codigo = c.cnae_principal
            WHERE 1=1 {where_cluster}
        """, [snapshot_id, self.perfil])

        total = conn.execute(
            "SELECT COUNT(*) FROM prospectos_rf WHERE perfil_uso = ?", [self.perfil]
        ).fetchone()[0]

        self.on_progress("Carregando estabelecimentos…", 45)
        estab_count = self._carregar_estabelecimentos(conn)

        self.on_progress("Carregando sócios e pessoas-chave…", 65)
        socios_count = self._carregar_socios(conn, qual_chave)

        self.on_progress("Consolidando e-mails e sócios nos prospectos…", 85)
        self._consolidar_contatos(conn, qual_chave)
        self._atualizar_simples_abertura(conn)

        self.on_progress("Sincronizando leads_icp…", 92)
        self._sync_leads_icp(conn)

        if hasattr(conn, "commit"):
            conn.commit()

        stats = self._stats(conn)
        return {
            "status": "ok",
            "prospectos_inseridos": total,
            "estabelecimentos": estab_count,
            "socios": socios_count,
            "modo": self.modo,
            **stats,
        }

    def _carregar_estabelecimentos(self, conn) -> int:
        conn.execute("DELETE FROM estabelecimentos_rf")
        conn.execute("""
            INSERT INTO estabelecimentos_rf (
                cnpj_completo, cnpj_basico, matriz_filial, nome_fantasia, situacao_cadastral,
                cnae_fiscal, cnae_descricao, cnae_secundario, tipo_logradouro, logradouro,
                numero, complemento, bairro, cep, uf, municipio_codigo, municipio_nome,
                telefone, email, endereco_completo, data_inicio
            )
            SELECT
                est.cnpj_completo,
                est.cnpj_basico,
                est.matriz_filial,
                est.nome_fantasia,
                est.situacao_cadastral,
                est.cnae_fiscal,
                cn.descricao,
                est.cnae_secundario,
                est.tipo_logradouro,
                est.logradouro,
                est.numero,
                est.complemento,
                est.bairro,
                est.cep,
                est.uf,
                est.municipio,
                mun.descricao,
                est.telefone,
                NULLIF(TRIM(LOWER(est.email)), ''),
                TRIM(COALESCE(est.tipo_logradouro,'') || ' ' || COALESCE(est.logradouro,'') || ', ' ||
                     COALESCE(est.numero,'') || ' — ' || COALESCE(est.bairro,'') || ', ' ||
                     COALESCE(mun.descricao,'') || '/' || COALESCE(est.uf,'') || ' CEP ' || COALESCE(est.cep,'')),
                est.data_inicio
            FROM rf_estabelecimentos est
            INNER JOIN prospectos_rf p ON p.cnpj_basico = est.cnpj_basico
            LEFT JOIN rf_cnaes cn ON cn.codigo = est.cnae_fiscal
            LEFT JOIN rf_municipios mun ON mun.codigo = est.municipio
            WHERE est.situacao_cadastral = '02'
        """)
        return conn.execute("SELECT COUNT(*) FROM estabelecimentos_rf").fetchone()[0]

    def _carregar_socios(self, conn, qual_chave: list) -> int:
        conn.execute("DELETE FROM socios_rf")
        in_qual = ",".join(f"'{q}'" for q in qual_chave) if qual_chave else "'49','10','16','05'"
        conn.execute(f"""
            INSERT OR IGNORE INTO socios_rf (
                cnpj_basico, nome_socio, cpf_cnpj_socio, qualificacao_codigo,
                qualificacao_descricao, data_entrada, is_pessoa_chave
            )
            SELECT
                s.cnpj_basico,
                s.nome_socio,
                s.cnpj_cpf_socio,
                s.qualificacao_socio,
                q.descricao,
                s.data_entrada_sociedade,
                CASE WHEN s.qualificacao_socio IN ({in_qual}) THEN TRUE ELSE FALSE END
            FROM rf_socios s
            INNER JOIN prospectos_rf p ON p.cnpj_basico = s.cnpj_basico
            LEFT JOIN rf_qualificacoes q ON q.codigo = s.qualificacao_socio
            WHERE TRIM(s.nome_socio) != ''
        """)
        return conn.execute("SELECT COUNT(*) FROM socios_rf").fetchone()[0]

    def _consolidar_contatos(self, conn, qual_chave: list):
        conn.execute("""
            UPDATE prospectos_rf SET qtd_socios = (
                SELECT COUNT(*) FROM socios_rf s WHERE s.cnpj_basico = prospectos_rf.cnpj_basico
            )
        """)
        conn.execute("""
            UPDATE prospectos_rf SET socios_chave = (
                SELECT string_agg(nome_socio || ' (' || COALESCE(qualificacao_descricao, qualificacao_codigo) || ')', '; ')
                FROM socios_rf s
                WHERE s.cnpj_basico = prospectos_rf.cnpj_basico AND s.is_pessoa_chave = TRUE
            )
        """)
        conn.execute("""
            UPDATE prospectos_rf SET emails_encontrados = (
                SELECT string_agg(DISTINCT email, '; ')
                FROM estabelecimentos_rf e
                WHERE e.cnpj_basico = prospectos_rf.cnpj_basico
                  AND email IS NOT NULL AND TRIM(email) != ''
            )
        """)
        conn.execute("""
            UPDATE prospectos_rf SET municipio_nome = (
                SELECT MAX(municipio_nome) FROM estabelecimentos_rf e
                WHERE e.cnpj_basico = prospectos_rf.cnpj_basico AND e.matriz_filial = '1'
            )
        """)

    def _atualizar_simples_abertura(self, conn):
        from layers.enrichment.contato_cascade import init_enrichment_schema
        init_enrichment_schema(conn)
        try:
            conn.execute("""
                UPDATE prospectos_rf SET
                    opcao_simples = s.opcao_simples,
                    opcao_mei = s.opcao_mei
                FROM rf_simples s
                WHERE s.cnpj_basico = prospectos_rf.cnpj_basico
            """)
        except Exception as e:
            logger.debug("[prospect] simples: %s", e)
        try:
            conn.execute("""
                UPDATE prospectos_rf SET data_abertura = sub.dt
                FROM (
                    SELECT cnpj_basico, MIN(data_inicio) AS dt
                    FROM estabelecimentos_rf
                    WHERE matriz_filial = '1' AND data_inicio IS NOT NULL
                    GROUP BY cnpj_basico
                ) sub
                WHERE sub.cnpj_basico = prospectos_rf.cnpj_basico
            """)
        except Exception as e:
            logger.debug("[prospect] abertura: %s", e)

    def _sync_leads_icp(self, conn):
        conn.execute("""
            INSERT OR REPLACE INTO leads_icp (
                cnpj_basico, razao_social, cluster_estrategico, capital_social, qtd_filiais,
                score_prioridade, perfil_uso
            )
            SELECT cnpj_basico, razao_social, cluster_estrategico, capital_social,
                   qtd_estabelecimentos, score_prioridade, perfil_uso
            FROM prospectos_rf
        """)

    def _stats(self, conn) -> dict:
        row = conn.execute("""
            SELECT
                COUNT(*),
                SUM(CASE WHEN email_matriz IS NOT NULL AND email_matriz != '' THEN 1 ELSE 0 END),
                SUM(CASE WHEN socios_chave IS NOT NULL AND socios_chave != '' THEN 1 ELSE 0 END),
                SUM(CASE WHEN cluster_estrategico != 'outro' THEN 1 ELSE 0 END)
            FROM prospectos_rf WHERE perfil_uso = ?
        """, [self.perfil]).fetchone()
        por_cluster = conn.execute("""
            SELECT cluster_estrategico, COUNT(*) FROM prospectos_rf
            WHERE perfil_uso = ? GROUP BY cluster_estrategico ORDER BY 2 DESC
        """, [self.perfil]).fetchall()
        return {
            "total_prospectos": row[0] if row else 0,
            "com_email_matriz": row[1] if row else 0,
            "com_socios_chave": row[2] if row else 0,
            "icp_afs": row[3] if row else 0,
            "por_cluster": {c: n for c, n in por_cluster},
        }
