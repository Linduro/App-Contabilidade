import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import {
  revokeassistantBridgeSession,
  validateBridgeSessionId,
} from "@/lib/rede-teste/assistant-temp-pdf";
import { requireApiSession } from "@/lib/me-auth";

export const runtime = "nodejs";

/** Encerra a sessão do Estagiário e apaga PDFs temporários (ao fechar a aba ou sair da página). */
export async function POST(req: Request) {
  const ctx = await requireApiSession(req);
  if (!ctx?.user.tenantId) return jsonError("Não autorizado", 401);

  let sessionId = "";
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { sessionId?: string } | null;
    sessionId = body?.sessionId?.trim() || "";
  } else {
    const form = await req.formData().catch(() => null);
    sessionId = String(form?.get("sessionId") || "").trim();
  }

  if (!validateBridgeSessionId(sessionId)) {
    return jsonError("Sessão inválida", 400);
  }

  await revokeassistantBridgeSession(sessionId, ctx.user.id, ctx.user.tenantId);
  return NextResponse.json({ ok: true });
}
