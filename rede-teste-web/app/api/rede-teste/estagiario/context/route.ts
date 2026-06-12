import { NextResponse } from "next/server";
import { z } from "zod";
import { ZodError } from "zod";
import { zodErrorResponse, jsonError } from "@/lib/api-errors";
import { requireApiSession } from "@/lib/me-auth";

const schema = z.object({
  documentText: z.string().min(1).max(100_000),
  templateId: z.string().optional(),
  templateTitle: z.string().optional(),
  prompt: z.string().max(2000).optional(),
});

/**
 * Recebe contexto de documento do Portal para o Estagiário Artificial.
 * TODO: integrar com lib/rede-teste/gemini-estagiario.ts — injetar documentText no system prompt.
 */
export async function POST(req: Request) {
  const ctx = await requireApiSession(req);
  if (!ctx) return jsonError("Não autorizado", 401);

  try {
    const body = schema.parse(await req.json());
    // TODO: persistir sessão de contexto e chamar Gemini com { prompt, documentText, templateId }
    return NextResponse.json({
      ok: true,
      message: "Contexto recebido. Integração com IA pendente.",
      bytes: body.documentText.length,
    });
  } catch (e) {
    if (e instanceof ZodError) return zodErrorResponse(e);
    return jsonError("Erro ao processar contexto", 500);
  }
}
