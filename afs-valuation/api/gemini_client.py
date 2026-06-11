# ============================================================
# CAMADA 2 — Módulos Funcionais
# api/gemini_client.py — Chamadas ao Google Gemini API
# ============================================================

import logging
import json
from .prompts import VISION_CONSERVATION_PROMPT, SYSTEM_VALUATION_PROMPT

logger = logging.getLogger(__name__)


class GeminiClient:
    """Cliente para interação com o Google Gemini API."""

    def __init__(self, api_key=None, model_name="gemini-2.5-flash"):
        self.api_key = api_key
        self.model_name = model_name
        self._client = None
        self._model = None

    def configure(self, api_key, model_name=None):
        """Configura o cliente com a chave de API e modelo escolhido."""
        self.api_key = api_key
        if model_name:
            self.model_name = model_name
        self._client = None
        self._model = None

    def _get_model(self):
        """Inicializa o modelo Gemini sob demanda."""
        if self._model is None:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                # Usa o model_name configurado (Flash ou Pro)
                self._model = genai.GenerativeModel(self.model_name)
                logger.info("[CAMADA 2][api][gemini] Modelo %s inicializado", self.model_name)
            except Exception as e:
                logger.error("[CAMADA 2][api][gemini._get_model] %s", str(e))
                raise
        return self._model

    def _extract_tokens(self, response):
        """Extrai contagem de tokens do objeto response."""
        try:
            return response.usage_metadata.total_token_count
        except:
            return 0

    def test_connection(self):
        """Testa a conectividade real com a API do Gemini."""
        if not self.api_key:
            return {"status": "error", "message": "Chave de API não configurada"}
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            model_to_use = self.model_name or 'gemini-2.5-flash'
            model = genai.GenerativeModel(model_to_use)
            response = model.generate_content("Oi", generation_config={"max_output_tokens": 10})
            if response and (response.candidates or hasattr(response, 'text')):
                return {"status": "ok", "message": f"Conectado ao {model_to_use}"}
            return {"status": "error", "message": "API respondeu sem conteúdo."}
        except Exception as e:
            logger.error("[CAMADA 2][api][gemini.test_connection] %s", str(e))
            err_msg = str(e)
            if "API_KEY_INVALID" in err_msg or "invalid key" in err_msg.lower() or "400" in err_msg or "403" in err_msg:
                return {"status": "error", "message": "Chave de API inválida ou sem permissão de faturamento."}
            elif "not found" in err_msg.lower() or "not supported" in err_msg.lower() or "404" in err_msg:
                return {
                    "status": "error",
                    "message": f"Modelo {self.model_name} não encontrado (Erro 404). Certifique-se de que a 'Generative Language API' está ativada no seu Console do Google Cloud para esta chave de API."
                }
            return {"status": "error", "message": f"Falha na conexão: {err_msg}"}

    def analyze_image_for_tag(self, image_path):
        """Analisa a imagem retornando nota de conservação e lendo a tag."""
        return self.analyze_images_for_tag([image_path])

    def analyze_images_for_tag(self, image_paths):
        """Analisa múltiplas imagens (Original, Spec, Tag) para retornar nota de conservação, idade e tag."""
        import google.generativeai as genai
        import os
        try:
            model = self._get_model()
            contents = [VISION_CONSERVATION_PROMPT]
            
            for path in image_paths:
                if path and os.path.exists(path):
                    with open(path, 'rb') as f:
                        image_bytes = f.read()
                    contents.append({
                        'mime_type': 'image/jpeg',
                        'data': image_bytes
                    })
            
            if len(contents) == 1:
                return {"status": "error", "message": "Nenhuma imagem válida para análise."}
                
            response = model.generate_content(
                contents,
                generation_config=genai.types.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.2
                )
            )
            
            tokens = self._extract_tokens(response)
            
            # Extrair texto com segurança
            text_content = ""
            if response.candidates and response.candidates[0].content.parts:
                text_content = response.candidates[0].content.parts[0].text
            elif hasattr(response, 'text'):
                text_content = response.text
                
            if not text_content:
                return {"status": "error", "message": "Nenhum conteúdo gerado pela API Vision."}
                
            return {"status": "ok", "data": json.loads(text_content), "tokens": tokens}
        except Exception as e:
            logger.error("[CAMADA 2][api][gemini.analyze_images] %s", str(e))
            return {"status": "error", "message": str(e)}

    def run_valuation_methodology(self, asset_description, previous_feedback=None):
        """
        Executa a metodologia de avaliação baseada nas Regras 1 a 7 e 9.
        Se houver previous_feedback, usa a Regra 8 (Aprender com erros passados).
        """
        import google.generativeai as genai
        import os
        try:
            model = self._get_model()
            prompt = f"Avalie o seguinte bem corporativo:\n{asset_description}\n"
            
            if previous_feedback:
                prompt += f"\nATENÇÃO - Aprendizado Ativo: Em uma avaliação anterior de um bem similar, o usuário apontou este feedback: '{previous_feedback}'. Incorpore isso na sua lógica atual."
            
            # Carregar aprendizados gerais do arquivo auto_aprendizados.json
            auto_aprendizados_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'auto_aprendizados.json')
            if os.path.exists(auto_aprendizados_path):
                try:
                    with open(auto_aprendizados_path, 'r', encoding='utf-8') as f:
                        aprendizados = json.load(f)
                    if aprendizados:
                        prompt += "\n\nCRITÉRIOS DE AUTO-APRENDIZADO ACUMULADOS (Orientações gerais de intervenções passadas):\n"
                        for item in aprendizados:
                            desc_item = item.get("descricao_bem", "")
                            comment = item.get("feedback_usuario", "")
                            val = item.get("valor_correto", "")
                            prompt += f"- Para bens similares a '{desc_item}': {comment} (Valor esperado sugerido: {val})\n"
                except Exception as e:
                    logger.warning("[gemini_client] Erro ao carregar auto_aprendizados.json: %s", str(e))

            response = model.generate_content(
                [SYSTEM_VALUATION_PROMPT, prompt],
                generation_config=genai.types.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.5
                )
            )
            
            tokens = self._extract_tokens(response)
            
            # Extrair texto com segurança
            text_content = ""
            if response.candidates and response.candidates[0].content.parts:
                text_content = response.candidates[0].content.parts[0].text
            elif hasattr(response, 'text'):
                text_content = response.text
                
            if not text_content:
                return {"status": "error", "message": "Nenhum conteúdo gerado pela API Gemini."}
                
            return {"status": "ok", "data": json.loads(text_content), "tokens": tokens}
        except Exception as e:
            logger.error("[CAMADA 2][api][gemini.run_valuation] %s", str(e))
            return {"status": "error", "message": str(e)}

# Instância singleton para uso no sistema
gemini_client = GeminiClient()
