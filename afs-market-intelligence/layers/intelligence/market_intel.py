"""Inteligência de mercado — mapas, CNAE, auditorias, patrimonial, carência regional."""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DATA = ROOT / "data"

UF_COORDS = {
    "AC": (-9.974, -67.810), "AL": (-9.571, -36.782), "AM": (-3.119, -60.021),
    "AP": (0.034, -51.069), "BA": (-12.971, -38.501), "CE": (-3.717, -38.543),
    "DF": (-15.794, -47.882), "ES": (-20.315, -40.338), "GO": (-16.686, -49.265),
    "MA": (-2.530, -44.306), "MG": (-19.916, -43.934), "MS": (-20.443, -54.647),
    "MT": (-15.601, -56.097), "PA": (-1.455, -48.504), "PB": (-7.119, -34.845),
    "PE": (-8.047, -34.877), "PI": (-5.089, -42.801), "PR": (-25.428, -49.273),
    "RJ": (-22.907, -43.173), "RN": (-5.794, -35.211), "RO": (-8.761, -63.903),
    "RR": (2.823, -60.675), "RS": (-30.034, -51.217), "SC": (-27.595, -48.548),
    "SE": (-10.947, -37.073), "SP": (-23.550, -46.633), "TO": (-10.184, -48.333),
}

# Distribuição estimada LR (~230k) quando DB vazio
UF_ESTIMATED_LR = {
    "SP": 92000, "RJ": 28000, "MG": 24000, "RS": 18000, "PR": 16000,
    "SC": 12000, "BA": 9000, "PE": 7000, "CE": 6000, "GO": 5500,
    "DF": 5000, "ES": 4500, "PA": 3500, "MT": 3200, "MS": 2800,
    "MA": 2500, "RN": 2200, "PB": 2000, "AL": 1800, "PI": 1500,
    "SE": 1400, "RO": 1200, "TO": 1100, "AM": 1000, "AC": 400,
    "AP": 350, "RR": 300,
}

TIER_AUDIT = {
    "grande_media": {
        "faturamento_min_m": 80, "faturamento_max_m": 500,
        "raio_km": 450, "clientes_estimados": "200–800",
    },
    "media": {
        "faturamento_min_m": 15, "faturamento_max_m": 80,
        "raio_km": 220, "clientes_estimados": "50–200",
    },
    "pequena": {
        "faturamento_min_m": 3, "faturamento_max_m": 15,
        "raio_km": 90, "clientes_estimados": "10–50",
    },
}


def _load_json(name: str) -> dict:
    with open(DATA / name, encoding="utf-8") as f:
        return json.load(f)


def _jitter(lat: float, lng: float, spread: float = 0.35) -> tuple[float, float]:
    return lat + random.uniform(-spread, spread), lng + random.uniform(-spread, spread)


class CnaeSetores:
    """Correlação CNAE → setor produtivo (IBGE/CNAE 2.2)."""

    @classmethod
    def carregar(cls) -> dict:
        return _load_json("cnae_setores.json")

    @classmethod
    def listar(
        cls,
        q: str = "",
        secao: str = "",
        classificacao: str = "",
        limite: int = 100,
        offset: int = 0,
    ) -> dict:
        from layers.categorization.cnae_classificacao import classificar_divisao, listar_classificacao
        data = cls.carregar()
        rows = data["divisoes"]
        if secao:
            rows = [r for r in rows if r["secao"] == secao]
        if q:
            ql = q.lower()
            rows = [
                r for r in rows
                if ql in r["codigo"] or ql in r["divisao"].lower()
                or ql in r["setor_produtivo"].lower() or ql in r["secao_nome"].lower()
            ]
        cls_map = listar_classificacao()
        enriched = []
        for r in rows:
            item = dict(r)
            item["classificacao_afs"] = classificar_divisao(r["codigo"])
            item["nota_classificacao"] = (
                cls_map.get("quente", {}).get(r["codigo"])
                or cls_map.get("frio", {}).get(r["codigo"])
                or ""
            )
            enriched.append(item)
        if classificacao in ("quente", "frio", "neutro"):
            enriched = [r for r in enriched if r["classificacao_afs"] == classificacao]
        total = len(enriched)
        page = enriched[offset : offset + limite]
        return {
            "meta": data["meta"],
            "secoes": data["secoes"],
            "divisoes": page,
            "total": total,
            "limite": limite,
            "offset": offset,
            "classificacao": listar_classificacao(),
        }


