"""Carga DuckDB dos CSVs RF — layout tipado, direto em disco."""

import logging
import zipfile
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent.parent.parent


def _layout():
    with open(ROOT / "config" / "rf_layout.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


class RFLoader:
    """Carrega ZIPs RF no DuckDB com colunas nomeadas conforme layout oficial."""

    def __init__(self, conn, on_progress=None):
        self.conn = conn
        self.layout = _layout()
        self.on_progress = on_progress or (lambda msg, pct: None)

    def _extract_csv_path(self, zip_path: Path) -> Path | None:
        with zipfile.ZipFile(zip_path) as zf:
            names = [n for n in zf.namelist() if not n.endswith("/")]
            if not names:
                return None
            extract_dir = zip_path.parent / "_extract"
            extract_dir.mkdir(exist_ok=True)
            zf.extract(names[0], extract_dir)
            return extract_dir / names[0]

    def _load_csv(self, csv_path: Path, table: str, columns: list[str]) -> int:
        cols_sql = ", ".join(columns)
        path_posix = csv_path.as_posix().replace("\\", "/")
        self.conn.execute(f"DROP TABLE IF EXISTS {table}_raw")
        self.conn.execute(f"""
            CREATE TABLE {table}_raw AS
            SELECT * FROM read_csv(
                '{path_posix}',
                header=false,
                columns={{{', '.join(f"'{c}': 'VARCHAR'" for c in columns)}}},
                ignore_errors=true
            )
        """)
        count = self.conn.execute(f"SELECT COUNT(*) FROM {table}_raw").fetchone()[0]
        return count

    def load_empresas(self, zip_paths: list[Path]) -> int:
        cols = self.layout["empresas"]["columns"]
        self.conn.execute("DROP TABLE IF EXISTS rf_empresas")
        first = True
        total = 0
        for zp in zip_paths:
            if not zp.exists():
                continue
            csv = self._extract_csv_path(zp)
            if not csv:
                continue
            if first:
                self._load_csv(csv, "rf_empresas", cols)
                self.conn.execute(f"""
                    CREATE TABLE rf_empresas AS
                    SELECT *, TRY_CAST(REPLACE(REPLACE(capital_social, '.', ''), ',', '.') AS DOUBLE) AS capital_num
                    FROM rf_empresas_raw
                """)
                first = False
            else:
                self._load_csv(csv, "rf_empresas_part", cols)
                self.conn.execute(f"""
                    INSERT INTO rf_empresas
                    SELECT *, TRY_CAST(REPLACE(REPLACE(capital_social, '.', ''), ',', '.') AS DOUBLE) AS capital_num
                    FROM rf_empresas_part_raw
                """)
            total += self.conn.execute("SELECT COUNT(*) FROM rf_empresas").fetchone()[0]
            self.on_progress(f"Empresas carregadas: {total:,}", 30)
        return total

    def load_estabelecimentos(self, zip_paths: list[Path]) -> int:
        cols = self.layout["estabelecimentos"]["columns"]
        self.conn.execute("DROP TABLE IF EXISTS rf_estabelecimentos")
        first = True
        total = 0
        for zp in zip_paths:
            if not zp.exists():
                continue
            csv = self._extract_csv_path(zp)
            if not csv:
                continue
            tbl = "rf_estabelecimentos" if first else "rf_estabelecimentos_part"
            self._load_csv(csv, tbl, cols)
            if first:
                self.conn.execute(f"""
                    CREATE TABLE rf_estabelecimentos AS
                    SELECT *,
                        cnpj_basico || cnpj_ordem || cnpj_dv AS cnpj_completo,
                        TRIM(COALESCE(ddd1,'') || COALESCE(telefone1,'')) AS telefone
                    FROM rf_estabelecimentos_raw
                """)
                first = False
            else:
                self.conn.execute(f"""
                    INSERT INTO rf_estabelecimentos
                    SELECT *,
                        cnpj_basico || cnpj_ordem || cnpj_dv AS cnpj_completo,
                        TRIM(COALESCE(ddd1,'') || COALESCE(telefone1,'')) AS telefone
                    FROM rf_estabelecimentos_part_raw
                """)
            total = self.conn.execute("SELECT COUNT(*) FROM rf_estabelecimentos").fetchone()[0]
            self.on_progress(f"Estabelecimentos: {total:,}", 55)
        return total

    def load_simples(self, zip_path: Path) -> int:
        if not zip_path.exists():
            return 0
        cols = self.layout["simples"]["columns"]
        csv = self._extract_csv_path(zip_path)
        if not csv:
            return 0
        self._load_csv(csv, "rf_simples", cols)
        self.conn.execute("""
            CREATE OR REPLACE TABLE rf_simples AS SELECT * FROM rf_simples_raw
        """)
        count = self.conn.execute("SELECT COUNT(*) FROM rf_simples").fetchone()[0]
        self.on_progress(f"Simples Nacional: {count:,}", 65)
        return count

    def load_cnaes(self, zip_path: Path) -> int:
        if not zip_path.exists():
            return 0
        cols = self.layout["cnaes"]["columns"]
        csv = self._extract_csv_path(zip_path)
        if not csv:
            return 0
        self._load_csv(csv, "rf_cnaes", cols)
        self.conn.execute("CREATE OR REPLACE TABLE rf_cnaes AS SELECT * FROM rf_cnaes_raw")
        return self.conn.execute("SELECT COUNT(*) FROM rf_cnaes").fetchone()[0]

    def load_cnaes(self, zip_path: Path) -> int:
        if not zip_path.exists():
            return 0
        cols = self.layout["cnaes"]["columns"]
        csv = self._extract_csv_path(zip_path)
        if not csv:
            return 0
        self._load_csv(csv, "rf_cnaes", cols)
        self.conn.execute("CREATE OR REPLACE TABLE rf_cnaes AS SELECT * FROM rf_cnaes_raw")
        return self.conn.execute("SELECT COUNT(*) FROM rf_cnaes").fetchone()[0]

    def _load_lookup(self, zip_path: Path, table: str, cols: list[str]) -> int:
        if not zip_path.exists():
            return 0
        csv = self._extract_csv_path(zip_path)
        if not csv:
            return 0
        self._load_csv(csv, table, cols)
        self.conn.execute(f"CREATE OR REPLACE TABLE {table} AS SELECT * FROM {table}_raw")
        return self.conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]

    def load_socios(self, zip_paths: list[Path]) -> int:
        cols = self.layout["socios"]["columns"]
        self.conn.execute("DROP TABLE IF EXISTS rf_socios")
        first = True
        for zp in zip_paths:
            if not zp.exists():
                continue
            csv = self._extract_csv_path(zp)
            if not csv:
                continue
            tbl = "rf_socios" if first else "rf_socios_part"
            self._load_csv(csv, tbl, cols)
            if first:
                self.conn.execute("CREATE TABLE rf_socios AS SELECT * FROM rf_socios_raw")
                first = False
            else:
                self.conn.execute("INSERT INTO rf_socios SELECT * FROM rf_socios_part_raw")
            self.on_progress(f"Sócios: {self.conn.execute('SELECT COUNT(*) FROM rf_socios').fetchone()[0]:,}", 60)
        return self.conn.execute("SELECT COUNT(*) FROM rf_socios").fetchone()[0] if not first else 0

    def criar_views_icp(self):
        """Views para filtro Lucro Real + enriquecimento de endereços."""
        lr = self.layout.get("lucro_real", {})
        capital_min = lr.get("capital_min", 2000000)
        filiais_min = lr.get("filiais_min", 3)
        nj = ",".join(f"'{n}'" for n in lr.get("natureza_juridica", ["2062", "2054", "2046"]))

        self.conn.execute("""
            CREATE OR REPLACE VIEW vw_simples_ativo AS
            SELECT cnpj_basico FROM rf_simples
            WHERE opcao_simples = 'S'
              AND (data_exclusao_simples IS NULL OR TRIM(data_exclusao_simples) = '')
        """)
        self.conn.execute("""
            CREATE OR REPLACE VIEW vw_estabelecimentos_ativos AS
            SELECT * FROM rf_estabelecimentos WHERE situacao_cadastral = '02'
        """)
        self.conn.execute(f"""
            CREATE OR REPLACE VIEW vw_lucro_real_candidatas AS
            SELECT
                e.cnpj_basico,
                e.razao_social,
                e.capital_num AS capital_social,
                e.porte,
                e.natureza_juridica,
                COUNT(DISTINCT est.cnpj_completo) AS qtd_estabelecimentos,
                MAX(est.cnae_fiscal) AS cnae_principal,
                MAX(est.uf) AS uf,
                MAX(CASE WHEN est.matriz_filial = '1' THEN est.email END) AS email_matriz,
                MAX(CASE WHEN est.matriz_filial = '1' THEN est.telefone END) AS telefone_matriz
            FROM rf_empresas e
            INNER JOIN vw_estabelecimentos_ativos est ON est.cnpj_basico = e.cnpj_basico
            LEFT JOIN vw_simples_ativo s ON s.cnpj_basico = e.cnpj_basico
            WHERE s.cnpj_basico IS NULL
              AND e.capital_num >= {capital_min}
              AND e.natureza_juridica IN ({nj})
            GROUP BY e.cnpj_basico, e.razao_social, e.capital_num, e.porte, e.natureza_juridica
            HAVING COUNT(DISTINCT est.cnpj_completo) > {filiais_min}
        """)
        self.conn.execute("""
            CREATE OR REPLACE VIEW vw_lucro_real_enriched AS
            SELECT
                c.*,
                mat.cnpj_completo AS cnpj_matriz,
                mat.nome_fantasia,
                mat.municipio AS municipio_codigo,
                mat.cep,
                TRIM(COALESCE(mat.tipo_logradouro,'') || ' ' || COALESCE(mat.logradouro,'') || ', ' ||
                     COALESCE(mat.numero,'') || ' — ' || COALESCE(mat.bairro,'') || ' CEP ' || COALESCE(mat.cep,'')) AS endereco_matriz
            FROM vw_lucro_real_candidatas c
            LEFT JOIN vw_estabelecimentos_ativos mat
              ON mat.cnpj_basico = c.cnpj_basico AND mat.matriz_filial = '1'
        """)
        self.on_progress("Views Lucro Real enriquecidas criadas", 75)

    def load_versao(self, versao_dir: Path) -> dict:
        """Carrega todos os ZIPs de uma pasta versão."""
        empresas_zips = sorted(versao_dir.glob("Empresas*.zip"))
        estab_zips = sorted(versao_dir.glob("Estabelecimentos*.zip"))
        socios_zips = sorted(versao_dir.glob("Socios*.zip"))
        simples_zip = versao_dir / "Simples.zip"
        cnaes_zip = versao_dir / "Cnaes.zip"
        municipios_zip = versao_dir / "Municipios.zip"
        qual_zip = versao_dir / "Qualificacoes.zip"

        stats = {
            "empresas": self.load_empresas(empresas_zips),
            "estabelecimentos": self.load_estabelecimentos(estab_zips),
            "simples": self.load_simples(simples_zip),
            "cnaes": self.load_cnaes(cnaes_zip),
            "socios": self.load_socios(socios_zips),
            "municipios": self._load_lookup(municipios_zip, "rf_municipios", self.layout["municipios"]["columns"]),
            "qualificacoes": self._load_lookup(qual_zip, "rf_qualificacoes", self.layout["qualificacoes"]["columns"]),
        }
        self.criar_views_icp()
        if hasattr(self.conn, "commit"):
            self.conn.commit()
        return stats
