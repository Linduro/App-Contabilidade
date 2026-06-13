"""Busca reativa estilo Leads2b — filtros cumulativos + contagens por aba."""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from layers.categorization.prospect_filters import load_defaults, parse_filters, sql_where

SEGMENTACOES_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "segmentacoes.json"

PORTE_LABELS = {
    "01": "Micro", "1": "Micro",
    "03": "EPP", "3": "EPP",
    "05": "Demais", "5": "Demais",
    "00": "Não informado", "0": "Não informado",
}

PORTE_ALIASES = {
    "01": ("01", "1"), "1": ("01", "1"),
    "03": ("03", "3"), "3": ("03", "3"),
    "05": ("05", "5"), "5": ("05", "5"),
    "00": ("00", "0"), "0": ("00", "0"),
}


def _expand_portes(portes: list) -> list[str]:
    out: set[str] = set()
    for p in portes:
        s = str(p).strip()
        if s in PORTE_ALIASES:
            out.update(PORTE_ALIASES[s])
        elif s:
            out.add(s)
    return sorted(out)


def default_filtros() -> dict:
    cfg = load_defaults().get("icp_ativo", {})
    return {
        "capital_min": cfg.get("capital_min"),
        "capital_max": cfg.get("capital_max"),
        "ufs": [],
        "clusters": [],
        "cnaes": [],
        "cnae_divisoes": [],
        "municipios": [],
        "portes": [],
        "naturezas": [],
        "q": None,
        "socio_nome": None,
        "tipo_estabelecimento": "todos",
        "situacao_cadastral": "todos",
        "data_abertura_de": None,
        "data_abertura_ate": None,
        "apenas_email": False,
        "apenas_telefone": False,
        "excluir_enriquecidas": False,
        "excluir_cnpjs": [],
        "novas_dias": 90,
    }


def parse_filtros_body(body: dict | None) -> dict:
    """Normaliza payload JSON da UI (POST /search, /count)."""
    raw = body or {}
    f = raw.get("filtros") if isinstance(raw.get("filtros"), dict) else raw
    base = default_filtros()

    def lst(key):
        v = f.get(key)
        if v is None:
            return base[key] if isinstance(base.get(key), list) else []
        if isinstance(v, str):
            return [x.strip() for x in v.split(",") if x.strip()]
        return [str(x).strip() for x in v if str(x).strip()]

    cap_min = f.get("capital_min", f.get("capitalMin"))
    cap_max = f.get("capital_max", f.get("capitalMax"))

    out = {
        **base,
        "uf": (f.get("uf") or "").strip() or None,
        "cluster": (f.get("cluster") or "").strip() or None,
        "cnae": (f.get("cnae") or "").strip() or None,
        "porte": (f.get("porte") or "").strip() or None,
        "municipio": (f.get("municipio") or "").strip() or None,
        "q": (f.get("q") or "").strip() or None,
        "capital_min": float(cap_min) if cap_min not in (None, "") else base["capital_min"],
        "capital_max": float(cap_max) if cap_max not in (None, "") else base["capital_max"],
        "ufs": lst("ufs") or ([f.get("uf")] if f.get("uf") else []),
        "clusters": lst("clusters") or ([f.get("cluster")] if f.get("cluster") else []),
        "cnaes": lst("cnaes") or ([f.get("cnae")] if f.get("cnae") else []),
        "cnae_divisoes": lst("cnae_divisoes"),
        "municipios": lst("municipios") or ([f.get("municipio")] if f.get("municipio") else []),
        "portes": lst("portes") or ([f.get("porte")] if f.get("porte") else []),
        "naturezas": lst("naturezas"),
        "socio_nome": (f.get("socio_nome") or "").strip() or None,
        "tipo_estabelecimento": f.get("tipo_estabelecimento") or "todos",
        "situacao_cadastral": f.get("situacao_cadastral") or "todos",
        "data_abertura_de": f.get("data_abertura_de") or None,
        "data_abertura_ate": f.get("data_abertura_ate") or None,
        "apenas_email": bool(f.get("apenas_email")),
        "apenas_telefone": bool(f.get("apenas_telefone")),
        "excluir_enriquecidas": bool(f.get("excluir_enriquecidas")),
        "excluir_cnpjs": lst("excluir_cnpjs"),
        "novas_dias": int(f.get("novas_dias") or 90),
    }
    if out["ufs"] and not out["uf"]:
        out["uf"] = out["ufs"][0] if len(out["ufs"]) == 1 else None
    return out


