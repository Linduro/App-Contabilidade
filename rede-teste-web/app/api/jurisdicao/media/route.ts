import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/me-auth";
import { jsonError } from "@/lib/api-errors";
import { getStorageProvider } from "@/lib/storage";

const IMAGE_MIMES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const AUDIO_MIMES: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
};

const IMAGE_MAX = 8 * 1024 * 1024;
const AUDIO_MAX = 30 * 1024 * 1024;

/** Upload de mídia do Jurisdição (imagem ou áudio). Retorna apenas a URL pública. */
export async function POST(req: Request) {
  const ctx = await requireApiSession(req);
  if (!ctx?.user.tenantId) return jsonError("Não autorizado", 401);

  const form = await req.formData();
  const file = form.get("file");
  const kind = form.get("kind") === "audio" ? "audio" : "image";
  if (!(file instanceof File)) return jsonError("Arquivo não enviado", 400);

  const mime = file.type || "application/octet-stream";
  const map = kind === "audio" ? AUDIO_MIMES : IMAGE_MIMES;
  const ext = map[mime];
  if (!ext) {
    return jsonError(
      kind === "audio"
        ? "Áudio: use MP3, OGG, WAV ou M4A."
        : "Imagem: use JPEG, PNG, WebP ou GIF.",
      400,
    );
  }
  if (file.size > (kind === "audio" ? AUDIO_MAX : IMAGE_MAX)) {
    return jsonError(
      kind === "audio" ? "Áudio muito grande (máx. 30 MB)." : "Imagem muito grande (máx. 8 MB).",
      400,
    );
  }

  try {
    const filename = `${randomUUID()}.${ext}`;
    const objectKey = path
      .join(ctx.user.tenantId, "jurisdicao", ctx.user.id, kind, filename)
      .replace(/\\/g, "/");
    const buffer = Buffer.from(await file.arrayBuffer());
    const storage = await getStorageProvider();
    const stored = await storage.putObject(objectKey, buffer, mime);
    return NextResponse.json({ url: stored.publicPath });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Falha no upload", 400);
  }
}
