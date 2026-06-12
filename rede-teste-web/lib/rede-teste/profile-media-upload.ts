import path from "node:path";
import { randomUUID } from "node:crypto";
import { getStorageProvider } from "@/lib/storage";

const IMAGE_MAX = 10 * 1024 * 1024;
const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function saveJqProfileImage(
  tenantId: string,
  userId: string,
  file: File,
  folder: "banner" | "avatar",
  label: string,
): Promise<string> {
  const mime = file.type || "application/octet-stream";
  if (!IMAGE_MIMES.has(mime)) {
    throw new Error(`${label}: use JPEG, PNG ou WebP.`);
  }
  if (file.size > IMAGE_MAX) {
    throw new Error(`${label} muito grande (máx. 10 MB).`);
  }

  const ext = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "webp";
  const filename = `${randomUUID()}.${ext}`;
  const objectKey = path
    .join(tenantId, "juridiques", userId, folder, filename)
    .replace(/\\/g, "/");

  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = await getStorageProvider();
  const stored = await storage.putObject(objectKey, buffer, mime);
  return stored.publicPath;
}

export function saveJqProfileBanner(tenantId: string, userId: string, file: File) {
  return saveJqProfileImage(tenantId, userId, file, "banner", "Banner");
}

export function saveJqProfileAvatar(tenantId: string, userId: string, file: File) {
  return saveJqProfileImage(tenantId, userId, file, "avatar", "Foto");
}
