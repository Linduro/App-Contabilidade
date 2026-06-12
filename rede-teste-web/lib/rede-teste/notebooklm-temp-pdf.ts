import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import {
  deleteassistantPdfCache,
  getassistantPdfCache,
  putassistantPdfCache,
} from "@/lib/rede-teste/assistant-pdf-cache";
/** Sem heartbeat recente, o link deixa de funcionar (janela fechada ou inativa). */
export const assistant_SESSION_IDLE_MS = 40_000;
/** Teto de segurança no token assinado (não é o critério principal). */
const TOKEN_MAX_MS = 24 * 60 * 60 * 1000;
export const assistant_PDF_MAX_BYTES = 25 * 1024 * 1024;

export type assistantTempPdfMeta = {
  id: string;
  userId: string;
  tenantId: string;
  fileName: string;
  sessionId: string;
  exp: number;
};

type assistantBridgeSessionRegistry = {
  userId: string;
  tenantId: string;
  lastSeenAt: number;
  files: Array<{ id: string; fileName: string }>;
};

/**
 * Pasta gravável em produção (systemd ProtectSystem=strict só libera /opt/portal/uploads).
 * Rede Teste/mídia legada pode continuar em UPLOAD_DIR (/var/lib/...).
 */
function assistantUploadRoot(): string {
  if (process.env.assistant_UPLOAD_DIR?.trim()) {
    return process.env.assistant_UPLOAD_DIR.trim();
  }
  if (process.env.UPLOAD_DIR?.trim()) {
    return process.env.UPLOAD_DIR.trim();
  }
  if (process.env.NODE_ENV === "production") {
    return "/opt/portal/uploads";
  }
  return "/var/lib/portal/uploads";
}

function bridgeSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET não definido");
  return secret;
}

function signBody(body: string): string {
  return createHmac("sha256", bridgeSecret()).update(body).digest("base64url");
}

export function validateBridgeSessionId(sessionId: string): boolean {
  return /^[a-zA-Z0-9_-]{16,80}$/.test(sessionId);
}

/** Garante árvore de pastas no disco (evita ENOENT no primeiro upload por tenant/usuário). */
export async function ensureassistantStorageDirs(
  tenantId: string,
  userId: string,
): Promise<void> {
  if (!/^[a-zA-Z0-9_-]+$/.test(tenantId) || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
    throw new Error("ID inválido");
  }
  const root = assistantUploadRoot();
  await mkdir(root, { recursive: true, mode: 0o775 });
  const dirs = [
    path.join(root, tenantId),
    path.join(root, tenantId, "assistant-temp"),
    path.join(root, tenantId, "assistant-temp", userId),
    path.join(root, tenantId, "assistant-temp", userId, "sessions"),
  ];
  for (const dir of dirs) {
    await mkdir(dir, { recursive: true, mode: 0o775 });
  }
}

function sessionRegistryPath(tenantId: string, userId: string, sessionId: string): string {
  for (const seg of [tenantId, userId, sessionId]) {
    if (!seg || seg === "." || seg === ".." || seg.includes("..")) {
      throw new Error("Segmento inválido");
    }
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(tenantId) || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
    throw new Error("ID inválido");
  }
  if (!validateBridgeSessionId(sessionId)) throw new Error("Sessão inválida");
  return path.join(
    assistantUploadRoot(),
    tenantId,
    "assistant-temp",
    userId,
    "sessions",
    `${sessionId}.json`,
  );
}

async function readSessionRegistry(
  tenantId: string,
  userId: string,
  sessionId: string,
): Promise<assistantBridgeSessionRegistry | null> {
  try {
    const raw = await readFile(sessionRegistryPath(tenantId, userId, sessionId), "utf8");
    return JSON.parse(raw) as assistantBridgeSessionRegistry;
  } catch {
    return null;
  }
}