def _legacy_slice(filtros: dict) -> dict:
    """Compatível com sql_where legado (single uf/cluster/cnae/porte)."""
    f = dict(filtros)
    if f.get("ufs") and len(f["ufs"]) == 1:
        f["uf"] = f["ufs"][0]
    elif f.get("ufs"):
        f["uf"] = None
    if f.get("clusters") and len(f["clusters"]) == 1:
        f["cluster"] = f["clusters"][0]
    elif f.get("clusters"):
        f["cluster"] = None
    if f.get("cnaes") and len(f["cnaes"]) == 1:
        f["cnae"] = f["cnaes"][0]
    elif f.get("cnaes"):
        f["cnae"] = None
    if f.get("portes"):
        f["porte"] = None
    if f.get("municipios") and len(f["municipios"]) == 1:
        f["municipio"] = f["municipios"][0]
    elif f.get("municipios"):
        f["municipio"] = None
    return f


def build_where(filtros: dict, alias: str = "p", aba: str | None = None) -> tuple[str, list]:
    """Monta WHERE parametrizado. `aba` aplica filtro de enriquecimento/novas."""
    f = _legacy_slice(filtros)
    where, params = sql_where(f, prefix=alias)

    clauses = [where]
    p = f"{alias}."

    if filtros.get("ufs") and len(filtros["ufs"]) > 1:
        placeholders = ", ".join("?" for _ in filtros["ufs"])
        clauses.append(f"{p}uf IN ({placeholders})")
        params.extend(filtros["ufs"])

    if filtros.get("clusters") and len(filtros["clusters"]) > 1:
        placeholders = ", ".join("?" for _ in filtros["clusters"])
        clauses.append(f"{p}cluster_estrategico IN ({placeholders})")
        params.extend(filtros["clusters"])

    if filtros.get("cnaes") and len(filtros["cnaes"]) > 1:
        cnae_parts = []
        for c in filtros["cnaes"]:
            cnae_parts.append(f"({p}cnae_principal LIKE ? OR {p}cnae_principal LIKE ?)")
            cc = c.replace("-", "").replace("/", "")
            params.extend([f"{cc}%", f"{c}%"])
        clauses.append("(" + " OR ".join(cnae_parts) + ")")

    if filtros.get("portes"):
        expanded = _expand_portes(filtros["portes"])
        placeholders = ", ".join("?" for _ in expanded)
        clauses.append(f"CAST({p}porte AS VARCHAR) IN ({placeholders})")
        params.extend(expanded)

    if filtros.get("cnae_divisoes"):
        div_parts = []
        for d in filtros["cnae_divisoes"]:
            dc = str(d).replace("-", "").strip()[:2]
            if dc:
                div_parts.append(f"{p}cnae_principal LIKE ?")
                params.append(f"{dc}%")
        if div_parts:
            clauses.append("(" + " OR ".join(div_parts) + ")")

    if filtros.get("municipios") and len(filtros["municipios"]) > 1:
        mun_parts = []
        for m in filtros["municipios"]:
            mun_parts.append(f"({p}municipio_nome ILIKE ? OR {p}municipio_codigo = ?)")
            params.extend([f"%{m}%", m])
        clauses.append("(" + " OR ".join(mun_parts) + ")")

    if filtros.get("naturezas"):
        placeholders = ", ".join("?" for _ in filtros["naturezas"])
        clauses.append(f"{p}natureza_juridica IN ({placeholders})")
        params.extend(filtros["naturezas"])

    if filtros.get("socio_nome"):
        clauses.append(
            f"EXISTS (SELECT 1 FROM socios_rf s WHERE s.cnpj_basico = {p}cnpj_basico "
            f"AND s.nome_socio ILIKE ?)"
        )
        params.append(f"%{filtros['socio_nome']}%")

    tipo = filtros.get("tipo_estabelecimento") or "todos"
    if tipo == "matriz":
        clauses.append(f"COALESCE({p}qtd_estabelecimentos, 1) <= 1")
    elif tipo == "filial":
        clauses.append(f"COALESCE({p}qtd_estabelecimentos, 0) > 1")

    sit = filtros.get("situacao_cadastral") or "todos"
    if sit == "ativa":
        clauses.append(
            f"EXISTS (SELECT 1 FROM estabelecimentos_rf e WHERE e.cnpj_basico = {p}cnpj_basico "
            f"AND e.matriz_filial = '1' AND UPPER(COALESCE(e.situacao_cadastral,'')) IN ('02','2','ATIVA'))"
        )
    elif sit == "inativa":
        clauses.append(
            f"EXISTS (SELECT 1 FROM estabelecimentos_rf e WHERE e.cnpj_basico = {p}cnpj_basico "
            f"AND e.matriz_filial = '1' AND UPPER(COALESCE(e.situacao_cadastral,'')) NOT IN ('02','2','ATIVA',''))"
        )

    if filtros.get("data_abertura_de"):
        clauses.append(
            f"EXISTS (SELECT 1 FROM estabelecimentos_rf e WHERE e.cnpj_basico = {p}cnpj_basico "
            f"AND e.matriz_filial = '1' AND e.data_inicio >= ?)"
        )
        params.append(str(filtros["data_abertura_de"]).replace("-", "")[:8])

    if filtros.get("data_abertura_ate"):
        clauses.append(
            f"EXISTS (SELECT 1 FROM estabelecimentos_rf e WHERE e.cnpj_basico = {p}cnpj_basico "
            f"AND e.matriz_filial = '1' AND e.data_inicio <= ?)"
        )
        params.append(str(filtros["data_abertura_ate"]).replace("-", "")[:8])

    if filtros.get("apenas_email"):
        clauses.append(
            f"(( {p}email_matriz IS NOT NULL AND TRIM({p}email_matriz) != '') "
            f"OR ({p}emails_encontrados IS NOT NULL AND TRIM({p}emails_encontrados) != ''))"
        )

    if filtros.get("apenas_telefone"):
        clauses.append(f"({p}telefone_matriz IS NOT NULL AND TRIM({p}telefone_matriz) != '')")

    if filtros.get("excluir_cnpjs"):
        placeholders = ", ".join("?" for _ in filtros["excluir_cnpjs"])
        clauses.append(f"{p}cnpj_basico NOT IN ({placeholders})")
        params.extend(filtros["excluir_cnpjs"])

    enriched_sql = _enriched_predicate(alias)
    if filtros.get("excluir_enriquecidas"):
        clauses.append(f"NOT ({enriched_sql})")

    if aba == "nao_enriquecidas":
        clauses.append(f"NOT ({enriched_sql})")
    elif aba == "enriquecidas":
        clauses.append(f"({enriched_sql})")
    elif aba == "novas":
        dias = int(filtros.get("novas_dias") or 90)
        cutoff = (datetime.utcnow() - timedelta(days=dias)).strftime("%Y%m%d")
        clauses.append(
            f"EXISTS (SELECT 1 FROM estabelecimentos_rf e WHERE e.cnpj_basico = {p}cnpj_basico "
            f"AND e.matriz_filial = '1' AND e.data_inicio >= ?)"
        )
        params.append(cutoff)

    return " AND ".join(clauses), params


