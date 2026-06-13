"""
Cascata de enriquecimento de contatos (100% gratuito, defensável).

Ordem: A (RF) → B (APIs) → C (site) → D (MX) → E (OSM)
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from layers.enrichment.cnpj_api_client import CnpjApiClient
from layers.enrichment.geo_ibge import ensure_municipio_coords
from layers.enrichment.normalize_contacts import (
    normalize_cnpj_basico,
    normalize_cnpj_completo,
    normalize_email,
    normalize_phone,
)
from layers.enrichment.osm_lookup import OsmLookup
from layers.enrichment.site_scraper import SiteContactScraper
from layers.validation.email_validator import EmailValidator

logger = logging.getLogger(__name__)


def init_enrichment_schema(conn) -> None:
    from pathlib import Path
    schema = Path(__file__).resolve().parent.parent.parent / "db" / "schema_enrichment.sql"
    if not schema.exists():
        return
    for stmt in schema.read_text(encoding="utf-8").split(";"):
        stmt = stmt.strip()
        if stmt:
            try:
                conn.execute(stmt)
            except Exception as e:
                logger.debug("[enrichment schema] %s", e)
    _migrate_prospectos_columns(conn)


def _migrate_prospectos_columns(conn) -> None:
    cols = [
        ("opcao_simples", "VARCHAR"),
        ("opcao_mei", "VARCHAR"),
        ("data_abertura", "VARCHAR"),
        ("lat", "DOUBLE"),
        ("lng", "DOUBLE"),
    ]
    for name, typ in cols:
        try:
            conn.execute(f"ALTER TABLE prospectos_rf ADD COLUMN IF NOT EXISTS {name} {typ}")
        except Exception:
            pass


def is_opt_out(conn, cnpj_basico: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM cnpj_opt_out WHERE cnpj_basico = ?", [cnpj_basico]
    ).fetchone()
    return bool(row)


def registrar_opt_out(conn, cnpj_basico: str, motivo: str = "solicitacao_titular") -> dict:
    init_enrichment_schema(conn)
    conn.execute(
        "INSERT OR REPLACE INTO cnpj_opt_out (cnpj_basico, motivo) VALUES (?, ?)",
        [cnpj_basico, motivo],
    )
    conn.execute(
        "UPDATE contatos SET suprimido = TRUE WHERE cnpj_basico = ?", [cnpj_basico]
    )
    if hasattr(conn, "commit"):
        conn.commit()
    return {"status": "ok", "cnpj_basico": cnpj_basico}


def enriquecer_contato(conn, cnpj: str) -> dict[str, Any]:
    """
    Executa cascata A→E, deduplica, persiste em `contatos` e atualiza prospectos_rf.
    """
    init_enrichment_schema(conn)
    cnpj_basico = normalize_cnpj_basico(cnpj)
    if is_opt_out(conn, cnpj_basico):
        return {"status": "opt_out", "cnpj_basico": cnpj_basico, "contatos": []}

    prospecto = _load_prospecto(conn, cnpj_basico)
    if not prospecto:
        return {"status": "not_found", "cnpj_basico": cnpj_basico, "contatos": []}

    collected: list[dict] = []
    collected.extend(_fonte_a_rf(conn, cnpj_basico, prospecto))
    collected.extend(_fonte_b_apis(conn, cnpj))
    collected.extend(_fonte_c_site(prospecto))
    collected = _fonte_d_mx(collected)
    collected.extend(_fonte_e_osm(prospecto))
    collected = _dedupe(collected)

    _persist_contatos(conn, cnpj_basico, collected)
    _update_prospecto_summary(conn, cnpj_basico, collected)
    _update_geo(conn, cnpj_basico, prospecto)

    if hasattr(conn, "commit"):
        conn.commit()

    melhor = _melhor_por_tipo(collected)
    return {
        "status": "ok",
        "cnpj_basico": cnpj_basico,
        "contatos": collected,
        "melhor_email": melhor.get("email"),
        "melhor_telefone": melhor.get("telefone"),
        "total": len(collected),
    }


def list_contatos(conn, cnpj_basico: str) -> list[dict]:
    init_enrichment_schema(conn)
    rows = conn.execute(
        """SELECT tipo, valor, fonte, confianca, entregavel, data_coleta, origem_url
           FROM contatos WHERE cnpj_basico = ? AND COALESCE(suprimido, FALSE) = FALSE
           ORDER BY confianca DESC, data_coleta DESC""",
        [normalize_cnpj_basico(cnpj_basico)],
    ).fetchall()
    keys = ["tipo", "valor", "fonte", "confianca", "entregavel", "data_coleta", "origem_url"]
    return [dict(zip(keys, r)) for r in rows]


def _load_prospecto(conn, cnpj_basico: str) -> dict | None:
    row = conn.execute(
        """SELECT cnpj_basico, cnpj_matriz, razao_social, nome_fantasia, email_matriz,
                  telefone_matriz, endereco_matriz, uf, municipio_codigo, municipio_nome
           FROM prospectos_rf WHERE cnpj_basico = ?""",
        [cnpj_basico],
    ).fetchone()
    if not row:
        return None
    keys = [
        "cnpj_basico", "cnpj_matriz", "razao_social", "nome_fantasia", "email_matriz",
        "telefone_matriz", "endereco_matriz", "uf", "municipio_codigo", "municipio_nome",
    ]
    return dict(zip(keys, row))


def _fonte_a_rf(conn, cnpj_basico: str, prospecto: dict) -> list[dict]:
    """E-mail/telefone dos ZIPs RF (Estabelecimentos) — snapshot local."""
    out: list[dict] = []
    snap = conn.execute("SELECT MAX(created_at) FROM rf_snapshots").fetchone()
    snap_ref = str(snap[0])[:10] if snap and snap[0] else "rf"

    try:
        rows = conn.execute(
            """SELECT email, telefone FROM estabelecimentos_rf
               WHERE cnpj_basico = ?""",
            [cnpj_basico],
        ).fetchall()
        for email_raw, tel_raw in rows:
            email = normalize_email(email_raw)
            tel = normalize_phone(tel_raw)
            if email:
                out.append({"tipo": "email", "valor": email, "fonte": "RF", "confianca": "alta", "snapshot_rf": snap_ref})
            if tel:
                out.append({"tipo": "telefone", "valor": tel, "fonte": "RF", "confianca": "alta", "snapshot_rf": snap_ref})
    except Exception as e:
        logger.debug("[fonte_a] estabelecimentos_rf: %s", e)

    try:
        raw_rows = conn.execute(
            """SELECT email, ddd1, telefone1, ddd2, telefone2
               FROM rf_estabelecimentos WHERE cnpj_basico = ? AND matriz_filial = '1'""",
            [cnpj_basico],
        ).fetchall()
        for email_raw, d1, t1, d2, t2 in raw_rows:
            email = normalize_email(email_raw)
            tel = normalize_phone(str(t1 or ""), str(d1 or "")) or normalize_phone(str(t2 or ""), str(d2 or ""))
            if email:
                out.append({"tipo": "email", "valor": email, "fonte": "RF", "confianca": "alta", "snapshot_rf": snap_ref})
            if tel:
                out.append({"tipo": "telefone", "valor": tel, "fonte": "RF", "confianca": "alta", "snapshot_rf": snap_ref})
    except Exception as e:
        logger.debug("[fonte_a] rf_estabelecimentos: %s", e)

    if prospecto.get("email_matriz"):
        em = normalize_email(prospecto["email_matriz"])
        if em:
            out.append({"tipo": "email", "valor": em, "fonte": "RF", "confianca": "alta", "snapshot_rf": snap_ref})
    if prospecto.get("telefone_matriz"):
        tel = normalize_phone(prospecto["telefone_matriz"])
        if tel:
            out.append({"tipo": "telefone", "valor": tel, "fonte": "RF", "confianca": "alta", "snapshot_rf": snap_ref})
    return out


def _fonte_b_apis(conn, cnpj: str) -> list[dict]:
    client = CnpjApiClient(conn)
    return client.fetch_all(cnpj)


def _fonte_c_site(prospecto: dict) -> list[dict]:
    scraper = SiteContactScraper()
    domain = scraper.discover_domain(prospecto.get("razao_social", ""), prospecto.get("nome_fantasia"))
    if not domain:
        return []
    return scraper.extract_contacts(domain)


def _fonte_d_mx(items: list[dict]) -> list[dict]:
    """Validação MX apenas — sem SMTP probing."""
    validator = EmailValidator()
    for it in items:
        if it["tipo"] != "email":
            continue
        mx_ok, _hosts = validator.checar_mx(it["valor"])
        it["entregavel"] = mx_ok
        if mx_ok and it.get("confianca") != "alta":
            it["confianca"] = "media"
    return items


def _fonte_e_osm(prospecto: dict) -> list[dict]:
    osm = OsmLookup()
    return osm.lookup_phone(
        prospecto.get("razao_social", ""),
        prospecto.get("endereco_matriz") or "",
        prospecto.get("municipio_nome") or "",
        prospecto.get("uf") or "",
    )


def _dedupe(items: list[dict]) -> list[dict]:
    seen: set[tuple] = set()
    out = []
    for it in items:
        key = (it["tipo"], it["valor"])
        if key in seen:
            continue
        seen.add(key)
        out.append(it)
    return out


def _persist_contatos(conn, cnpj_basico: str, items: list[dict]) -> None:
    for it in items:
        try:
            conn.execute(
                """INSERT INTO contatos
                   (cnpj_basico, tipo, valor, fonte, confianca, entregavel, origem_url, snapshot_rf)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT (cnpj_basico, tipo, valor, fonte) DO NOTHING""",
                [
                    cnpj_basico, it["tipo"], it["valor"], it["fonte"],
                    it.get("confianca", "media"), it.get("entregavel"),
                    it.get("origem_url"), it.get("snapshot_rf"),
                ],
            )
        except Exception as e:
            logger.debug("[contatos] insert: %s", e)


def _update_prospecto_summary(conn, cnpj_basico: str, items: list[dict]) -> None:
    melhor = _melhor_por_tipo(items)
    emails = [i["valor"] for i in items if i["tipo"] == "email"]
    conn.execute(
        """UPDATE prospectos_rf SET
             email_matriz = COALESCE(?, email_matriz),
             telefone_matriz = COALESCE(?, telefone_matriz),
             emails_encontrados = ?,
             updated_at = CURRENT_TIMESTAMP
           WHERE cnpj_basico = ?""",
        [
            melhor.get("email"), melhor.get("telefone"),
            "; ".join(dict.fromkeys(emails)) if emails else None,
            cnpj_basico,
        ],
    )


def _update_geo(conn, cnpj_basico: str, prospecto: dict) -> None:
    lat, lng = ensure_municipio_coords(
        conn,
        prospecto.get("municipio_codigo"),
        prospecto.get("municipio_nome"),
        prospecto.get("uf"),
    )
    if lat is not None:
        conn.execute(
            "UPDATE prospectos_rf SET lat = ?, lng = ? WHERE cnpj_basico = ?",
            [lat, lng, cnpj_basico],
        )


def _melhor_por_tipo(items: list[dict]) -> dict[str, str | None]:
    rank = {"alta": 3, "media": 2, "baixa": 1}
    best_email = best_tel = None
    best_email_score = best_tel_score = 0
    for it in items:
        score = rank.get(it.get("confianca", "media"), 1)
        if it.get("entregavel") is True:
            score += 1
        if it["tipo"] == "email" and score >= best_email_score:
            best_email, best_email_score = it["valor"], score
        if it["tipo"] == "telefone" and score >= best_tel_score:
            best_tel, best_tel_score = it["valor"], score
    return {"email": best_email, "telefone": best_tel}
