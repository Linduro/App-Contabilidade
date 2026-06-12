/** Metadados disponíveis na API pública do Datajud (sem partes/valor na maioria dos tribunais). */

export function extractPartes(source: Record<string, unknown>): Record<string, unknown>[] {
  const raw =
    source.partes ||
    (source.dadosBasicos as Record<string, unknown> | undefined)?.partes ||
    []
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []
}

export function hasPartesMetadata(source: Record<string, unknown>): boolean {
  return extractPartes(source).length > 0
}

export function extractValorCausa(source: Record<string, unknown>): number | null {
  const raw = source.valorCausa ?? source.valor
  if (raw == null || raw === "") return null
  const n = parseFloat(String(raw))
  return Number.isFinite(n) && n > 0 ? n : null
}

export function extractOrgao(source: Record<string, unknown>) {
  return (source.orgaoJulgador || {}) as Record<string, unknown>
}

/** Extrai município/comarca a partir do nome da vara quando IBGE/nome não vêm no payload. */
export function extractComarcaFromOrgao(orgao: Record<string, unknown>, fallback: string): string {
  const explicit = orgao.municipioNome || orgao.nomeMunicipio
  if (explicit) return String(explicit).trim()

  const nome = String(orgao.nome || orgao.nomeOrgao || "").trim()
  const deMatch = nome.match(/\bde\s+(.+?)(?:\s*[-–—]|$)/i)
  if (deMatch?.[1]) return deMatch[1].trim()

  return fallback
}

export const CAPA_EMPRESA_PLACEHOLDER = "Réu a identificar (capa Datajud)"
export const CAPA_EXECUTADO_PLACEHOLDER = "Executado a identificar (capa Datajud)"