def _enriched_predicate(alias: str = "p") -> str:
    p = f"{alias}."
    return (
        f"(({p}emails_encontrados IS NOT NULL AND TRIM({p}emails_encontrados) != '') "
        f"OR ({p}email_matriz IS NOT NULL AND TRIM({p}email_matriz) != '') "
        f"OR ({p}telefone_matriz IS NOT NULL AND TRIM({p}telefone_matriz) != ''))"
    )


def count_tabs(conn, filtros: dict) -> dict[str, int]:
    base_where, base_params = build_where(filtros, aba=None)
    sql_base = f"SELECT COUNT(*) FROM prospectos_rf p WHERE {base_where}"

    def cnt(aba: str | None):
        w, pr = build_where(filtros, aba=aba)
        return conn.execute(f"SELECT COUNT(*) FROM prospectos_rf p WHERE {w}", pr).fetchone()[0]

    try:
        return {
            "todas": conn.execute(sql_base, base_params).fetchone()[0],
            "nao_enriquecidas": cnt("nao_enriquecidas"),
            "enriquecidas": cnt("enriquecidas"),
            "novas": cnt("novas"),
        }
    except Exception:
        return {"todas": 0, "nao_enriquecidas": 0, "enriquecidas": 0, "novas": 0}


def search_rows(
    conn,
    filtros: dict,
    *,
    aba: str = "todas",
    page: int = 1,
    page_size: int = 25,
    sort: str = "score_desc",
    for_batch: bool = False,
) -> tuple[list[dict], int]:
    page = max(1, int(page))
    page_size = min(max(1, int(page_size)), 5000 if for_batch else 100)
    offset = (page - 1) * page_size

    aba_key = aba if aba in ("nao_enriquecidas", "enriquecidas", "novas") else None
    where, params = build_where(filtros, aba=aba_key)

    order = {
        "score_desc": "p.score_prioridade DESC NULLS LAST",
        "capital_desc": "p.capital_social DESC NULLS LAST",
        "razao_asc": "p.razao_social ASC NULLS LAST",
        "abertura_desc": "p.created_at DESC",
    }.get(sort, "p.score_prioridade DESC NULLS LAST")

    total = conn.execute(f"SELECT COUNT(*) FROM prospectos_rf p WHERE {where}", params).fetchone()[0]

    sql = f"""
        SELECT p.cnpj_basico, p.cnpj_matriz, p.razao_social, p.nome_fantasia,
               p.capital_social, p.porte, p.natureza_juridica, p.cluster_estrategico,
               p.cnae_principal, p.cnae_principal_descricao, p.uf, p.municipio_nome,
               p.email_matriz, p.telefone_matriz, p.emails_encontrados, p.qtd_estabelecimentos,
               p.score_prioridade, p.status_funil,
               ({_enriched_predicate('p')}) AS enriquecida
        FROM prospectos_rf p
        WHERE {where}
        ORDER BY {order}
        LIMIT ? OFFSET ?
    """
    qparams = params + [page_size, offset]
    rows = conn.execute(sql, qparams).fetchall()
    cols = [
        "cnpj_basico", "cnpj_matriz", "razao_social", "nome_fantasia", "capital_social",
        "porte", "natureza_juridica", "cluster", "cnae", "cnae_descricao", "uf", "municipio",
        "email_matriz", "telefone_matriz", "emails_encontrados", "qtd_filiais", "score",
        "status_funil", "enriquecida",
    ]
    out = []
    for r in rows:
        d = dict(zip(cols, r))
        d["enriquecida"] = bool(d["enriquecida"])
        d["tipo"] = "Matriz" if (d.get("qtd_filiais") or 0) <= 1 else "Matriz + filiais"
        d["contatos_label"] = _contatos_label(d)
        out.append(d)
    return out, total


