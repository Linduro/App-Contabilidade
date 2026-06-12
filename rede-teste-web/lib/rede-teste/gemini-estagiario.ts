import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import type { EstagiarioPdfPart } from "@/lib/rede-teste/assistant-sources-disabled";

/** Modelo padrão — Flash-Lite tem cota gratuita maior que gemini-2.0-flash. */
const PRIMARY_MODEL =
  process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash-lite";

const FALLBACK_MODELS = [
  PRIMARY_MODEL,
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-2.0-flash",
].filter((m, i, arr) => arr.indexOf(m) === i);

export const ESTAGIARIO_GEMINI_SYSTEM = `Você é o Estagiário Artificial do Rede Teste (Portal), assistente jurídico para advogados brasileiros.

Regras obrigatórias:
- Use EXCLUSIVAMENTE as fontes fornecidas nesta conversa (texto e PDFs). Não use conhecimento externo, não busque na internet, não invente fatos, números de processo, leis ou jurisprudência que não estejam nas fontes.
- Se faltar informação nas fontes, diga explicitamente o que falta e use [VERIFICAR] onde couber.
- Tom formal, terceira pessoa, palavreado forense brasileiro quando o advogado pedir peças.
- Não substitui advogado: ao final de peças longas, lembre que a revisão humana é obrigatória.
- Responda em português do Brasil.`;

export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key || null;
}

export function isGeminiEstagiarioConfigured(): boolean {
  return !!getGeminiApiKey();
}

export function getEstagiarioGeminiModelId(): string {
  return PRIMARY_MODEL;
}

export type EstagiarioChatTurn = {
  role: "user" | "assistant";
  text: string;
};

function buildUserParts(
  sourcesText: string,
  pdfParts: EstagiarioPdfPart[],
  userMessage: string,
): Part[] {
  const parts: Part[] = [{ text: `${sourcesText}\n\n---\n\nPedido do advogado:\n${userMessage}` }];
  for (const pdf of pdfParts) {
    parts.push({
      inlineData: {
        mimeType: pdf.mimeType,
        data: pdf.data,
      },
    });
  }
  return parts;
}

function isQuotaOrRateLimitError(error: unknown): boolean {
  const msg = String(error instanceof Error ? error.message : error);
  return /429|quota|rate.?limit|too many requests|resource exhausted/i.test(msg);
}

function isModelUnavailableError(error: unknown): boolean {
  const msg = String(error instanceof Error ? error.message : error);
  return /404|not found|not supported|invalid model/i.test(msg);
}

/** Mensagem amigável para o advogado (sem dump da API). */
export function formatGeminiErrorForUser(error: unknown): string {
  if (isQuotaOrRateLimitError(error)) {
    return [
      "Cota gratuita da API Gemini esgotada ou muito alta neste minuto.",
      "Aguarde cerca de 1 minuto e tente de novo, ou ative faturamento em https://aistudio.google.com/apikey",
      "e defina GEMINI_MODEL no servidor (ex.: gemini-2.0-flash-lite).",
    ].join(" ");
  }
  if (error instanceof Error && error.message) return error.message;
  return "Falha ao consultar o Gemini.";
}

async function runWithModel(
  modelId: string,
  params: {
    sourcesText: string;
    pdfParts: EstagiarioPdfPart[];
    userMessage: string;
    history: EstagiarioChatTurn[];
  },
  apiKey: string,
): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: ESTAGIARIO_GEMINI_SYSTEM,
  });

  const prior = params.history.slice(-18);

  if (prior.length === 0) {
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: buildUserParts(params.sourcesText, params.pdfParts, params.userMessage),
        },
      ],
    });
    const text = result.response.text()?.trim();
    if (!text) throw new Error("O Gemini não retornou texto.");
    return text;
  }

  const chatHistory: Array<{ role: "user" | "model"; parts: Part[] }> = [];
  let firstUserDone = false;

  for (const turn of prior) {
    if (turn.role === "user") {
      if (!firstUserDone) {
        chatHistory.push({
          role: "user",
          parts: buildUserParts(params.sourcesText, params.pdfParts, turn.text),
        });
        firstUserDone = true;
      } else {
        chatHistory.push({ role: "user", parts: [{ text: turn.text }] });
      }
    } else {
      chatHistory.push({ role: "model", parts: [{ text: turn.text }] });
    }
  }

  if (chatHistory.length && chatHistory[chatHistory.length - 1].role === "user") {
    chatHistory.pop();
  }

  const chat = model.startChat({ history: chatHistory });
  const result = await chat.sendMessage(params.userMessage);
  const text = result.response.text()?.trim();
  if (!text) throw new Error("O Gemini não retornou texto.");
  return text;
}

/** history = turnos anteriores (sem a mensagem atual). Tenta modelos alternativos em 429. */
export async function runEstagiarioGeminiChat(params: {
  sourcesText: string;
  pdfParts: EstagiarioPdfPart[];
  userMessage: string;
  history: EstagiarioChatTurn[];
}): Promise<{ answer: string; modelUsed: string }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada no servidor.");
  }

  let lastError: unknown = null;

  for (const modelId of FALLBACK_MODELS) {
    try {
      const answer = await runWithModel(modelId, params, apiKey);
      return { answer, modelUsed: modelId };
    } catch (error) {
      lastError = error;
      if (!isQuotaOrRateLimitError(error) && !isModelUnavailableError(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("Nenhum modelo Gemini disponível na cota atual.");
}
