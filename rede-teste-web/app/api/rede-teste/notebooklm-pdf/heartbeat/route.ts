import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import {
  touchassistantBridgeSession,
  validateBridgeSessionId,
} from "@/lib/rede-teste/assistant-temp-pdf";
import { requireApiSession } from "@/lib/me-auth";

export const runtime = "nodejs";

/** Mantém a sessão ativa enquanto a janela do Estagiário Artificial está aberta. */
export async function POST(req: Request) {
  const ctx = await requireApiSession(req);
  if (!ctx?.user.tenantId) return jsonError("Não autorizado", 401);

  const body = (await req.json().catch(() => null)) as { sessionId?: string } | null;
  const sessionId = body?.sessionId?.trim() || "";
  if (!validateBridgeSessionId(sessionId)) {
    return jsonError("Sessão inválida", 400);
  }

  await touchassistantBridgeSession({
    tenantId: ctx.user.tenantId,
    userId: ctx.user.id,
    sessionId,
  });
  return NextResponse.json({ ok: true });
}
