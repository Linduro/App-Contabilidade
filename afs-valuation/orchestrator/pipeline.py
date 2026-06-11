# ============================================================
# CAMADA 1 — Orquestrador
# orchestrator/pipeline.py — Sequência de avaliação das linhas
# ============================================================

import logging
from api.gemini_client import gemini_client
import db.queries as db
from excel.writer import write_row_results

logger = logging.getLogger(__name__)


class EvaluationPipeline:
    """
    Pipeline de avaliação de ativo imobilizado:
    1. Filtra linhas onde Link1 já está preenchido
    2. Lê fotos (Tag, Idade, Conservação)
    3. Busca Histórico no DB (Regras 8 e 9)
    4. Avalia Mercado / Pensamento Crítico (Regras 1 a 7)
    5. Grava no Excel e no DB
    """

    def __init__(self):
        self.is_running = False

    def process_spreadsheet(self, filepath, sheet_index, rows, column_mappings, model_name="gemini-2.5-flash", update_callback=None, run_tag=True, run_age=True, run_conservation=True, run_market=True):
        """
        Executa a pipeline de avaliação em lote.
        update_callback é uma função que recebe atualizações em tempo real (para SSE).
        """
        self.is_running = True
        gemini_client.configure(gemini_client.api_key, model_name=model_name)
        
        total_tokens = 0
        
        # Encontrar a letra da coluna Link1 no mapping
        link1_letter = column_mappings.get("link1", {}).get("letter")
        control_letter = column_mappings.get("control", {}).get("letter")

        for row_data in rows:
            if not self.is_running:
                break
                
            row_idx = row_data.get("_row_index")
            control_val = row_data.get(control_letter) if control_letter else None
            
            # 2. MONTAR DESCRIÇÃO E IMAGENS
            desc_original_letter = column_mappings.get("desc_original", {}).get("letter")
            descricao_original = row_data.get(desc_original_letter, "Item sem descrição")

            photo_original_letter = column_mappings.get("photo_original", {}).get("letter")
            photo_spec_letter = column_mappings.get("photo_spec", {}).get("letter")
            photo_tag_letter = column_mappings.get("photo_tag", {}).get("letter")

            foto_url = row_data.get(photo_original_letter, "Sem foto") if photo_original_letter else "Sem foto"
            foto_spec = row_data.get(photo_spec_letter, "Sem foto especificação") if photo_spec_letter else "Sem foto especificação"
            foto_tag = row_data.get(photo_tag_letter, "Sem foto tag") if photo_tag_letter else "Sem foto tag"

            # 1. PULAR SE LINK1 NÃO FOR BRANCO
            if link1_letter and row_data.get(link1_letter) is not None and str(row_data.get(link1_letter)).strip() != "":
                logger.info("[CAMADA 1][pipeline] Linha %d ignorada (Link1 preenchido)", row_idx)
                if update_callback:
                    update_callback({
                        "row": row_idx, 
                        "control": control_val, 
                        "status": "Ignorado", 
                        "tokens": total_tokens,
                        "description": descricao_original,
                        "photo_url": foto_url,
                        "photo_spec": foto_spec,
                        "photo_tag": foto_tag
                    })
                continue
                
            if update_callback:
                update_callback({
                    "row": row_idx, 
                    "control": control_val, 
                    "status": "Avaliando", 
                    "tokens": total_tokens,
                    "description": descricao_original,
                    "photo_url": foto_url,
                    "photo_spec": foto_spec,
                    "photo_tag": foto_tag
                })

            tag_verificada = None
            idade_verificada = None
            conservacao_verificada = None
            raciocinio_visual = None
            
            vision_payload = {}
            
            if (run_tag or run_age or run_conservation):
                import urllib.request
                import tempfile
                import os
                
                downloaded_paths = []
                photo_sources = [
                    ("photo_original", foto_url),
                    ("photo_spec", foto_spec),
                    ("photo_tag", foto_tag)
                ]
                
                for label, url in photo_sources:
                    if url and isinstance(url, str) and url.strip() != "" and "sem foto" not in url.lower() and url.startswith("http"):
                        temp_path = None
                        try:
                            logger.info("[CAMADA 1][pipeline] Baixando imagem %s para análise Vision: %s", label, url)
                            req = urllib.request.Request(
                                url, 
                                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
                            )
                            with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp_file:
                                temp_path = tmp_file.name
                            with urllib.request.urlopen(req, timeout=15) as response:
                                with open(temp_path, 'wb') as out_file:
                                    out_file.write(response.read())
                            downloaded_paths.append(temp_path)
                        except Exception as e:
                            logger.error("[CAMADA 1][pipeline] Erro ao baixar imagem %s (%s): %s", label, url, str(e))
                            if temp_path and os.path.exists(temp_path):
                                try: os.unlink(temp_path)
                                except: pass
                
                if downloaded_paths:
                    try:
                        vision_res = gemini_client.analyze_images_for_tag(downloaded_paths)
                        
                        if vision_res["status"] == "ok":
                            v_data = vision_res["data"]
                            tag_verificada = v_data.get("tag_encontrada")
                            idade_verificada = v_data.get("idade_aparente_anos")
                            conservacao_verificada = v_data.get("estado_conservacao")
                            raciocinio_visual = v_data.get("raciocinio_visual")
                            vision_payload = {
                                "tag": tag_verificada,
                                "idade": idade_verificada,
                                "conservacao": conservacao_verificada,
                                "raciocinio": raciocinio_visual
                            }
                            
                            tokens_used = vision_res.get("tokens", 0)
                            total_tokens += tokens_used
                            
                            logger.info(
                                "[CAMADA 1][pipeline] Vision concluído. Tag: %s, Idade: %s, Cons: %s",
                                tag_verificada, idade_verificada, conservacao_verificada
                            )
                    except Exception as e:
                        logger.error("[CAMADA 1][pipeline] Erro na análise Vision das imagens: %s", str(e))
                    finally:
                        for path in downloaded_paths:
                            if path and os.path.exists(path):
                                try:
                                    os.unlink(path)
                                except:
                                    pass

            # 3. BUSCAR PREVIOUS FEEDBACK NO DB (Regras 8 e 9)
            previous_feedback = db.get_relevant_feedback(descricao_original)
            
            # 3b. PESQUISA DE COMPARATIVOS (Search via Gemini)
            search_data = None
            if run_market:
                search_res = gemini_client.search_comparables(descricao_original)
                if search_res.get("status") == "ok":
                    search_data = search_res["data"]
                    total_tokens += search_res.get("tokens", 0)
                    logger.info("[CAMADA 1][pipeline] Search concluído para linha %d", row_idx)
            
            # 4. EXECUTAR AVALIAÇÃO DE MERCADO (Gemini)
            market_data = {}
            api_ok = True
            api_error_msg = None
            
            if run_market:
                gemini_res = gemini_client.run_valuation_methodology(
                    descricao_original,
                    previous_feedback=previous_feedback,
                    search_results=search_data,
                    vision_context=vision_payload if vision_payload else None
                )
                if gemini_res["status"] == "ok":
                    tokens_used = gemini_res.get("tokens", 0)
                    total_tokens += tokens_used
                    market_data = gemini_res["data"]
                else:
                    api_ok = False
                    api_error_msg = gemini_res.get("message")
            
            if not api_ok:
                if update_callback:
                    update_callback({
                        "row": row_idx, 
                        "control": control_val,
                        "status": "Erro API", 
                        "tokens": total_tokens, 
                        "description": descricao_original, 
                        "photo_url": foto_url,
                        "photo_spec": foto_spec,
                        "photo_tag": foto_tag,
                        "error": api_error_msg
                    })
                self.pause()
                break

            if run_market and search_data:
                if not market_data.get("valor_usado") and search_data.get("melhor_valor_usado"):
                    market_data["valor_usado"] = search_data.get("melhor_valor_usado")
                if not market_data.get("valor_novo") and search_data.get("melhor_valor_novo"):
                    market_data["valor_novo"] = search_data.get("melhor_valor_novo")
                links = market_data.get("links_comparativos") or []
                if search_data.get("link_principal") and search_data["link_principal"] not in links:
                    links.insert(0, search_data["link_principal"])
                market_data["links_comparativos"] = links
                if search_data.get("raciocinio_pesquisa"):
                    extra = search_data["raciocinio_pesquisa"]
                    market_data["raciocinio_detalhado"] = (
                        (market_data.get("raciocinio_detalhado") or "") + "\n\n[Pesquisa]: " + extra
                    ).strip()

            # 5. SALVAR NO DB
            ativo_normalizado = market_data.get("ativo") if run_market else None
            categoria_normalizada = market_data.get("categoria") if run_market else None

            eval_id = db.save_evaluation(
                asset_description=descricao_original,
                asset_normalized=ativo_normalizado,
                category_normalized=categoria_normalizada,
                methodology=market_data.get("metodologia") if run_market else "Apenas Análise Visual",
                value_new=market_data.get("valor_novo") if run_market else None,
                value_used=market_data.get("valor_usado") if run_market else None,
                value_fipe=market_data.get("valor_fipe") if run_market else None,
                apparent_age=idade_verificada,
                conservation_state=conservacao_verificada,
                links=",".join(market_data.get("links_comparativos", [])) if run_market else None,
                reasoning=market_data.get("raciocinio_detalhado") if run_market else raciocinio_visual,
                photo_url=foto_url,
                photo_spec=foto_spec,
                photo_tag=foto_tag
            )
            
            # 6. GRAVAR NA PLANILHA
            excel_updates = {}
            if run_market:
                excel_updates.update({
                    "asset_output": ativo_normalizado,
                    "category_output": categoria_normalizada,
                    "desc_output": market_data.get("descricao_identificacao", descricao_original),
                    "methodology": market_data.get("metodologia", "Não informada"),
                    "value_new": market_data.get("valor_novo"),
                    "value_used": market_data.get("valor_usado"),
                    "value_fipe": market_data.get("valor_fipe"),
                    "link1": market_data.get("links_comparativos", [""])[0] if market_data.get("links_comparativos") else "Sem links"
                })
            
            if run_tag and tag_verificada:
                excel_updates["tag_output"] = tag_verificada
            if run_age and idade_verificada is not None:
                excel_updates["age_output"] = idade_verificada
            if run_conservation and conservacao_verificada is not None:
                excel_updates["conservation_output"] = conservacao_verificada
                
            if excel_updates:
                write_row_results(filepath, sheet_index, row_idx, excel_updates, column_mappings)

            if update_callback:
                update_callback({
                    "row": row_idx, 
                    "control": control_val,
                    "status": "Concluído", 
                    "tokens": total_tokens, 
                    "eval_id": eval_id, 
                    "description": descricao_original, 
                    "photo_url": foto_url,
                    "photo_spec": foto_spec,
                    "photo_tag": foto_tag,
                    "apparent_age": idade_verificada,
                    "conservation_state": conservacao_verificada,
                    "tag_verificada": tag_verificada,
                    "raciocinio_visual": raciocinio_visual,
                    "search_link": search_data.get("link_principal") if search_data else None,
                    "search_value_used": search_data.get("melhor_valor_usado") if search_data else None,
                    "search_value_new": search_data.get("melhor_valor_novo") if search_data else None,
                    "ativo": ativo_normalizado,
                    "categoria": categoria_normalizada,
                    "valuation": market_data if run_market else {"metodologia": "Apenas Análise Visual", "raciocinio_detalhado": raciocinio_visual}
                })


        self.is_running = False
        return {"status": "ok", "total_tokens": total_tokens, "filepath": filepath}

    def pause(self):
        self.is_running = False

pipeline = EvaluationPipeline()
