import path from "node:path";
import { randomUUID } from "node:crypto";
import { getStorageProvider } from "@/lib/storage";
import type { RedeTesteMediaType } from "@prisma/client";

const IMAGE_MAX = 5 * 1024 * 1024;
const VIDEO_MAX = 25 * 1024 * 1024;

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_MIMES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export type JqUploadResult = {
  url: string;
  type: RedeTesteMediaType;
};

export async function saveJqPublicationMedia(
  tenantId: string,
  userId: string,
  file: File,
): Promise<JqUploadResult> {
  const fileMime = file.type || "application/octet-stream";

  let type: RedeTesteMediaType = "IMAGE";
  let max = IMAGE_MAX;
  let ext = "webp";

  if (VIDEO_MIMES.has(fileMime)) {
    type = "VIDEO";
    max = VIDEO_MAX;
    ext = fileMime === "video/webm" ? "webm" : "mp4";
  } else if (fileMime === "image/gif") {
    type = "GIF";
    ext = "gif";
  } else if (!IMAGE_MIMES.has(fileMime)) {
    throw new Error("Formato não suportado. Use JPEG, PNG, WebP, GIF ou MP4/WebM.");
  } else {
    ext = fileMime === "image/png" ? "png" : fileMime === "image/jpeg" ? "jpg" : "webp";
  }

  if (file.size > max) {
    throw new Error(
      type === "VIDEO"
        ? "Vídeo muito grande (máx. 25 MB)"
        : "Arquivo muito grande (máx. 5 MB)",
    );
  }

  const id = randomUUID();
  const filename = `${id}.${ext}`;
  const objectKey = path.join(tenantId, "juridiques", userId, filename).replace(/\\/g, "/");
  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = await getStorageProvider();
  const contentType =
    type === "VIDEO"
      ? ext === "webm"
        ? "video/webm"
        : "video/mp4"
      : ext === "png"
        ? "image/png"
        : ext === "gif"
          ? "image/gif"
          : ext === "jpg"
            ? "image/jpeg"
            : "image/webp";

  const stored = await storage.putObject(objectKey, buffer, contentType);

  return {
    url: stored.publicPath,
    type,
  };
}

/** @deprecated use saveJqPublicationMedia */
export const saveJqPublicationImage = saveJqPublicationMedia;