async function writeSessionRegistry(
  tenantId: string,
  userId: string,
  sessionId: string,
  data: assistantBridgeSessionRegistry,
): Promise<void> {
  await ensureassistantStorageDirs(tenantId, userId);
  const diskPath = sessionRegistryPath(tenantId, userId, sessionId);
  await writeFile(diskPath, JSON.stringify(data), "utf8");
}

export async function touchassistantBridgeSession(params: {
  tenantId: string;
  userId: string;
  sessionId: string;
}): Promise<void> {
  const existing = await readSessionRegistry(
    params.tenantId,
    params.userId,
    params.sessionId,
  );
  const next: assistantBridgeSessionRegistry = {
    userId: params.userId,
    tenantId: params.tenantId,
    lastSeenAt: Date.now(),
    files: existing?.files ?? [],
  };
  await writeSessionRegistry(params.tenantId, params.userId, params.sessionId, next);
}

export async function isassistantBridgeSessionActive(
  sessionId: string,
  userId: string,
  tenantId: string,
): Promise<boolean> {
  const registry = await readSessionRegistry(tenantId, userId, sessionId);
  if (!registry || registry.userId !== userId || registry.tenantId !== tenantId) {
    return false;
  }
  return Date.now() - registry.lastSeenAt < assistant_SESSION_IDLE_MS;
}

