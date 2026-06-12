import { createHash } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const UPLOAD_DIR =
  process.env.UPLOAD_DIR || "/var/lib/portal/uploads";

export type UploadKind = "avatar" | "cover";

export function getUploadDiskPath(userId: string, filename: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
    throw new Error("ID de usu?rio inv?lido");
  }
  if (!/^(avatar|cover)\.webp$/.test(filename)) {
    throw new Error("Nome de arquivo inv?lido");
  }
  return path.join(UPLOAD_DIR, userId, filename);
}

export function validateUploadPathSegments(segments: string[]): {
  userId: string;
  filename: string;
} {
  if (segments.length !== 2) {
    throw new Error("Caminho inv?lido");
  }
  for (const seg of segments) {
    if (!seg || seg === "." || seg === ".." || seg.includes("..")) {
      throw new Error("Path traversal detectado");
    }
  }
  const [userId, filename] = segments;
  return { userId, filename };
}

export function buildPublicUploadPath(
  userId: string,
  kind: UploadKind,
  version?: number,
): string {
  const v = version ?? Math.floor(Date.now() / 1000);
  return `/uploads/${userId}/${kind}.webp?v=${v}`;
}

export { normalizeMediaUrl } from "@/lib/media-url";

export async function saveUserUpload(
  userId: string,
  kind: UploadKind,
  buffer: Buffer,
): Promise<string> {
  const filename = `${kind}.webp`;
  const diskPath = getUploadDiskPath(userId, filename);
  await mkdir(path.dirname(diskPath), { recursive: true });
  await unlink(diskPath).catch(() => {});
  await writeFile(diskPath, buffer);
  return buildPublicUploadPath(userId, kind);
}

export async function deleteUserUpload(
  userId: string,
  kind: UploadKind,
): Promise<void> {
  const diskPath = getUploadDiskPath(userId, kind);
  await unlink(diskPath).catch(() => {});
}

export function fileEtag(buffer: Buffer): string {
  return `"${createHash("md5").update(buffer).digest("hex")}"`;
}

/** ETag est?vel para cache imut?vel (mtime + size). */
export function statEtag(mtimeMs: number, size: number): string {
  return `"${mtimeMs.toString(16)}-${size.toString(16)}"`;
}

/**
 * /uploads/{tenantId}/{juridiques|jurisdicao}/{userId}/[subpasta]/{file}
 * Aceita profundidade variavel (ex.: .../banner/file, .../avatar/file, .../audio/file).
 */
export function validateJqUploadPathSegments(segments: string[]): string {
  if (segments.length < 4) throw new Error("Caminho inv?lido");
  const [tenantId, folder, userId, ...rest] = segments;
  if (folder !== "juridiques" && folder !== "jurisdicao") {
    throw new Error("Caminho inv?lido");
  }
  const filename = rest[rest.length - 1]!;
  for (const seg of segments) {
    if (!seg || seg === "." || seg === ".." || seg.includes("..") || seg.includes("/")) {
      throw new Error("Path traversal detectado");
    }
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(tenantId) || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
    throw new Error("Segmento inv?lido");
  }
  for (const seg of rest.slice(0, -1)) {
    if (!/^[a-zA-Z0-9_-]+$/.test(seg)) throw new Error("Segmento inv?lido");
  }
  if (!/^[a-zA-Z0-9_-]+\.(webp|png|gif|jpe?g|mp4|webm|mov|mp3|ogg|wav|m4a|aac)$/i.test(filename)) {
    throw new Error("Arquivo inv?lido");
  }
  return path.join(UPLOAD_DIR, ...segments);
}

/** /uploads/minutas/{tenantId}/{arquivo.pdf} */
export function validateMinutaUploadPathSegments(segments: string[]): string {
  if (segments.length !== 3) throw new Error("Caminho invalido");
  const [folder, tenantId, filename] = segments;
  if (folder !== "minutas") throw new Error("Caminho invalido");
  for (const seg of segments) {
    if (!seg || seg === "." || seg === ".." || seg.includes("..") || seg.includes("/")) {
      throw new Error("Path traversal detectado");
    }
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(tenantId)) throw new Error("Segmento invalido");
  if (!/^[a-zA-Z0-9_-]+\.pdf$/i.test(filename)) throw new Error("Arquivo invalido");
  return path.join(UPLOAD_DIR, ...segments);
}

export function mimeForUploadFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".m4a") return "audio/mp4";
  if (ext === ".aac") return "audio/aac";
  return "image/webp";
}