class GeoIntel:
    """Agregação geográfica de prospectos Lucro Real (com filtros ICP)."""

    def __init__(self, conn, filters: dict | None = None):
        self.conn = conn
        self.filters = filters or {}

    def _where(self) -> tuple[str, list]:
        from layers.categorization.prospect_filters import sql_where
        return sql_where(self.filters)

    def _table_has_data(self) -> bool:
        try:
            return self.conn.execute("SELECT COUNT(*) FROM prospectos_rf").fetchone()[0] > 0
        except Exception:
            return False

    def _has_prospectos(self) -> bool:
        if not self._table_has_data():
            return False
        try:
            where, params = self._where()
            return self.conn.execute(
                f"SELECT COUNT(*) FROM prospectos_rf WHERE {where}", params
            ).fetchone()[0] > 0
        except Exception:
            return False

    def contar(self) -> int:
        try:
            where, params = self._where()
            return self.conn.execute(
                f"SELECT COUNT(*) FROM prospectos_rf WHERE {where}", params
            ).fetchone()[0]
        except Exception:
            return 0

    def agregado_uf(self) -> list[dict]:
        if not self._has_prospectos():
            total = sum(UF_ESTIMATED_LR.values())
            return [
                {"uf": uf, "total": n, "pct": round(100 * n / total, 2)}
                for uf, n in sorted(UF_ESTIMATED_LR.items(), key=lambda x: -x[1])
            ]
        where, params = self._where()
        rows = self.conn.execute(f"""
            SELECT uf, COUNT(*) AS total FROM prospectos_rf
            WHERE {where} AND uf IS NOT NULL AND uf != ''
            GROUP BY uf ORDER BY total DESC
        """, params).fetchall()
        grand = sum(r[1] for r in rows) or 1
        return [{"uf": r[0], "total": r[1], "pct": round(100 * r[1] / grand, 2)} for r in rows]

    def agregado_municipio(self, limite: int = 50) -> list[dict]:
        where, params = self._where()
        if not self._has_prospectos():
            return []
        rows = self.conn.execute(f"""
            SELECT uf, municipio_codigo, municipio_nome, COUNT(*) AS total,
                   AVG(capital_social) AS capital_medio
            FROM prospectos_rf
            WHERE {where} AND uf IS NOT NULL
            GROUP BY uf, municipio_codigo, municipio_nome
            ORDER BY total DESC LIMIT ?
        """, params + [limite]).fetchall()
        return [
            {
                "uf": r[0], "municipio_codigo": r[1], "municipio": r[2],
                "total": r[3], "capital_medio": round(r[4] or 0, 2),
            }
            for r in rows
        ]

    def pontos_nuvem(self, limite: int = 8000) -> list[dict]:
        from layers.categorization.prospect_filters import municipio_coords

        limite = min(limite, 15000)
        points: list[dict] = []
        where, params = self._where()

        if self._has_prospectos():
            rows = self.conn.execute(f"""
                SELECT uf, municipio_codigo, municipio_nome, capital_social, razao_social
                FROM prospectos_rf WHERE {where}
                ORDER BY score_prioridade DESC LIMIT ?
            """, params + [limite]).fetchall()
            for uf, cod, mun, cap, nome in rows:
                lat, lng = municipio_coords(uf, cod, mun)
                lat, lng = _jitter(lat, lng, 0.06)
                points.append({
                    "lat": lat, "lng": lng, "uf": uf, "municipio": mun,
                    "capital_social": cap, "razao_social": nome,
                })
            return points

        uf_filter = self.filters.get("uf")
        for row_uf, n in UF_ESTIMATED_LR.items():
            if uf_filter and row_uf != uf_filter:
                continue
            base = UF_COORDS[row_uf]
            sample = min(n, max(20, int(limite * n / 230000)))
            for _ in range(sample):
                lat, lng = _jitter(base[0], base[1], 1.2)
                points.append({"lat": lat, "lng": lng, "uf": row_uf, "municipio": None})
            if len(points) >= limite:
                break
        return points[:limite]

    def mapa_payload(self, limite: int = 8000) -> dict:
        if self._table_has_data():
            agg = self.agregado_uf()
            total = self.contar()
            return {
                "total_empresas": total,
                "fonte": "prospectos_rf",
                "filtros_aplicados": self.filters,
                "aggregado_uf": agg,
                "aggregado_municipio": self.agregado_municipio(30),
                "pontos": self.pontos_nuvem(limite),
            }
        agg = self.agregado_uf()
        return {
            "total_empresas": sum(a["total"] for a in agg),
            "fonte": "estimativa_lr",
            "filtros_aplicados": self.filters,
            "aggregado_uf": agg,
            "aggregado_municipio": [],
            "pontos": self.pontos_nuvem(limite),
        }


