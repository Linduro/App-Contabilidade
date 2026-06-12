import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/me-auth";
import { jsonError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { saveJqPublicationMedia } from "@/lib/rede-teste/media-upload";

export async function POST(req: Request) {
  const ctx = await requireApiSession(req);
  if (!ctx?.user.tenantId) return jsonError("Não autorizado", 401);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Arquivo não enviado");

  try {
    const { url, type } = await saveJqPublicationMedia(
      ctx.user.tenantId,
      ctx.user.id,
      file,
    );
    const media = await prisma.redeTesteMedia.create({
      data: {
        tenantId: ctx.user.tenantId,
        uploaderId: ctx.user.id,
        url,
        type,
      },
    });
    return NextResponse.json({ id: media.id, url: media.url, type: media.type });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Falha no upload", 400);
  }
}
