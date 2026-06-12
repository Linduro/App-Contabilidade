import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/me-auth";
import { jsonError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import {
  saveJqProfileAvatar,
  saveJqProfileBanner,
} from "@/lib/rede-teste/profile-media-upload";

/** Upload de banner (capa) ou avatar (foto) do perfil Rede Teste (multipart `file`, campo `kind`). */
export async function POST(req: Request) {
  const ctx = await requireApiSession(req);
  if (!ctx?.user.tenantId) return jsonError("Não autorizado", 401);

  const form = await req.formData();
  const file = form.get("file");
  const kind = form.get("kind") === "avatar" ? "avatar" : "banner";
  if (!(file instanceof File)) return jsonError("Arquivo não enviado", 400);

  try {
    if (kind === "avatar") {
      const avatarUrl = await saveJqProfileAvatar(
        ctx.user.tenantId,
        ctx.user.id,
        file,
      );
      await prisma.user.update({
        where: { id: ctx.user.id },
        data: { image: avatarUrl },
      });
      return NextResponse.json({ avatarUrl });
    }

    const bannerUrl = await saveJqProfileBanner(
      ctx.user.tenantId,
      ctx.user.id,
      file,
    );
    await prisma.redeTesteProfile.update({
      where: { userId: ctx.user.id },
      data: { bannerUrl },
    });
    return NextResponse.json({ bannerUrl });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Falha no upload", 400);
  }
}