def _contatos_label(row: dict) -> str:
    if row.get("enriquecida"):
        n = 0
        if row.get("email_matriz"):
            n += 1
        if row.get("telefone_matriz"):
            n += 1
        emails = (row.get("emails_encontrados") or "").split(";")
        n += len([e for e in emails if e.strip()])
        return f"{n} contato(s)" if n else "Enriquecida"
    return "Revelar contatos"


def search_cnaes(conn, q: str, limit: int = 20) -> list[dict]:
    q = (q or "").strip()
    if not q:
        sql = """
            SELECT cnae_principal, MAX(cnae_principal_descricao) AS descricao, COUNT(*) AS n
            FROM prospectos_rf
            WHERE cnae_principal IS NOT NULL
            GROUP BY cnae_principal ORDER BY n DESC LIMIT ?
        """
        rows = conn.execute(sql, [limit]).fetchall()
    else:
        sql = """
            SELECT DISTINCT cnae_principal, cnae_principal_descricao
            FROM prospectos_rf
            WHERE cnae_principal ILIKE ? OR cnae_principal_descricao ILIKE ?
            LIMIT ?
        """
        like = f"%{q}%"
        rows = conn.execute(sql, [like, like, limit]).fetchall()
    return [{"codigo": r[0], "descricao": r[1] or r[0]} for r in rows if r[0]]