class AuditIntel:
    """Enriquecimento de bancas de auditoria — sede, filiais (futuro), raio de atuação."""

    @classmethod
    def listar(cls, uf: str | None = None, tier: str | None = None) -> dict:
        data = _load_json("audit_firms.json")
        firmas = []
        for f in data["firmas"]:
            if uf and f.get("uf") != uf:
                continue
            t = f.get("tier", "media")
            if tier and t != tier:
                continue
            meta_t = TIER_AUDIT.get(t, TIER_AUDIT["media"])
            sede = UF_COORDS.get(f.get("uf", "SP"), UF_COORDS["SP"])
            lat, lng = _jitter(sede[0], sede[1], 0.08)
            firmas.append({
                **f,
                "tipo": "auditoria",
                "sede": {"uf": f.get("uf"), "lat": lat, "lng": lng},
                "filiais": f.get("filiais", []),
                "faturamento_estimado_m": {
                    "min": meta_t["faturamento_min_m"],
                    "max": meta_t["faturamento_max_m"],
                    "unidade": "R$ milhões/ano",
                    "metodo": "heurística por tier e porte da rede",
                },
                "raio_atuacao_km": meta_t["raio_km"],
                "clientes_estimados": meta_t["clientes_estimados"],
                "scraping_status": f.get("scraping_status", "pendente"),
            })
        return {
            "meta": data["meta"],
            "excluidas_top10": data["excluidas_top10"],
            "total": len(firmas),
            "firmas": firmas,
            "nota_ia": (
                "Próxima fase: raspagem CVM/RF de filiais, CRC e porte real. "
                "Raio calculado por tier de faturamento estimado."
            ),
        }


class PatrimonialIntel:
    """Prestadores de controle patrimonial — seed + CNAEs-alvo."""

    CNAES_ALVO = ["7739099", "6822600", "7020400", "7112000", "7490199"]

    @classmethod
    def listar(cls, uf: str | None = None) -> dict:
        data = _load_json("patrimonial_providers_seed.json")
        providers = []
        for p in data["prestadores"]:
            if uf and p.get("uf") != uf:
                continue
            sede = UF_COORDS.get(p.get("uf", "SP"), UF_COORDS["SP"])
            lat, lng = _jitter(sede[0], sede[1], 0.12)
            providers.append({
                **p,
                "tipo": "controle_patrimonial",
                "sede": {"uf": p.get("uf"), "lat": lat, "lng": lng},
                "scraping_status": p.get("scraping_status", "seed"),
            })
        return {
            "meta": data["meta"],
            "cnaes_alvo": data.get("cnaes_alvo", cls.CNAES_ALVO),
            "total": len(providers),
            "prestadores": providers,
            "nota_ia": data.get("nota_ia", ""),
        }

    def pontos_mapa(self, uf: str | None = None) -> list[dict]:
        payload = self.listar(uf)
        return [
            {"lat": p["sede"]["lat"], "lng": p["sede"]["lng"], "uf": p["uf"], "nome": p["nome"]}
            for p in payload["prestadores"]
        ]


class CarenciaIntel:
    """Cruzamento empresas LR × cobertura auditorias × prestadores patrimoniais."""

    def __init__(self, conn):
        self.conn = conn
        self.geo = GeoIntel(conn)

    def analisar(self) -> dict:
        empresas = {a["uf"]: a["total"] for a in self.geo.agregado_uf()}
        audits = AuditIntel.listar()["firmas"]
        audit_by_uf: dict[str, int] = {}
        audit_raio_sum: dict[str, float] = {}
        for a in audits:
            u = a.get("uf", "SP")
            audit_by_uf[u] = audit_by_uf.get(u, 0) + 1
            audit_raio_sum[u] = audit_raio_sum.get(u, 0) + a["raio_atuacao_km"]

        pat = PatrimonialIntel.listar()["prestadores"]
        pat_by_uf: dict[str, int] = {}
        for p in pat:
            u = p.get("uf", "SP")
            pat_by_uf[u] = pat_by_uf.get(u, 0) + 1

        regioes = []
        for uf, total_emp in empresas.items():
            n_audit = audit_by_uf.get(uf, 0)
            n_pat = pat_by_uf.get(uf, 0)
            cobertura_audit = min(100, round(100 * n_audit * 15 / max(total_emp / 1000, 1), 1))
            cobertura_pat = min(100, round(100 * n_pat * 8 / max(total_emp / 1000, 1), 1))
            carencia_pat = max(0, 100 - cobertura_pat)
            score_cold_mail = round(
                (total_emp / 1000) * 0.5 + carencia_pat * 0.35 + (100 - cobertura_audit) * 0.15,
                1,
            )
            coords = UF_COORDS.get(uf, (-15.78, -47.93))
            regioes.append({
                "uf": uf,
                "empresas_lr": total_emp,
                "auditorias": n_audit,
                "prestadores_patrimonial": n_pat,
                "cobertura_auditoria_pct": cobertura_audit,
                "cobertura_patrimonial_pct": cobertura_pat,
                "carencia_patrimonial_pct": carencia_pat,
                "score_prioridade_cold_mail": score_cold_mail,
                "lat": coords[0],
                "lng": coords[1],
            })
        regioes.sort(key=lambda r: -r["score_prioridade_cold_mail"])
        return {
            "regioes": regioes,
            "top5_cold_mail": regioes[:5],
            "metodologia": (
                "Score = volume LR (50%) + carência patrimonial (35%) + baixa cobertura auditoria (15%). "
                "Refinar com raspagem de filiais e dados reais de faturamento."
            ),
        }