export function createassistantPdfToken(meta: Omit<assistantTempPdfMeta, "exp">): string {
  const payload: assistantTempPdfMeta = { ...meta, exp: Date.now() + TOKEN_MAX_MS };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signBody(body)}`;
}

export function verifyassistantPdfToken(token: string): assistantTempPdfMeta | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = signBody(body);
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as assistantTempPdfMeta;
    if (
      !payload?.id ||
      !payload.userId ||
      !payload.tenantId ||
      !payload.fileName ||
      !payload.sessionId
    ) {
      return null;
    }
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (!validateBridgeSessionId(payload.sessionId)) return null;
    return payload;
  } catch {
    return null;
  }
}

function sanitizePdfFileName(name: string): string {
  const base = path.basename(name).replace(/[^\w.\- ()áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/gi, "_");
  if (!/\.pdf$/i.test(base)) return `${base.slice(0, 200)}.pdf`;
  return base.slice(0, 220);
}

export function assistantPdfDiskPath(
  tenantId: string,
  userId: string,
  fileId: string,
): string {
  for (const seg of [tenantId, userId, fileId]) {
    if (!seg || seg === "." || seg === ".." || seg.includes("..")) {
      throw new Error("Segmento inválido");
    }
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(tenantId) || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
    throw new Error("ID inválido");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) throw new Error("ID inválido");
  return path.join(assistantUploadRoot(), tenantId, "assistant-temp", userId, `${fileId}.pdf`);
}

async function appendFileToSessionRegistry(
  tenantId: string,
  userId: string,
  sessionId: string,
  file: { id: string; fileName: string },
): Promise<void> {
  const registry =
    (await readSessionRegistry(tenantId, userId, sessionId)) ?? {
      userId,
      tenantId,
      lastSeenAt: Date.now(),
      files: [],
    };
  if (!registry.files.some((f) => f.id === file.id)) {
    registry.files.push(file);
  }
  registry.lastSeenAt = Date.now();
  await writeSessionRegistry(tenantId, userId, sessionId, registry);
}

export async function saveassistantTempPdf(params: {
  tenantId: string;
  userId: string;
  sessionId: string;
  fileName: string;
  buffer: Buffer;
}): Promise<{ token: string; fileName: string }> {
  if (!validateBridgeSessionId(params.sessionId)) {
    throw new Error("Sessão do Estagiário inválida");
  }
  if (params.buffer.length > assistant_PDF_MAX_BYTES) {
    throw new Error("PDF muito grande (máx. 25 MB)");
  }

  await ensureassistantStorageDirs(params.tenantId, params.userId);

  await touchassistantBridgeSession({
    tenantId: params.tenantId,
    userId: params.userId,
    sessionId: params.sessionId,
  });

  const fileName = sanitizePdfFileName(params.fileName);
  const id = randomBytes(12).toString("base64url");
  const diskPath = assistantPdfDiskPath(params.tenantId, params.userId, id);
  try {
    await writeFile(diskPath, params.buffer);
    putassistantPdfCache(id, params.buffer);
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
    if (code === "ENOENT" || code === "EACCES") {
      throw new Error(
        `Não foi possível gravar o PDF (${code}). Pasta: ${path.dirname(diskPath)}`,
      );
    }
    throw err;
  }

  await appendFileToSessionRegistry(params.tenantId, params.userId, params.sessionId, {
    id,
    fileName,
  });

  const token = createassistantPdfToken({
    id,
    userId: params.userId,
    tenantId: params.tenantId,
    fileName,
    sessionId: params.sessionId,
  });
  return { token, fileName };
}

export async function readassistantTempPdf(
  meta: assistantTempPdfMeta,
): Promise<Buffer> {
  const cached = getassistantPdfCache(meta.id);
  if (cached) return cached;
  const diskPath = assistantPdfDiskPath(meta.tenantId, meta.userId, meta.id);
  const buffer = await readFile(diskPath);
  putassistantPdfCache(meta.id, buffer);
  return buffer;
}

export function assistantPdfDiskPathForMeta(meta: assistantTempPdfMeta): string {
  return assistantPdfDiskPath(meta.tenantId, meta.userId, meta.id);
}

export async function openassistantTempPdfStream(meta: assistantTempPdfMeta): Promise<{
  body: ReadableStream<Uint8Array> | Readable;
  size: number;
  fromCache: boolean;
}> {
  const cached = getassistantPdfCache(meta.id);
  if (cached) {
    return { body: Readable.toWeb(Readable.from(cached)) as ReadableStream<Uint8Array>, size: cached.length, fromCache: true };
  }
  const diskPath = assistantPdfDiskPathForMeta(meta);
  const info = await stat(diskPath);
  return {
    body: Readable.toWeb(createReadStream(diskPath)) as ReadableStream<Uint8Array>,
    size: info.size,
    fromCache: false,
  };
}

export async function deleteassistantTempPdf(meta: assistantTempPdfMeta): Promise<void> {
  deleteassistantPdfCache(meta.id);
  const diskPath = assistantPdfDiskPath(meta.tenantId, meta.userId, meta.id);
  await unlink(diskPath).catch(() => {});
}

export async function revokeassistantBridgeSession(
  sessionId: string,
  userId: string,
  tenantId: string,
): Promise<void> {
  if (!validateBridgeSessionId(sessionId)) return;

  const registry = await readSessionRegistry(tenantId, userId, sessionId);
  if (registry) {
    for (const file of registry.files) {
      deleteassistantPdfCache(file.id);
      await unlink(assistantPdfDiskPath(tenantId, userId, file.id)).catch(() => {});
    }
  }

  await unlink(sessionRegistryPath(tenantId, userId, sessionId)).catch(() => {});
}

export async function listassistantSessionPdfFiles(
  tenantId: string,
  userId: string,
  sessionId: string,
): Promise<Array<{ id: string; fileName: string }>> {
  const registry = await readSessionRegistry(tenantId, userId, sessionId);
  return registry?.files ?? [];
}

export async function sessionRegistryExists(
  tenantId: string,
  userId: string,
  sessionId: string,
): Promise<boolean> {
  try {
    await access(sessionRegistryPath(tenantId, userId, sessionId));
    return true;
  } catch {
    return false;
  }
}

export function assistantPdfPublicUrl(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/api/rede-teste/assistant-pdf/${encodeURIComponent(token)}`;
}

export function requestPublicBaseUrl(req: Request): string {
  const env = process.env.BETTER_AUTH_URL?.replace(/\/$/, "");
  if (env) return env;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}