def search_municipios(conn, q: str, uf: str | None = None, limit: int = 20) -> list[dict]:
    q = (q or "").strip()
    clauses = ["municipio_nome IS NOT NULL"]
    params: list[Any] = []
    if uf:
        clauses.append("uf = ?")
        params.append(uf)
    if q:
        clauses.append("(municipio_nome ILIKE ? OR municipio_codigo = ?)")
        params.extend([f"%{q}%", q])
    where = " AND ".join(clauses)
    sql = f"""
        SELECT DISTINCT municipio_codigo, municipio_nome, uf
        FROM prospectos_rf WHERE {where}
        ORDER BY municipio_nome LIMIT ?
    """
    params.append(limit)
    rows = conn.execute(sql, params).fetchall()
    return [{"ibge": r[0], "nome": r[1], "uf": r[2]} for r in rows]


def search_naturezas(conn, q: str = "", limit: int = 200) -> list[str]:
    sql = """
        SELECT DISTINCT natureza_juridica FROM prospectos_rf
        WHERE natureza_juridica IS NOT NULL AND TRIM(natureza_juridica) != ''
    """
    params: list = []
    if q:
        sql += " AND natureza_juridica ILIKE ?"
        params.append(f"%{q.strip()}%")
    sql += " ORDER BY natureza_juridica LIMIT ?"
    params.append(limit)
    rows = conn.execute(sql, params).fetchall()
    return [r[0] for r in rows]


def enfileirar_cnpjs(conn, cnpjs: list[str]) -> dict:
    from layers.scraping.queue_worker import ScrapingQueueWorker

    ScrapingQueueWorker(conn)
    enqueued = 0
    for cnpj in cnpjs:
        cnpj = "".join(ch for ch in str(cnpj) if ch.isdigit())[:8]
        if not cnpj:
            continue
        row = conn.execute(
            "SELECT razao_social, score_prioridade FROM prospectos_rf WHERE cnpj_basico = ?",
            [cnpj],
        ).fetchone()
        if not row:
            continue
        exists = conn.execute(
            "SELECT 1 FROM scraping_queue WHERE cnpj_basico = ? AND status IN ('pending','processing')",
            [cnpj],
        ).fetchone()
        if exists:
            continue
        conn.execute(
            """INSERT INTO scraping_queue (cnpj_basico, razao_social, prioridade, status)
               VALUES (?, ?, ?, 'pending')""",
            [cnpj, row[0], row[1] or 0],
        )
        enqueued += 1
    if hasattr(conn, "commit"):
        conn.commit()
    return {"status": "ok", "enfileirados": enqueued}


def enqueue_from_filtros(
    conn,
    filtros: dict,
    *,
    aba: str = "nao_enriquecidas",
    limite: int = 100,
) -> dict:
    """Enfileira CNPJs da busca atual para enriquecimento."""
    limite = min(max(1, int(limite)), 5000)
    rows, _ = search_rows(
        conn, filtros,
        aba=aba if aba in ("nao_enriquecidas", "enriquecidas", "novas") else None,
        page=1, page_size=limite, for_batch=True,
    )
    cnpjs = [r["cnpj_basico"] for r in rows if r.get("cnpj_basico")]
    result = enfileirar_cnpjs(conn, cnpjs)
    result["candidatos"] = len(cnpjs)
    return result


