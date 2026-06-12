import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import {
  assistant_PDF_MAX_BYTES,
  assistantPdfPublicUrl,
  requestPublicBaseUrl,
  saveassistantTempPdf,
  validateBridgeSessionId,
} from "@/lib/rede-teste/assistant-temp-pdf";
import { requireApiSession } from "@/lib/me-auth";

export const runtime = "nodejs";

/** Upload temporário de PDF — link válido só com a sessão do Estagiário aberta. */
export async function POST(req: Request) {
  const ctx = await requireApiSession(req);
  if (!ctx?.user.tenantId) return jsonError("Não autorizado", 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(
      "Upload incompleto — o PDF pode passar de 25 MB ou a conexão foi interrompida.",
      413,
    );
  }
  const sessionId = String(form.get("sessionId") || "").trim();
  if (!sessionId) return jsonError("sessionId obrigatório", 400);

  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Arquivo não enviado", 400);
  const mime = (file.type || "").toLowerCase();
  const mimeOk =
    !mime ||
    mime === "application/pdf" ||
    mime === "application/octet-stream" ||
    mime === "binary/octet-stream";
  if (!mimeOk) {
    return jsonError("Envie apenas PDF", 400);
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return jsonError("O arquivo deve ter extensão .pdf", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > assistant_PDF_MAX_BYTES) {
    return jsonError("PDF muito grande (máx. 25 MB)", 400);
  }
  if (buffer.length < 64) {
    return jsonError("Arquivo PDF inválido ou vazio", 400);
  }
  if (!validateBridgeSessionId(sessionId)) {
    return jsonError("Sessão do Estagiário inválida", 400);
  }

  try {
    const saved = await saveassistantTempPdf({
      tenantId: ctx.user.tenantId,
      userId: ctx.user.id,
      sessionId,
      fileName: file.name,
      buffer,
    });
    const baseUrl = requestPublicBaseUrl(req);
    const url = assistantPdfPublicUrl(baseUrl, saved.token);
    return NextResponse.json({
      url,
      name: saved.fileName,
      sessionActive: true,
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Falha no upload", 500);
  }
}
