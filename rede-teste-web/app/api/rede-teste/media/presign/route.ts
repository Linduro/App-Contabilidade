import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { requireApiSession } from "@/lib/me-auth";
import { jsonError } from "@/lib/api-errors";
import { getStorageProvider } from "@/lib/storage";
import { isDirectUploadConfigured, isSupabaseStorageConfigured } from "@/lib/platform-config";
import { getSupabaseStorageBucket, getSupabaseUrl } from "@/lib/supabase/env";

const schema = z.object({
  filename: z.string().min(1).max(120),
  contentType: z.string().min(3).max(100),
});

export async function POST(req: Request) {
  const ctx = await requireApiSession(req);
  const tenantId = ctx?.user.tenantId;
  if (!tenantId) return jsonError("Não autorizado", 401);

  if (!isDirectUploadConfigured()) {
    return jsonError(
      "Upload direto indisponível. Configure Supabase Storage ou S3, ou use POST /api/rede-teste/media.",
      501,
    );
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return jsonError("Dados inválidos", 400);
  }

  const safeName = body.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const ext = path.extname(safeName) || ".bin";
  const objectKey = path
    .join(tenantId, "juridiques", ctx.user.id, `${randomUUID()}${ext}`)
    .replace(/\\/g, "/");

  const storage = await getStorageProvider();
  if (!storage.getPresignedPutUrl) {
    return jsonError("Provider sem URL pré-assinada", 501);
  }

  const uploadUrl = await storage.getPresignedPutUrl!(objectKey, body.contentType);
  const publicPath = isSupabaseStorageConfigured()
    ? `${getSupabaseUrl()!.replace(/\/$/, "")}/storage/v1/object/public/${getSupabaseStorageBucket()}/${objectKey}`
    : process.env.S3_PUBLIC_URL
      ? `${process.env.S3_PUBLIC_URL.replace(/\/$/, "")}/${objectKey}`
      : `/uploads/${objectKey}`;

  return NextResponse.json({
    uploadUrl,
    publicPath,
    objectKey,
    expiresIn: 900,
  });
}