def load_segmentacoes() -> list[dict]:
    if not SEGMENTACOES_PATH.exists():
        return []
    try:
        return json.loads(SEGMENTACOES_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []


def save_segmentacao(nome: str, filtros: dict) -> dict:
    SEGMENTACOES_PATH.parent.mkdir(parents=True, exist_ok=True)
    items = load_segmentacoes()
    entry = {
        "id": f"seg_{len(items)+1}",
        "nome": nome,
        "filtros": filtros,
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    items.append(entry)
    SEGMENTACOES_PATH.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    return entry


def executar_prospeccao(
    conn,
    filtros: dict,
    *,
    aba: str = "nao_enriquecidas",
    limite: int = 100,
    on_progress=None,
) -> dict:
    """
    Fluxo único: busca empresas pelos filtros → enriquece contatos (cascata A→E).
    Retorna resumo + lista de empresas para importação no CRM.
    """
    from layers.enrichment.contato_cascade import enriquecer_contato, init_enrichment_schema

    init_enrichment_schema(conn)

    try:
        n_rf = conn.execute("SELECT COUNT(*) FROM prospectos_rf").fetchone()[0]
    except Exception:
        n_rf = 0
    if n_rf == 0:
        return {
            "status": "error",
            "code": "sem_base_rf",
            "message": "Base RF vazia. Vá em Operações → Receita Federal e inicie a ingestão.",
        }

    limite = min(max(1, int(limite)), 500)
    counts = count_tabs(conn, filtros)

    aba_eff = aba if aba in ("nao_enriquecidas", "enriquecidas", "novas", "todas") else "nao_enriquecidas"
    aba_search = aba_eff if aba_eff != "todas" else None

    if aba_eff == "nao_enriquecidas" and counts.get("nao_enriquecidas", 0) == 0:
        aba_search = None
        aba_eff = "todas"

    if on_progress:
        on_progress("Buscando empresas com os filtros selecionados…", 8)

    rows, total = search_rows(
        conn, filtros, aba=aba_search, page=1, page_size=limite, for_batch=True,
    )
    if not rows:
        return {
            "status": "ok",
            "message": "Nenhuma empresa encontrada com estes filtros.",
            "total_buscado": total,
            "processados": 0,
            "enriquecidos_ok": 0,
            "erros": 0,
            "contatos_coletados": 0,
            "counts": counts,
            "empresas": [],
        }

    if on_progress:
        on_progress(f"{len(rows)} empresa(s) encontrada(s) — iniciando enriquecimento…", 12)

    ok, err, contatos_total = 0, 0, 0
    empresas: list[dict] = []

    for i, row in enumerate(rows):
        cnpj = row.get("cnpj_basico")
        if not cnpj:
            continue
        razao = (row.get("razao_social") or cnpj)[:48]
        if on_progress:
            pct = 12 + int((i / max(len(rows), 1)) * 83)
            on_progress(f"Enriquecendo {i + 1}/{len(rows)}: {razao}…", pct)
        try:
            result = enriquecer_contato(conn, cnpj)
            n_cont = int(result.get("total") or 0)
            contatos_total += n_cont
            ok += 1
            empresas.append({
                **row,
                "contatos_coletados": n_cont,
                "enriquecimento_status": "ok",
            })
        except Exception as e:
            err += 1
            empresas.append({
                **row,
                "contatos_coletados": 0,
                "enriquecimento_status": "error",
                "enriquecimento_erro": str(e),
            })

    if on_progress:
        on_progress("Prospecção concluída", 100)

    return {
        "status": "ok",
        "aba_usada": aba_eff,
        "total_buscado": total,
        "processados": len(rows),
        "enriquecidos_ok": ok,
        "erros": err,
        "contatos_coletados": contatos_total,
        "counts": counts,
        "empresas": empresas,
    }
