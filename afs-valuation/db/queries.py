# ============================================================
# CAMADA 3 — Persistência
# db/queries.py — Operações CRUD
# ============================================================

import logging
from db.models import get_connection

logger = logging.getLogger(__name__)


# ---- CONFIG ----

def save_config(key, value):
    """Salva ou atualiza uma configuração."""
    try:
        conn = get_connection()
        conn.execute(
            "INSERT OR REPLACE INTO config (key, value, updated_at) "
            "VALUES (?, ?, CURRENT_TIMESTAMP)",
            (key, value)
        )
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error("[CAMADA 3][db][save_config] %s", str(e))
        return False


def get_config(key, default=None):
    """Recupera uma configuração pelo nome."""
    try:
        conn = get_connection()
        row = conn.execute(
            "SELECT value FROM config WHERE key = ?", (key,)
        ).fetchone()
        conn.close()
        return row['value'] if row else default
    except Exception as e:
        logger.error("[CAMADA 3][db][get_config] %s", str(e))
        return default


def get_all_config():
    """Retorna todas as configurações como dicionário."""
    try:
        conn = get_connection()
        rows = conn.execute("SELECT key, value FROM config").fetchall()
        conn.close()
        return {row['key']: row['value'] for row in rows}
    except Exception as e:
        logger.error("[CAMADA 3][db][get_all_config] %s", str(e))
        return {}


# ---- SEARCHES ----

def save_search(asset_description, search_query, search_results, source="google"):
    """Registra uma pesquisa realizada."""
    try:
        conn = get_connection()
        cursor = conn.execute(
            "INSERT INTO searches (asset_description, search_query, search_results, source) "
            "VALUES (?, ?, ?, ?)",
            (asset_description, search_query, search_results, source)
        )
        conn.commit()
        search_id = cursor.lastrowid
        conn.close()
        return search_id
    except Exception as e:
        logger.error("[CAMADA 3][db][save_search] %s", str(e))
        return None


def find_similar_searches(description, limit=5):
    """Busca pesquisas anteriores de bens similares."""
    try:
        conn = get_connection()
        rows = conn.execute(
            "SELECT * FROM searches WHERE asset_description LIKE ? "
            "ORDER BY created_at DESC LIMIT ?",
            (f"%{description}%", limit)
        ).fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error("[CAMADA 3][db][find_similar_searches] %s", str(e))
        return []


# ---- EVALUATIONS ----

def save_evaluation(asset_description, methodology=None, value_new=None,
                    value_used=None, value_fipe=None, apparent_age=None,
                    conservation_state=None, links=None, reasoning=None,
                    photo_url=None, photo_spec=None, photo_tag=None,
                    asset_normalized=None):
    """Salva uma avaliação realizada."""
    try:
        conn = get_connection()
        cursor = conn.execute(
            "INSERT INTO evaluations "
            "(asset_description, asset_normalized, methodology, value_new, value_used, value_fipe, "
            "apparent_age, conservation_state, links, reasoning, photo_url, photo_spec, photo_tag) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (asset_description, asset_normalized, methodology, value_new, value_used, value_fipe,
             apparent_age, conservation_state, links, reasoning, photo_url, photo_spec, photo_tag)
        )
        conn.commit()
        eval_id = cursor.lastrowid
        conn.close()
        return eval_id

    except Exception as e:
        logger.error("[CAMADA 3][db][save_evaluation] %s", str(e))
        return None


def find_similar_evaluations(description, limit=5):
    """Busca avaliações anteriores de bens similares."""
    try:
        conn = get_connection()
        rows = conn.execute(
            "SELECT * FROM evaluations WHERE asset_description LIKE ? "
            "ORDER BY created_at DESC LIMIT ?",
            (f"%{description}%", limit)
        ).fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error("[CAMADA 3][db][find_similar_evaluations] %s", str(e))
        return []

def get_evaluation(evaluation_id):
    """Busca uma avaliação específica pelo seu ID."""
    try:
        conn = get_connection()
        row = conn.execute(
            "SELECT * FROM evaluations WHERE id = ?",
            (evaluation_id,)
        ).fetchone()
        conn.close()
        return dict(row) if row else None
    except Exception as e:
        logger.error("[CAMADA 3][db][get_evaluation] %s", str(e))
        return None

