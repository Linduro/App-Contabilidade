/** Cache em RAM para o assistant re-buscar o PDF sem novo readFile (indexação lenta). */
const cache = new Map<string, { buffer: Buffer; exp: number }>();

const TTL_MS = 15 * 60 * 1000;

export function putassistantPdfCache(fileId: string, buffer: Buffer): void {
  cache.set(fileId, { buffer, exp: Date.now() + TTL_MS });
}

export function getassistantPdfCache(fileId: string): Buffer | null {
  const row = cache.get(fileId);
  if (!row || row.exp < Date.now()) {
    cache.delete(fileId);
    return null;
  }
  return row.buffer;
}

export function deleteassistantPdfCache(fileId: string): void {
  cache.delete(fileId);
}
