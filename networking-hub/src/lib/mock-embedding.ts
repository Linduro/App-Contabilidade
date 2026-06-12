/** Vetor determinístico para demo local sem API de IA (1536 dims, pgvector). */
export function createMockEmbedding(text: string): number[] {
  const dims = 1536
  const out = new Array<number>(dims)
  let h = 2166136261
  const seed = text.trim().toLowerCase()
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  for (let i = 0; i < dims; i++) {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    out[i] = (h % 1000) / 1000 - 0.5
  }
  const norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1
  return out.map((v) => v / norm)
}