def get_all_evaluations():
    """Busca todas as avaliações no histórico, mais recentes primeiro."""
    try:
        conn = get_connection()
        rows = conn.execute(
            "SELECT * FROM evaluations ORDER BY created_at DESC"
        ).fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error("[CAMADA 3][db][get_all_evaluations] %s", str(e))
        return []



# ---- FEEDBACKS ----

def save_feedback(evaluation_id, user_comment, corrected_value=None, accepted=0):
    """Salva feedback do usuário sobre uma avaliação."""
    try:
        conn = get_connection()
        conn.execute(
            "INSERT INTO feedbacks (evaluation_id, user_comment, corrected_value, accepted) "
            "VALUES (?, ?, ?, ?)",
            (evaluation_id, user_comment, corrected_value, accepted)
        )
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error("[CAMADA 3][db][save_feedback] %s", str(e))
        return False


def get_feedbacks_for_evaluation(evaluation_id):
    """Retorna feedbacks de uma avaliação."""
    try:
        conn = get_connection()
        rows = conn.execute(
            "SELECT * FROM feedbacks WHERE evaluation_id = ? ORDER BY created_at DESC",
            (evaluation_id,)
        ).fetchall()
        conn.close()
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error("[CAMADA 3][db][get_feedbacks_for_evaluation] %s", str(e))
        return []

def get_relevant_feedback(description, limit=1):
    """Busca o feedback mais recente aceito para um ativo similar."""
    try:
        conn = get_connection()
        query = """
            SELECT f.user_comment 
            FROM feedbacks f
            JOIN evaluations e ON f.evaluation_id = e.id
            WHERE e.asset_description LIKE ? AND f.accepted = 1
            ORDER BY f.created_at DESC
            LIMIT ?
        """
        rows = conn.execute(query, (f"%{description}%", limit)).fetchall()
        conn.close()
        if rows:
            return rows[0]['user_comment']
        return None
    except Exception as e:
        logger.error("[CAMADA 3][db][get_relevant_feedback] %s", str(e))
        return None


# ---- COMPARATIVES ----

def save_comparative(asset_description, comparable_description, comparable_value,
                     comparable_link=None, source="google", currency="BRL"):
    """Salva um comparativo encontrado."""
    try:
        conn = get_connection()
        conn.execute(
            "INSERT INTO comparatives "
            "(asset_description, comparable_description, comparable_value, "
            "comparable_link, source, currency) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (asset_description, comparable_description, comparable_value,
             comparable_link, source, currency)
        )
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error("[CAMADA 3][db][save_comparative] %s", str(e))
        return False


# ---- COLUMN MAPPINGS ----

def save_column_mapping(field_name, column_letter, column_index):
    """Salva o mapeamento de uma coluna."""
    try:
        conn = get_connection()
        # Remove mapeamento anterior do mesmo campo
        conn.execute("DELETE FROM column_mappings WHERE field_name = ?", (field_name,))
        conn.execute(
            "INSERT INTO column_mappings (field_name, column_letter, column_index) "
            "VALUES (?, ?, ?)",
            (field_name, column_letter, column_index)
        )
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error("[CAMADA 3][db][save_column_mapping] %s", str(e))
        return False


def get_column_mappings():
    """Retorna todos os mapeamentos de colunas."""
    try:
        conn = get_connection()
        rows = conn.execute("SELECT * FROM column_mappings").fetchall()
        conn.close()
        return {row['field_name']: {'letter': row['column_letter'], 'index': row['column_index']}
                for row in rows}
    except Exception as e:
        logger.error("[CAMADA 3][db][get_column_mappings] %s", str(e))
        return {}


def clear_column_mappings():
    """Limpa todos os mapeamentos de colunas."""
    try:
        conn = get_connection()
        conn.execute("DELETE FROM column_mappings")
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error("[CAMADA 3][db][clear_column_mappings] %s", str(e))
        return False
